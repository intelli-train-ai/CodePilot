import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadAllWorlds } from '../../arena/level-loader';

// ── Arena Levels API Tests ─────────────────────────────────────
// Tests the data layer backing GET /api/arena/levels.
// Verifies loadAllWorlds() returns the correct world/level structure
// that the API route transforms into its response payload.

describe('Arena levels API', () => {
  it('loadAllWorlds returns at least one world including customer-service', () => {
    const worlds = loadAllWorlds();
    assert.ok(worlds.length >= 1, 'Should have at least 1 world');
    const cs = worlds.find(w => w.config.id === 'customer-service');
    assert.ok(cs, 'customer-service world should exist');
    assert.ok(cs.config.name, 'World should have a name');
    assert.ok(cs.config.description, 'World should have a description');
  });

  it('customer-service world has exactly 2 levels in correct sort order', () => {
    const worlds = loadAllWorlds();
    const cs = worlds.find(w => w.config.id === 'customer-service')!;
    assert.equal(cs.levels.length, 2, 'customer-service should have 2 levels');
    assert.equal(cs.levels[0].config.id, 'cs-greeting', 'First level should be cs-greeting');
    assert.equal(cs.levels[1].config.id, 'cs-complaint', 'Second level should be cs-complaint');
  });

  it('level objects have all required fields for API response', () => {
    const worlds = loadAllWorlds();
    const cs = worlds.find(w => w.config.id === 'customer-service')!;
    for (const level of cs.levels) {
      assert.ok(level.config.id, 'level.id should exist');
      assert.ok(level.config.name, 'level.name should exist');
      assert.ok(level.config.description, 'level.description should exist');
      assert.ok(typeof level.config.maxTurns === 'number', 'maxTurns should be a number');
      assert.ok(level.config.maxTurns > 0, 'maxTurns should be positive');
      assert.ok(Array.isArray(level.config.rubric), 'rubric should be an array');
      assert.ok(level.config.rubric.length > 0, 'rubric should have items');
      assert.equal(level.worldId, 'customer-service', 'worldId should match parent world');
    }
  });

  it('rubric counts match expected values per level', () => {
    const worlds = loadAllWorlds();
    const cs = worlds.find(w => w.config.id === 'customer-service')!;
    // level-01 (cs-greeting) has 4 rubric items, level-02 (cs-complaint) has 5
    assert.equal(cs.levels[0].config.rubric.length, 4, 'cs-greeting should have 4 rubric items');
    assert.equal(cs.levels[1].config.rubric.length, 5, 'cs-complaint should have 5 rubric items');
  });
});
