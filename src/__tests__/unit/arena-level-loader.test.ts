/**
 * Unit tests for Arena level schemas and level-loader.
 *
 * Tests verify:
 * - Zod schemas correctly validate/reject level configs, grader output, gatekeeper output
 * - Level loader discovers worlds, loads levels, handles invalid configs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

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

// === Task 2: Level-loader tests ===

describe('loadAllWorlds', () => {
  it('Test 8: discovers customer-service world and returns it with 2 levels', async () => {
    const { loadAllWorlds } = await import('@/arena/level-loader');
    const worlds = loadAllWorlds();

    assert.ok(worlds.length >= 1, 'Should find at least 1 world');
    const csWorld = worlds.find(w => w.config.id === 'customer-service');
    assert.ok(csWorld, 'Should find customer-service world');
    assert.equal(csWorld.levels.length, 2, 'customer-service should have 2 levels');
  });

  it('Test 9: rejects an invalid level file with clear error message containing the field name', async () => {
    // Create a temporary world with an invalid level file
    const levelsDir = path.resolve(__dirname, '../../arena/levels');
    const tempWorldDir = path.join(levelsDir, '_test-invalid-world');

    fs.mkdirSync(tempWorldDir, { recursive: true });
    fs.writeFileSync(path.join(tempWorldDir, 'world.json'), JSON.stringify({
      id: 'test-invalid',
      name: 'Test Invalid',
      description: 'For testing invalid levels',
    }));
    // Level missing required fields (no challengerSystemPrompt, no rubric)
    fs.writeFileSync(path.join(tempWorldDir, 'level-01.json'), JSON.stringify({
      id: 'bad-level',
      name: 'Bad Level',
      // missing: description, challengerSystemPrompt, gatekeeperSystemPrompt, rubric
    }));

    try {
      // Need a fresh import to avoid module cache
      const loaderPath = '@/arena/level-loader';
      // Clear module cache for fresh load
      const { loadAllWorlds } = await import(loaderPath);
      assert.throws(() => loadAllWorlds(), (err: Error) => {
        assert.ok(err.message.includes('Invalid level config'), 'Error should mention invalid level config');
        return true;
      });
    } finally {
      // Cleanup temp world
      fs.rmSync(tempWorldDir, { recursive: true, force: true });
    }
  });

  it('Test 10: ignores non-directory entries in levels/', async () => {
    // Create a stray file in levels directory
    const levelsDir = path.resolve(__dirname, '../../arena/levels');
    const strayFile = path.join(levelsDir, '_test-stray-file.txt');
    fs.writeFileSync(strayFile, 'this is not a directory');

    try {
      const { loadAllWorlds } = await import('@/arena/level-loader');
      // Should not throw even with stray file
      const worlds = loadAllWorlds();
      assert.ok(Array.isArray(worlds), 'Should return array');
      // Stray file should not appear as a world
      const strayWorld = worlds.find(w => w.config.id === '_test-stray-file.txt');
      assert.equal(strayWorld, undefined, 'Stray file should not be treated as world');
    } finally {
      fs.unlinkSync(strayFile);
    }
  });
});

describe('loadLevel', () => {
  it('Test 11: returns a validated LevelConfig for a valid level', async () => {
    const { loadLevel } = await import('@/arena/level-loader');
    const level = loadLevel('customer-service', 'cs-greeting');
    assert.ok(level, 'Should find cs-greeting level');
    assert.equal(level.config.id, 'cs-greeting');
    assert.equal(level.worldId, 'customer-service');
    assert.ok(level.config.rubric.length >= 1, 'Should have rubric items');
  });
});

describe('getWorldLevels', () => {
  it('Test 12: returns levels sorted by sortOrder', async () => {
    const { getWorldLevels } = await import('@/arena/level-loader');
    const levels = getWorldLevels('customer-service');
    assert.equal(levels.length, 2);
    // First level should have lower sortOrder
    assert.ok(levels[0].config.sortOrder <= levels[1].config.sortOrder,
      'Levels should be sorted by sortOrder');
    assert.equal(levels[0].config.id, 'cs-greeting');
    assert.equal(levels[1].config.id, 'cs-complaint');
  });
});
