/**
 * Unit tests for Arena DB CRUD operations.
 *
 * Run with: npx tsx --test src/__tests__/unit/arena-db.test.ts
 *
 * Tests verify:
 * 1. createArenaRun inserts a row with status='running' and returns ArenaRun
 * 2. saveArenaMessage inserts and returns ArenaMessage with correct fields
 * 3. saveArenaGrade inserts and returns ArenaGrade with correct fields
 * 4. updateArenaRun updates status, passed, turn_count, etc.
 * 5. getArenaMessages returns messages ordered by turn_number, created_at
 * 6. getArenaRun returns null for non-existent run_id
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Set a temp data dir before importing db module to avoid touching real data
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-db-test-'));
process.env.CLAUDE_GUI_DATA_DIR = tmpDir;

/* eslint-disable @typescript-eslint/no-require-imports */
const { closeDb } = require('../../lib/db') as typeof import('../../lib/db');
const {
  createArenaRun,
  updateArenaRun,
  getArenaRun,
  saveArenaMessage,
  getArenaMessages,
  saveArenaGrade,
  getArenaGrade,
} = require('../../arena/db') as typeof import('../../arena/db');

describe('Arena DB CRUD', () => {
  afterEach(() => {
    // Keep DB open between tests for speed; only close at cleanup
  });

  it('createArenaRun inserts a row and returns ArenaRun with status=running', () => {
    const run = createArenaRun({
      levelId: 'level-1',
      worldId: 'world-1',
      gatekeeperProviderId: 'provider-gk',
      gatekeeperModel: 'gk-model',
      challengerProviderId: 'provider-ch',
      challengerModel: 'ch-model',
      graderProviderId: 'provider-gr',
      graderModel: 'gr-model',
    });

    assert.ok(run.id, 'run should have an id');
    assert.equal(run.level_id, 'level-1');
    assert.equal(run.world_id, 'world-1');
    assert.equal(run.status, 'running');
    assert.equal(run.passed, null);
    assert.equal(run.turn_count, 0);
    assert.equal(run.token_usage_total, 0);
    assert.equal(run.termination_reason, null);
    assert.equal(run.gatekeeper_provider_id, 'provider-gk');
    assert.equal(run.gatekeeper_model, 'gk-model');
    assert.equal(run.challenger_provider_id, 'provider-ch');
    assert.equal(run.challenger_model, 'ch-model');
    assert.equal(run.grader_provider_id, 'provider-gr');
    assert.equal(run.grader_model, 'gr-model');
    assert.ok(run.created_at, 'should have created_at');
    assert.equal(run.completed_at, null);
  });

  it('saveArenaMessage inserts a message and returns ArenaMessage', () => {
    const run = createArenaRun({
      levelId: 'level-msg',
      worldId: 'world-msg',
      gatekeeperProviderId: 'p',
      gatekeeperModel: 'm',
      challengerProviderId: 'p',
      challengerModel: 'm',
      graderProviderId: 'p',
      graderModel: 'm',
    });

    const msg = saveArenaMessage({
      runId: run.id,
      role: 'gatekeeper',
      content: 'Hello, tell me about yourself.',
      turnNumber: 1,
      tokenUsage: { inputTokens: 100, outputTokens: 50 },
    });

    assert.ok(msg.id, 'message should have an id');
    assert.equal(msg.run_id, run.id);
    assert.equal(msg.role, 'gatekeeper');
    assert.equal(msg.content, 'Hello, tell me about yourself.');
    assert.equal(msg.turn_number, 1);
    assert.ok(msg.token_usage, 'should have token_usage');
    const usage = JSON.parse(msg.token_usage!);
    assert.equal(usage.inputTokens, 100);
    assert.equal(usage.outputTokens, 50);
    assert.ok(msg.created_at, 'should have created_at');
  });

  it('saveArenaGrade inserts and returns ArenaGrade with correct fields', () => {
    const run = createArenaRun({
      levelId: 'level-grade',
      worldId: 'world-grade',
      gatekeeperProviderId: 'p',
      gatekeeperModel: 'm',
      challengerProviderId: 'p',
      challengerModel: 'm',
      graderProviderId: 'p',
      graderModel: 'm',
    });

    const grade = saveArenaGrade({
      runId: run.id,
      passed: true,
      gradeData: {
        mustHaves: [{ criterion: 'greeting', passed: true }],
        performance: [{ criterion: 'clarity', grade: 'A' }],
        feedback: 'Well done!',
      },
      tokenUsage: { inputTokens: 200, outputTokens: 100 },
    });

    assert.ok(grade.id, 'grade should have an id');
    assert.equal(grade.run_id, run.id);
    assert.equal(grade.passed, 1, 'passed=true should be stored as 1');
    const data = JSON.parse(grade.grade_data);
    assert.equal(data.feedback, 'Well done!');
    assert.ok(grade.token_usage);
    assert.ok(grade.created_at);
  });

  it('updateArenaRun updates status, passed, turn_count, token_usage_total, termination_reason, completed_at', () => {
    const run = createArenaRun({
      levelId: 'level-update',
      worldId: 'world-update',
      gatekeeperProviderId: 'p',
      gatekeeperModel: 'm',
      challengerProviderId: 'p',
      challengerModel: 'm',
      graderProviderId: 'p',
      graderModel: 'm',
    });

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const updated = updateArenaRun(run.id, {
      status: 'completed',
      passed: 1,
      turnCount: 5,
      tokenUsageTotal: 1500,
      terminationReason: 'gatekeeper_end',
      completedAt: now,
    });

    assert.ok(updated, 'should return updated run');
    assert.equal(updated!.status, 'completed');
    assert.equal(updated!.passed, 1);
    assert.equal(updated!.turn_count, 5);
    assert.equal(updated!.token_usage_total, 1500);
    assert.equal(updated!.termination_reason, 'gatekeeper_end');
    assert.equal(updated!.completed_at, now);
  });

  it('getArenaMessages returns messages ordered by turn_number asc, created_at asc', () => {
    const run = createArenaRun({
      levelId: 'level-order',
      worldId: 'world-order',
      gatekeeperProviderId: 'p',
      gatekeeperModel: 'm',
      challengerProviderId: 'p',
      challengerModel: 'm',
      graderProviderId: 'p',
      graderModel: 'm',
    });

    // Insert in reverse order to test sorting
    saveArenaMessage({ runId: run.id, role: 'challenger', content: 'Turn 2 reply', turnNumber: 2 });
    saveArenaMessage({ runId: run.id, role: 'gatekeeper', content: 'Turn 1 question', turnNumber: 1 });
    saveArenaMessage({ runId: run.id, role: 'gatekeeper', content: 'Turn 2 question', turnNumber: 2 });
    saveArenaMessage({ runId: run.id, role: 'challenger', content: 'Turn 1 reply', turnNumber: 1 });

    const messages = getArenaMessages(run.id);
    assert.equal(messages.length, 4);
    // turn_number ordering: 1, 1, 2, 2
    assert.equal(messages[0].turn_number, 1);
    assert.equal(messages[1].turn_number, 1);
    assert.equal(messages[2].turn_number, 2);
    assert.equal(messages[3].turn_number, 2);
  });

  it('getArenaRun returns null for non-existent run_id', () => {
    const result = getArenaRun('non-existent-id');
    assert.equal(result, null);
  });

  it('getArenaGrade returns null for run without grade', () => {
    const run = createArenaRun({
      levelId: 'level-no-grade',
      worldId: 'world-no-grade',
      gatekeeperProviderId: 'p',
      gatekeeperModel: 'm',
      challengerProviderId: 'p',
      challengerModel: 'm',
      graderProviderId: 'p',
      graderModel: 'm',
    });
    const grade = getArenaGrade(run.id);
    assert.equal(grade, null);
  });

  it('cleanup test fixtures', () => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
