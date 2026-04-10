/**
 * Unit tests for Arena orchestrator.
 *
 * Uses dependency injection (OrchestrationDeps) to mock all LLM calls
 * and DB functions, testing the orchestration loop logic in isolation.
 *
 * Key verification points:
 * - Event sequence ordering
 * - Termination conditions (shouldEnd, maxTurns, token_budget, parse_failure)
 * - DB-first pattern (challenger_message after saveArenaMessage)
 * - Real (non-zero) usage values in token tracking
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---- Mock state ----

let callLog: string[] = [];
let gatekeeperResponses: Array<{
  output: { message: string; shouldEnd: boolean; endReason?: string };
  usage: { totalTokens: number; promptTokens: number; completionTokens: number };
} | null> = [];
let gatekeeperCallIndex = 0;

let challengerResponses: Array<{
  deltas: string[];
  fullContent: string;
  usage: { totalTokens: number; promptTokens: number; completionTokens: number };
}> = [];
let challengerCallIndex = 0;

let graderResponse: {
  output: {
    passed: boolean;
    requiredCriteria: Array<{ name: string; passed: boolean; reason: string }>;
    performanceDimensions: Array<{ name: string; grade: 'A' | 'B' | 'C' | 'D'; reason: string }>;
    suggestions: Array<{ content: string; referenceTurn: number }>;
  };
  usage: { totalTokens: number; promptTokens: number; completionTokens: number };
} | null = null;

let savedMessages: Array<{ runId: string; role: string; content: string; turnNumber: number }> = [];

// Shared mock level config
const mockLevelConfig = {
  id: 'test-level',
  name: 'Test Level',
  description: 'A test level',
  challengerSystemPrompt: 'You are a test agent.',
  gatekeeperSystemPrompt: 'You are testing.',
  rubric: [
    { name: 'Basic Check', type: 'required' as const, description: 'Must pass' },
  ],
  maxTurns: 5,
  maxTokens: undefined as number | undefined,
  sortOrder: 0,
};

/** Build mock deps for each test */
function buildMockDeps() {
  return {
    callGatekeeper: async () => {
      const response = gatekeeperResponses[gatekeeperCallIndex++];
      callLog.push('callGatekeeper');
      return response;
    },

    callChallenger: async function* () {
      const response = challengerResponses[challengerCallIndex++];
      callLog.push('callChallenger:start');
      for (const delta of response.deltas) {
        yield { text: delta };
      }
      callLog.push('callChallenger:end');
      return {
        fullContent: response.fullContent,
        usage: response.usage,
      };
    },

    callGrader: async () => {
      callLog.push('callGrader');
      return graderResponse!;
    },

    loadLevel: (_worldId: string, _levelId: string) => {
      return { config: { ...mockLevelConfig }, worldId: _worldId };
    },

    createArenaRun: () => {
      callLog.push('createArenaRun');
      return { id: 'test-run-id' };
    },

    updateArenaRun: (_id: string, updates: Record<string, unknown>) => {
      callLog.push(`updateArenaRun:${updates.status}`);
      return null;
    },

    saveArenaMessage: (params: { runId: string; role: string; content: string; turnNumber: number }) => {
      savedMessages.push(params);
      callLog.push(`saveArenaMessage:${params.role}`);
      return { id: 'msg-id', ...params };
    },

    saveArenaGrade: () => {
      callLog.push('saveArenaGrade');
      return { id: 'grade-id' };
    },
  };
}

