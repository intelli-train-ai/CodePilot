/**
 * Core Arena orchestration loop (ORCH-01, ORCH-03, ORCH-04, D-01).
 *
 * Drives the full Arena run as a single async generator that yields
 * ArenaSSEEvent sequences. Per D-01: single API request drives the
 * complete run via a while-loop.
 *
 * SSE event DB-first rules:
 * - challenger_delta: yield immediately (no DB write, temporary stream data)
 * - challenger_message: saveArenaMessage first, then yield (DB-first)
 * - gatekeeper_message: saveArenaMessage first, then yield (DB-first)
 * - grade_result: saveArenaGrade first, then yield (DB-first)
 *
 * Termination conditions (by priority):
 * 1. Gatekeeper shouldEnd=true (ORCH-02)
 * 2. Token budget exhausted (ORCH-04, D-03) -- real usage values
 * 3. maxTurns reached (ORCH-03)
 * 4. Gatekeeper parse failure after retry (D-02)
 * 5. Unrecoverable error
 */

import { callGatekeeper as defaultCallGatekeeper } from './gatekeeper';
import { callChallenger as defaultCallChallenger } from './challenger';
import { callGrader as defaultCallGrader } from './grader';
import { TokenTracker } from './token-tracker';
import {
  createArenaRun as defaultCreateArenaRun,
  updateArenaRun as defaultUpdateArenaRun,
  saveArenaMessage as defaultSaveArenaMessage,
  saveArenaGrade as defaultSaveArenaGrade,
} from '../db';
import { loadLevel as defaultLoadLevel } from '../level-loader';
import type { ArenaSSEEvent, TerminationReason } from '../types';
import type { GatekeeperCallResult } from './gatekeeper';
import type { ChallengerDelta, ChallengerResult } from './challenger';
import type { GraderOutput } from '../schemas/grader-output';
import type { LevelConfig } from '../schemas/level-config';

export interface OrchestrationParams {
  worldId: string;
  levelId: string;
  defaultProviderId?: string;
  defaultModel?: string;
  abortSignal?: AbortSignal;
}

export interface OrchestrationResult {
  runId: string;
  passed: boolean | null;
  terminationReason: TerminationReason;
  turnCount: number;
  totalTokens: number;
}

/**
 * Dependencies that can be injected for testing.
 * All default to the real implementations.
 */
export interface OrchestrationDeps {
  callGatekeeper: (opts: {
    transcript: Array<{ role: 'user' | 'assistant'; content: string }>;
    level: LevelConfig;
    abortSignal?: AbortSignal;
  }) => Promise<GatekeeperCallResult | null>;

  callChallenger: (opts: {
    transcript: Array<{ role: 'user' | 'assistant'; content: string }>;
    level: LevelConfig;
    abortSignal?: AbortSignal;
  }) => AsyncGenerator<ChallengerDelta, ChallengerResult>;

  callGrader: (opts: {
    transcript: Array<{ role: string; content: string; turn: number }>;
    level: LevelConfig;
    abortSignal?: AbortSignal;
  }) => Promise<{ output: GraderOutput; usage: { totalTokens: number; promptTokens: number; completionTokens: number } }>;

  loadLevel: (worldId: string, levelId: string) => { config: LevelConfig; worldId: string } | null;

  createArenaRun: (params: {
    levelId: string; worldId: string;
    gatekeeperProviderId: string; gatekeeperModel: string;
    challengerProviderId: string; challengerModel: string;
    graderProviderId: string; graderModel: string;
  }) => { id: string };

  updateArenaRun: (id: string, updates: Record<string, unknown>) => unknown;

  saveArenaMessage: (params: {
    runId: string; role: string; content: string; turnNumber: number;
    tokenUsage?: { inputTokens: number; outputTokens: number };
  }) => unknown;

  saveArenaGrade: (params: {
    runId: string; passed: boolean;
    gradeData: Record<string, unknown>;
    tokenUsage?: { inputTokens: number; outputTokens: number };
  }) => unknown;
}

