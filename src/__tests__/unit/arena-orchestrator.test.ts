/**
 * Unit tests for Arena orchestrator.
 *
 * Mocks all LLM calls (callGatekeeper, callChallenger, callGrader) and DB
 * functions to test the orchestration loop logic in isolation.
 *
 * Key verification points:
 * - Event sequence ordering
 * - Termination conditions (shouldEnd, maxTurns, token_budget, parse_failure)
 * - DB-first pattern (challenger_message after saveArenaMessage)
 * - Real (non-zero) usage values in token tracking
 */

import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---- Mock setup ----

// Track DB call order for DB-first verification
let callLog: string[] = [];

// Mock callGatekeeper
let gatekeeperResponses: Array<{
  output: { message: string; shouldEnd: boolean; endReason?: string };
  usage: { totalTokens: number; promptTokens: number; completionTokens: number };
} | null> = [];
let gatekeeperCallIndex = 0;

// Mock callChallenger -- returns async generator
let challengerResponses: Array<{
  deltas: string[];
  fullContent: string;
  usage: { totalTokens: number; promptTokens: number; completionTokens: number };
}> = [];
let challengerCallIndex = 0;

// Mock callGrader
let graderResponse: {
  output: {
    passed: boolean;
    requiredCriteria: Array<{ name: string; passed: boolean; reason: string }>;
    performanceDimensions: Array<{ name: string; grade: string; reason: string }>;
    suggestions: Array<{ content: string; referenceTurn: number }>;
  };
  usage: { totalTokens: number; promptTokens: number; completionTokens: number };
} | null = null;

// Mock DB functions
let savedMessages: Array<{ runId: string; role: string; content: string; turnNumber: number }> = [];
let savedGrades: Array<{ runId: string; passed: boolean }> = [];
let createdRun: { id: string } | null = null;

// Mock loadLevel
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

// We'll use module-level mocking via node:test mock.module
// to intercept imports from the orchestrator module