describe('Arena Orchestrator', () => {
  beforeEach(() => {
    callLog = [];
    gatekeeperCallIndex = 0;
    challengerCallIndex = 0;
    savedMessages = [];
    mockLevelConfig.maxTurns = 5;
    mockLevelConfig.maxTokens = undefined;
  });

  it('Test 1: yields run_started as first event', async () => {
    gatekeeperResponses = [
      { output: { message: 'Hello', shouldEnd: true }, usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 } },
    ];
    graderResponse = {
      output: { passed: true, requiredCriteria: [{ name: 'Basic Check', passed: true, reason: 'ok' }], performanceDimensions: [], suggestions: [] },
      usage: { totalTokens: 200, promptTokens: 100, completionTokens: 100 },
    };

    const { runArenaOrchestration } = await import('@/arena/engine/orchestrator');
    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of runArenaOrchestration(
      { worldId: 'test-world', levelId: 'test-level' },
      buildMockDeps(),
    )) {
      events.push(event);
    }

    assert.equal(events[0].type, 'run_started');
    assert.deepStrictEqual((events[0].data as Record<string, unknown>).runId, 'test-run-id');
  });

  it('Test 2: terminates when gatekeeper returns shouldEnd=true, yields run_completed with passed status', async () => {
    gatekeeperResponses = [
      { output: { message: 'How do you handle refunds?', shouldEnd: false }, usage: { totalTokens: 150, promptTokens: 80, completionTokens: 70 } },
      { output: { message: 'Good enough, ending now.', shouldEnd: true, endReason: 'sufficient' }, usage: { totalTokens: 120, promptTokens: 60, completionTokens: 60 } },
    ];
    challengerResponses = [
      { deltas: ['I handle ', 'refunds by...'], fullContent: 'I handle refunds by...', usage: { totalTokens: 200, promptTokens: 100, completionTokens: 100 } },
    ];
    graderResponse = {
      output: { passed: true, requiredCriteria: [{ name: 'Basic Check', passed: true, reason: 'ok' }], performanceDimensions: [], suggestions: [] },
      usage: { totalTokens: 300, promptTokens: 150, completionTokens: 150 },
    };

    const { runArenaOrchestration } = await import('@/arena/engine/orchestrator');
    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of runArenaOrchestration(
      { worldId: 'test-world', levelId: 'test-level' },
      buildMockDeps(),
    )) {
      events.push(event);
    }

    const runCompleted = events.find(e => e.type === 'run_completed');
    assert.ok(runCompleted, 'run_completed event should be present');
    const data = runCompleted!.data as Record<string, unknown>;
    assert.equal(data.passed, true);
    assert.equal(data.terminationReason, 'gatekeeper_end');
  });

  it('Test 3: terminates at maxTurns limit, terminationReason is max_turns', async () => {
    mockLevelConfig.maxTurns = 2;

    gatekeeperResponses = [
      { output: { message: 'Question 1', shouldEnd: false }, usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 } },
      { output: { message: 'Question 2', shouldEnd: false }, usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 } },
    ];
    challengerResponses = [
      { deltas: ['Answer 1'], fullContent: 'Answer 1', usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 } },
      { deltas: ['Answer 2'], fullContent: 'Answer 2', usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 } },
    ];
    graderResponse = {
      output: { passed: false, requiredCriteria: [{ name: 'Basic Check', passed: false, reason: 'timeout' }], performanceDimensions: [], suggestions: [] },
      usage: { totalTokens: 200, promptTokens: 100, completionTokens: 100 },
    };

    const { runArenaOrchestration } = await import('@/arena/engine/orchestrator');
    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of runArenaOrchestration(
      { worldId: 'test-world', levelId: 'test-level' },
      buildMockDeps(),
    )) {
      events.push(event);
    }

    const runCompleted = events.find(e => e.type === 'run_completed');
    assert.ok(runCompleted, 'run_completed event should be present');
    const data = runCompleted!.data as Record<string, unknown>;
    assert.equal(data.terminationReason, 'max_turns');
  });

  it('Test 4: terminates when token budget exhausted, terminationReason is token_budget', async () => {
    // Small budget: GK(300) + Challenger(300) = 600 consumed
    // After first full turn: remaining = 500-600 = negative => budget check before second GK fails
    // But GRADER_RESERVE is 8000, so with budget=500, first GK(300) leaves 200 remaining
    // 200 < 8000 (GRADER_RESERVE) => hasEnoughForNextTurn = false => token_budget before Challenger
    mockLevelConfig.maxTokens = 500;

    gatekeeperResponses = [
      { output: { message: 'Q1', shouldEnd: false }, usage: { totalTokens: 300, promptTokens: 150, completionTokens: 150 } },
      { output: { message: 'Q2', shouldEnd: false }, usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 } },
    ];
    challengerResponses = [
      { deltas: ['A1'], fullContent: 'A1', usage: { totalTokens: 300, promptTokens: 150, completionTokens: 150 } },
    ];
    graderResponse = {
      output: { passed: false, requiredCriteria: [{ name: 'Basic Check', passed: false, reason: 'budget' }], performanceDimensions: [], suggestions: [] },
      usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
    };

    const { runArenaOrchestration } = await import('@/arena/engine/orchestrator');
    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of runArenaOrchestration(
      { worldId: 'test-world', levelId: 'test-level' },
      buildMockDeps(),
    )) {
      events.push(event);
    }

    const runCompleted = events.find(e => e.type === 'run_completed');
    assert.ok(runCompleted, 'run_completed event should be present');
    const data = runCompleted!.data as Record<string, unknown>;
    assert.equal(data.terminationReason, 'token_budget');
    // Verify non-zero token usage
    assert.ok((data.totalTokens as number) > 0, 'totalTokens should be non-zero');
  });

  it('Test 5: yields gatekeeper_message, challenger_delta, challenger_message events in order per turn', async () => {
    gatekeeperResponses = [
      { output: { message: 'Question', shouldEnd: false }, usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 } },
      { output: { message: 'Done', shouldEnd: true }, usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 } },
    ];
    challengerResponses = [
      { deltas: ['part1', 'part2'], fullContent: 'part1part2', usage: { totalTokens: 150, promptTokens: 75, completionTokens: 75 } },
    ];
    graderResponse = {
      output: { passed: true, requiredCriteria: [{ name: 'Basic Check', passed: true, reason: 'ok' }], performanceDimensions: [], suggestions: [] },
      usage: { totalTokens: 200, promptTokens: 100, completionTokens: 100 },
    };

    const { runArenaOrchestration } = await import('@/arena/engine/orchestrator');
    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of runArenaOrchestration(
      { worldId: 'test-world', levelId: 'test-level' },
      buildMockDeps(),
    )) {
      events.push(event);
    }

    const types = events.map(e => e.type);

    // Find first turn's event sequence
    const gkIdx = types.indexOf('gatekeeper_message');
    const deltaIdx = types.indexOf('challenger_delta');
    const msgIdx = types.indexOf('challenger_message');

    assert.ok(gkIdx >= 0, 'gatekeeper_message should be present');
    assert.ok(deltaIdx >= 0, 'challenger_delta should be present');
    assert.ok(msgIdx >= 0, 'challenger_message should be present');
    assert.ok(gkIdx < deltaIdx, 'gatekeeper_message should come before challenger_delta');
    assert.ok(deltaIdx < msgIdx, 'challenger_delta should come before challenger_message');
  });

  it('Test 6: yields grade_result after conversation ends', async () => {
    gatekeeperResponses = [
      { output: { message: 'Hi', shouldEnd: true }, usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 } },
    ];
    graderResponse = {
      output: {
        passed: true,
        requiredCriteria: [{ name: 'Basic Check', passed: true, reason: 'Great' }],
        performanceDimensions: [{ name: 'Tone', grade: 'A', reason: 'Excellent' }],
        suggestions: [{ content: 'Be more concise', referenceTurn: 0 }],
      },
      usage: { totalTokens: 300, promptTokens: 200, completionTokens: 100 },
    };

    const { runArenaOrchestration } = await import('@/arena/engine/orchestrator');
    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of runArenaOrchestration(
      { worldId: 'test-world', levelId: 'test-level' },
      buildMockDeps(),
    )) {
      events.push(event);
    }

    const types = events.map(e => e.type);
    const gradingIdx = types.indexOf('grading_started');
    const gradeIdx = types.indexOf('grade_result');
    const completedIdx = types.indexOf('run_completed');

    assert.ok(gradingIdx >= 0, 'grading_started should be present');
    assert.ok(gradeIdx >= 0, 'grade_result should be present');
    assert.ok(gradingIdx < gradeIdx, 'grading_started should come before grade_result');
    assert.ok(gradeIdx < completedIdx, 'grade_result should come before run_completed');

    const gradeData = events[gradeIdx].data as Record<string, unknown>;
    assert.equal(gradeData.passed, true);
  });

  it('Test 7: calls saveArenaMessage before yielding challenger_message (DB-first); challenger_delta without DB write', async () => {
    gatekeeperResponses = [
      { output: { message: 'Question', shouldEnd: false }, usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 } },
      { output: { message: 'Done', shouldEnd: true }, usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 } },
    ];
    challengerResponses = [
      { deltas: ['chunk1', 'chunk2'], fullContent: 'chunk1chunk2', usage: { totalTokens: 150, promptTokens: 75, completionTokens: 75 } },
    ];
    graderResponse = {
      output: { passed: true, requiredCriteria: [{ name: 'Basic Check', passed: true, reason: 'ok' }], performanceDimensions: [], suggestions: [] },
      usage: { totalTokens: 200, promptTokens: 100, completionTokens: 100 },
    };

    const { runArenaOrchestration } = await import('@/arena/engine/orchestrator');

    // Build deps that record interleaved call+yield sequence
    const sequence: string[] = [];
    const deps = buildMockDeps();
    const origSaveMessage = deps.saveArenaMessage;
    deps.saveArenaMessage = (params: { runId: string; role: string; content: string; turnNumber: number }) => {
      sequence.push(`db:saveArenaMessage:${params.role}`);
      return origSaveMessage(params);
    };

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of runArenaOrchestration(
      { worldId: 'test-world', levelId: 'test-level' },
      deps,
    )) {
      events.push(event);
      sequence.push(`yield:${event.type}`);
    }

    // Find relevant sequence entries
    const deltaYieldIdx = sequence.findIndex(s => s === 'yield:challenger_delta');
    const challengerSaveIdx = sequence.findIndex(s => s === 'db:saveArenaMessage:challenger');
    const challengerYieldIdx = sequence.findIndex(s => s === 'yield:challenger_message');

    assert.ok(deltaYieldIdx >= 0, 'challenger_delta should be yielded');
    assert.ok(challengerSaveIdx >= 0, 'saveArenaMessage:challenger should be called');
    assert.ok(challengerYieldIdx >= 0, 'challenger_message should be yielded');

    // challenger_delta should come BEFORE saveArenaMessage:challenger (no DB write for deltas)
    assert.ok(deltaYieldIdx < challengerSaveIdx, 'challenger_delta should be yielded before DB write');
    // saveArenaMessage:challenger should come BEFORE yield:challenger_message (DB-first)
    assert.ok(challengerSaveIdx < challengerYieldIdx, 'saveArenaMessage should be called before yielding challenger_message');
  });
});
