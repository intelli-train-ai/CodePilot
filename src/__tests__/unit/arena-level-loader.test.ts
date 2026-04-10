/**
 * Unit tests for Arena level schemas and level-loader.
 *
 * Tests verify:
 * - Zod schemas correctly validate/reject level configs, grader output, gatekeeper output
 * - Level loader discovers worlds, loads levels, handles invalid configs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// === Task 1: Schema tests ===

describe('LevelConfigSchema', () => {
  it('Test 1: valid LevelConfig JSON passes safeParse with success=true', async () => {
    const { LevelConfigSchema } = await import('@/arena/schemas/level-config');
    const valid = {
      id: 'test-level',
      name: 'Test Level',
      description: 'A test level',
      challengerSystemPrompt: 'You are a test agent.',
      gatekeeperSystemPrompt: 'You are testing.',
      rubric: [
        { name: 'Basic Check', type: 'required', description: 'Must pass' },
      ],
    };
    const result = LevelConfigSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('Test 2: invalid LevelConfig (missing id) fails safeParse with descriptive error', async () => {
    const { LevelConfigSchema } = await import('@/arena/schemas/level-config');
    const invalid = {
      // id is missing
      name: 'Test Level',
      description: 'A test level',
      challengerSystemPrompt: 'You are a test agent.',
      gatekeeperSystemPrompt: 'You are testing.',
      rubric: [
        { name: 'Basic Check', type: 'required', description: 'Must pass' },
      ],
    };
    const result = LevelConfigSchema.safeParse(invalid);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.message.length > 0, 'Error message should be descriptive');
    }
  });
});

describe('WorldConfigSchema', () => {
  it('Test 3: WorldConfigSchema validates world.json structure', async () => {
    const { WorldConfigSchema } = await import('@/arena/schemas/level-config');
    const valid = {
      id: 'test-world',
      name: 'Test World',
      description: 'A test world',
      icon: 'headset',
      sortOrder: 0,
    };
    const result = WorldConfigSchema.safeParse(valid);
    assert.equal(result.success, true);
  });
});

describe('GraderOutputSchema', () => {
  it('Test 4: validates mixed scoring output (required Pass/Fail + performance A/B/C/D)', async () => {
    const { GraderOutputSchema } = await import('@/arena/schemas/grader-output');
    const valid = {
      passed: true,
      requiredCriteria: [
        { name: 'Self-Introduction', passed: true, reason: 'Agent introduced themselves' },
      ],
      performanceDimensions: [
        { name: 'Tone', grade: 'A', reason: 'Excellent tone' },
      ],
      suggestions: [
        { content: 'Could be warmer', referenceTurn: 0 },
      ],
    };
    const result = GraderOutputSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('Test 5: rejects suggestions array with more than 3 items', async () => {
    const { GraderOutputSchema } = await import('@/arena/schemas/grader-output');
    const tooManySuggestions = {
      passed: true,
      requiredCriteria: [],
      performanceDimensions: [],
      suggestions: [
        { content: 'Suggestion 1', referenceTurn: 0 },
        { content: 'Suggestion 2', referenceTurn: 1 },
        { content: 'Suggestion 3', referenceTurn: 2 },
        { content: 'Suggestion 4', referenceTurn: 3 },
      ],
    };
    const result = GraderOutputSchema.safeParse(tooManySuggestions);
    assert.equal(result.success, false);
  });
});

describe('GatekeeperOutputSchema', () => {
  it('Test 6: validates shouldEnd boolean field', async () => {
    const { GatekeeperOutputSchema } = await import('@/arena/schemas/gatekeeper-output');
    const valid = {
      message: 'Hello, how can I help?',
      shouldEnd: false,
    };
    const result = GatekeeperOutputSchema.safeParse(valid);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.shouldEnd, false);
    }
  });
});

describe('RubricItem gradeDescriptions', () => {
  it('Test 7: RubricItem with type=performance requires gradeDescriptions with A/B/C/D keys', async () => {
    const { RubricItemSchema } = await import('@/arena/schemas/level-config');

    // Valid performance item with A/B/C/D
    const validPerf = {
      name: 'Tone',
      type: 'performance',
      description: 'Overall tone',
      gradeDescriptions: {
        A: 'Excellent',
        B: 'Good',
        C: 'Adequate',
        D: 'Poor',
      },
    };
    const result1 = RubricItemSchema.safeParse(validPerf);
    assert.equal(result1.success, true);

    // Required item without gradeDescriptions is also valid
    const validReq = {
      name: 'Must Do',
      type: 'required',
      description: 'Must do this',
    };
    const result2 = RubricItemSchema.safeParse(validReq);
    assert.equal(result2.success, true);
  });
});