describe('Arena Orchestrator', () => {
  before(async () => {
    // Mock the gatekeeper module
    mock.module('@/arena/engine/gatekeeper', {
      namedExports: {
        callGatekeeper: async () => {
          const response = gatekeeperResponses[gatekeeperCallIndex++];
          callLog.push('callGatekeeper');
          return response;
        },
      },
    });

    // Mock the challenger module
    mock.module('@/arena/engine/challenger', {
      namedExports: {
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
      },
    });

    // Mock the grader module
    mock.module('@/arena/engine/grader', {
      namedExports: {
        callGrader: async () => {
          callLog.push('callGrader');
          return graderResponse;
        },
      },
    });

    // Mock the level-loader
    mock.module('@/arena/level-loader', {
      namedExports: {
        loadLevel: (_worldId: string, _levelId: string) => {
          return { config: mockLevelConfig, worldId: _worldId };
        },
      },
    });

    // Mock DB functions
    mock.module('@/arena/db', {
      namedExports: {
        createArenaRun: (params: Record<string, string>) => {
          createdRun = { id: 'test-run-id' };
          callLog.push('createArenaRun');
          return {
            id: 'test-run-id',
            level_id: params.levelId,
            world_id: params.worldId,
            status: 'running',
            passed: null,
            turn_count: 0,
            token_usage_total: 0,
            termination_reason: null,
            gatekeeper_provider_id: '',
            gatekeeper_model: '',
            challenger_provider_id: '',
            challenger_model: '',
            grader_provider_id: '',
            grader_model: '',
            created_at: new Date().toISOString(),
            completed_at: null,
          };
        },
        updateArenaRun: (id: string, updates: Record<string, unknown>) => {
          callLog.push(`updateArenaRun:${updates.status}`);
          return null;
        },
        saveArenaMessage: (params: { runId: string; role: string; content: string; turnNumber: number }) => {
          savedMessages.push(params);
          callLog.push(`saveArenaMessage:${params.role}`);
          return { id: 'msg-id', ...params, token_usage: null, created_at: new Date().toISOString() };
        },
        saveArenaGrade: (params: { runId: string; passed: boolean }) => {
          savedGrades.push(params);
          callLog.push('saveArenaGrade');
          return { id: 'grade-id', ...params, grade_data: '{}', token_usage: null, created_at: new Date().toISOString() };
        },
        getArenaRun: () => null,
        getArenaMessages: () => [],
        getArenaGrade: () => null,
      },
    });
  });

  beforeEach(() => {
    callLog = [];
    gatekeeperCallIndex = 0;
    challengerCallIndex = 0;
    savedMessages = [];
    savedGrades = [];
    createdRun = null;
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
    for await (const event of runArenaOrchestration({ worldId: 'test-world', levelId: 'test-level' })) {
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
    for await (const event of runArenaOrchestration({ worldId: 'test-world', levelId: 'test-level' })) {
      events.push(event);
    }

    const runCompleted = events.find(e => e.type === 'run_completed');
    assert.ok(runCompleted, 'run_completed event should be present');
    const data = runCompleted!.data as Record<string, unknown>;
    assert.equal(data.passed, true);
    assert.equal(data.terminationReason, 'gatekeeper_end');
  });

  it('Test 3: terminates at maxTurns limit, terminationReason is max_turns', async () => {
    // Set maxTurns to 2 for this test
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
    for await (const event of runArenaOrchestration({ worldId: 'test-world', levelId: 'test-level' })) {
      events.push(event);
    }

    const runCompleted = events.find(e => e.type === 'run_completed');
    assert.ok(runCompleted, 'run_completed event should be present');
    const data = runCompleted!.data as Record<string, unknown>;
    assert.equal(data.terminationReason, 'max_turns');

    // Reset for other tests
    mockLevelConfig.maxTurns = 5;
  });

  it('Test 4: terminates when token budget exhausted, terminationReason is token_budget', async () => {
    // Set a very small token budget
    mockLevelConfig.maxTokens = 500;

    // First GK call uses 300 tokens, first Challenger uses 300 => total 600 > 500 budget
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
    for await (const event of runArenaOrchestration({ worldId: 'test-world', levelId: 'test-level' })) {
      events.push(event);
    }

    const runCompleted = events.find(e => e.type === 'run_completed');
    assert.ok(runCompleted, 'run_completed event should be present');
    const data = runCompleted!.data as Record<string, unknown>;
    assert.equal(data.terminationReason, 'token_budget');
    // Verify non-zero token usage
    assert.ok((data.totalTokens as number) > 0, 'totalTokens should be non-zero');

    // Reset
    mockLevelConfig.maxTokens = undefined;
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
    for await (const event of runArenaOrchestration({ worldId: 'test-world', levelId: 'test-level' })) {
      events.push(event);
    }

    const types = events.map(e => e.type);

    // Find first turn sequence
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
    for await (const event of runArenaOrchestration({ worldId: 'test-world', levelId: 'test-level' })) {
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
    const events: Array<{ type: string; data: unknown }> = [];
    callLog = [];
    for await (const event of runArenaOrchestration({ worldId: 'test-world', levelId: 'test-level' })) {
      events.push(event);
      // Record that this event type was yielded
      callLog.push(`yield:${event.type}`);
    }

    // Verify challenger_delta events come WITHOUT a prior saveArenaMessage:challenger
    // and challenger_message comes AFTER saveArenaMessage:challenger
    const deltaYieldIdx = callLog.indexOf('yield:challenger_delta');
    const msgSaveIdx = callLog.indexOf('saveArenaMessage:challenger');
    const msgYieldIdx = callLog.indexOf('yield:challenger_message');

    assert.ok(deltaYieldIdx >= 0, 'challenger_delta should be yielded');
    assert.ok(msgSaveIdx >= 0, 'saveArenaMessage:challenger should be called');
    assert.ok(msgYieldIdx >= 0, 'challenger_message should be yielded');

    // challenger_delta should come BEFORE saveArenaMessage:challenger (no DB write for deltas)
    assert.ok(deltaYieldIdx < msgSaveIdx, 'challenger_delta should be yielded before DB write');
    // saveArenaMessage:challenger should come BEFORE yield:challenger_message (DB-first)
    assert.ok(msgSaveIdx < msgYieldIdx, 'saveArenaMessage should be called before yielding challenger_message');
  });
});