/** Default dependency implementations (real modules) */
const defaultDeps: OrchestrationDeps = {
  callGatekeeper: defaultCallGatekeeper,
  callChallenger: defaultCallChallenger,
  callGrader: defaultCallGrader,
  loadLevel: defaultLoadLevel as OrchestrationDeps['loadLevel'],
  createArenaRun: defaultCreateArenaRun,
  updateArenaRun: defaultUpdateArenaRun as unknown as OrchestrationDeps['updateArenaRun'],
  saveArenaMessage: defaultSaveArenaMessage as unknown as OrchestrationDeps['saveArenaMessage'],
  saveArenaGrade: defaultSaveArenaGrade as unknown as OrchestrationDeps['saveArenaGrade'],
};

/**
 * Core orchestration loop. Per D-01: single API call drives the entire run.
 *
 * Returns an async generator yielding ArenaSSEEvent sequences.
 *
 * @param params - run configuration (worldId, levelId, provider settings)
 * @param deps - optional dependency overrides for testing
 */
export async function* runArenaOrchestration(
  params: OrchestrationParams,
  deps: Partial<OrchestrationDeps> = {},
): AsyncGenerator<ArenaSSEEvent> {
  const d = { ...defaultDeps, ...deps };

  // 1. Load level configuration
  const loaded = d.loadLevel(params.worldId, params.levelId);
  if (!loaded) {
    yield { type: 'run_error', data: { error: `Level not found: ${params.worldId}/${params.levelId}` } };
    return;
  }
  const level = loaded.config;

  // Inject default provider/model into level config so role modules pick them up
  // when the level JSON doesn't specify per-role overrides
  if (params.defaultProviderId || params.defaultModel) {
    if (!level.roleConfig) {
      level.roleConfig = {};
    }
    for (const role of ['gatekeeper', 'challenger', 'grader'] as const) {
      if (!level.roleConfig[role]) {
        level.roleConfig[role] = {};
      }
      if (!level.roleConfig[role]!.providerId && params.defaultProviderId) {
        level.roleConfig[role]!.providerId = params.defaultProviderId;
      }
      if (!level.roleConfig[role]!.model && params.defaultModel) {
        level.roleConfig[role]!.model = params.defaultModel;
      }
    }
  }

  // 2. Create run record (DB-first)
  const run = d.createArenaRun({
    levelId: params.levelId,
    worldId: params.worldId,
    gatekeeperProviderId: level.roleConfig?.gatekeeper?.providerId || params.defaultProviderId || '',
    gatekeeperModel: level.roleConfig?.gatekeeper?.model || params.defaultModel || '',
    challengerProviderId: level.roleConfig?.challenger?.providerId || params.defaultProviderId || '',
    challengerModel: level.roleConfig?.challenger?.model || params.defaultModel || '',
    graderProviderId: level.roleConfig?.grader?.providerId || params.defaultProviderId || '',
    graderModel: level.roleConfig?.grader?.model || params.defaultModel || '',
  });

  yield { type: 'run_started', data: { runId: run.id, levelId: level.id, levelName: level.name } };

  // 3. Initialize token tracker (per D-03: default 200,000, level can override)
  const tokenTracker = new TokenTracker(level.maxTokens);

  // 4. Orchestration loop (per D-01: synchronous while-loop)
  let turn = 0;
  let terminationReason: TerminationReason = 'max_turns'; // default if loop exits normally
  const transcript: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const gradingTranscript: Array<{ role: string; content: string; turn: number }> = [];

  try {
    while (turn < level.maxTurns) {
      // Check token budget before Gatekeeper call
      if (!tokenTracker.hasEnoughForNextTurn()) {
        terminationReason = 'token_budget';
        break;
      }

      // --- Gatekeeper ---
      const gkResult = await d.callGatekeeper({
        transcript,
        level,
        abortSignal: params.abortSignal,
      });

      if (!gkResult) {
        // Parse failure after retry (per D-02)
        terminationReason = 'parse_failure';
        d.saveArenaMessage({
          runId: run.id,
          role: 'system',
          content: 'Gatekeeper structured output parse failure after 2 attempts',
          turnNumber: turn,
        });
        yield { type: 'run_error', data: { error: 'Gatekeeper output parse failure', turn } };
        break;
      }

      // Consume real usage from generateText result
      tokenTracker.consume(gkResult.usage.totalTokens);

      // DB-first: save Gatekeeper message then yield
      d.saveArenaMessage({
        runId: run.id,
        role: 'gatekeeper',
        content: gkResult.output.message,
        turnNumber: turn,
        tokenUsage: {
          inputTokens: gkResult.usage.promptTokens,
          outputTokens: gkResult.usage.completionTokens,
        },
      });

      yield { type: 'gatekeeper_message', data: { content: gkResult.output.message, turn } };
      yield { type: 'token_usage', data: { totalUsed: tokenTracker.totalUsed, remaining: tokenTracker.remaining } };

      transcript.push({ role: 'user', content: gkResult.output.message });
      gradingTranscript.push({ role: 'gatekeeper', content: gkResult.output.message, turn });

      // Check shouldEnd
      if (gkResult.output.shouldEnd) {
        terminationReason = 'gatekeeper_end';
        break;
      }

      // Check token budget before Challenger call
      if (!tokenTracker.hasEnoughForNextTurn()) {
        terminationReason = 'token_budget';
        break;
      }

      // --- Challenger (async generator) ---
      const challengerGen = d.callChallenger({
        transcript,
        level,
        abortSignal: params.abortSignal,
      });

      // Consume deltas and yield SSE in real-time (no DB write for deltas)
      let challengerResult: ChallengerResult | undefined;
      while (true) {
        const { value, done } = await challengerGen.next();
        if (done) {
          // done=true: value is the return value (ChallengerResult)
          challengerResult = value as ChallengerResult;
          break;
        }
        // done=false: value is a yielded ChallengerDelta
        yield { type: 'challenger_delta', data: { delta: (value as ChallengerDelta).text, turn } };
      }

      // Consume real usage from streamText result.usage
      tokenTracker.consume(challengerResult!.usage.totalTokens);

      // DB-first: save Challenger complete message then yield
      d.saveArenaMessage({
        runId: run.id,
        role: 'challenger',
        content: challengerResult!.fullContent,
        turnNumber: turn,
        tokenUsage: {
          inputTokens: challengerResult!.usage.promptTokens,
          outputTokens: challengerResult!.usage.completionTokens,
        },
      });

      yield { type: 'challenger_message', data: { content: challengerResult!.fullContent, turn } };
      yield { type: 'turn_completed', data: { turn, tokensUsed: tokenTracker.totalUsed } };
      yield { type: 'token_usage', data: { totalUsed: tokenTracker.totalUsed, remaining: tokenTracker.remaining } };

      transcript.push({ role: 'assistant', content: challengerResult!.fullContent });
      gradingTranscript.push({ role: 'challenger', content: challengerResult!.fullContent, turn });

      turn++;
    }

    // 5. Grader evaluation (per GRAD-01: one-shot after conversation ends)
    yield { type: 'grading_started', data: { turn } };

    const gradeResult = await d.callGrader({
      transcript: gradingTranscript,
      level,
      abortSignal: params.abortSignal,
    });

    tokenTracker.consume(gradeResult.usage.totalTokens);

    // DB-first: save grade then yield
    d.saveArenaGrade({
      runId: run.id,
      passed: gradeResult.output.passed,
      gradeData: gradeResult.output as unknown as Record<string, unknown>,
      tokenUsage: {
        inputTokens: gradeResult.usage.promptTokens,
        outputTokens: gradeResult.usage.completionTokens,
      },
    });

    yield { type: 'grade_result', data: gradeResult.output };

    // 6. Update run status
    d.updateArenaRun(run.id, {
      status: 'completed',
      passed: gradeResult.output.passed ? 1 : 0,
      turnCount: turn,
      tokenUsageTotal: tokenTracker.totalUsed,
      terminationReason,
      completedAt: new Date().toISOString(),
    });

    yield {
      type: 'run_completed',
      data: {
        runId: run.id,
        passed: gradeResult.output.passed,
        terminationReason,
        turnCount: turn,
        totalTokens: tokenTracker.totalUsed,
      },
    };
  } catch (err) {
    d.updateArenaRun(run.id, {
      status: 'failed',
      turnCount: turn,
      tokenUsageTotal: tokenTracker.totalUsed,
      terminationReason: 'error',
      completedAt: new Date().toISOString(),
    });

    yield { type: 'run_error', data: { error: err instanceof Error ? err.message : String(err), turn } };
    yield {
      type: 'run_completed',
      data: {
        runId: run.id,
        passed: null,
        terminationReason: 'error',
        turnCount: turn,
        totalTokens: tokenTracker.totalUsed,
      },
    };
  }
}
