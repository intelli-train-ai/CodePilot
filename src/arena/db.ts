/**
 * Arena DB CRUD operations.
 *
 * All writes follow DB-first pattern: insert/update first, then SELECT
 * the persisted row to return. This guarantees callers always receive
 * the exact data that was committed to SQLite.
 *
 * All queries use prepared statements to prevent SQL injection (T-01-01).
 */

import { getDb } from '@/lib/db';
import crypto from 'crypto';
import type { ArenaRun, ArenaMessage, ArenaGrade, ArenaRunStatus, TerminationReason } from './types';

// ── Runs ───────────────────────────────────────────────────────

/**
 * Create a new Arena run in 'running' status.
 * Returns the persisted ArenaRun record (DB-first guarantee).
 */
export function createArenaRun(params: {
  levelId: string;
  worldId: string;
  gatekeeperProviderId: string;
  gatekeeperModel: string;
  challengerProviderId: string;
  challengerModel: string;
  graderProviderId: string;
  graderModel: string;
}): ArenaRun {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  db.prepare(`
    INSERT INTO arena_runs (id, level_id, world_id, status, gatekeeper_provider_id, gatekeeper_model, challenger_provider_id, challenger_model, grader_provider_id, grader_model)
    VALUES (?, ?, ?, 'running', ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.levelId,
    params.worldId,
    params.gatekeeperProviderId,
    params.gatekeeperModel,
    params.challengerProviderId,
    params.challengerModel,
    params.graderProviderId,
    params.graderModel,
  );
  return db.prepare('SELECT * FROM arena_runs WHERE id = ?').get(id) as ArenaRun;
}

/**
 * Update an existing Arena run. Only provided fields are updated.
 * Returns the updated ArenaRun or null if not found.
 */
export function updateArenaRun(id: string, updates: {
  status?: ArenaRunStatus;
  passed?: number | null;
  turnCount?: number;
  tokenUsageTotal?: number;
  terminationReason?: TerminationReason | null;
  completedAt?: string;
}): ArenaRun | null {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
  if (updates.passed !== undefined) { sets.push('passed = ?'); values.push(updates.passed); }
  if (updates.turnCount !== undefined) { sets.push('turn_count = ?'); values.push(updates.turnCount); }
  if (updates.tokenUsageTotal !== undefined) { sets.push('token_usage_total = ?'); values.push(updates.tokenUsageTotal); }
  if (updates.terminationReason !== undefined) { sets.push('termination_reason = ?'); values.push(updates.terminationReason); }
  if (updates.completedAt !== undefined) { sets.push('completed_at = ?'); values.push(updates.completedAt); }

  if (sets.length === 0) return getArenaRun(id);

  values.push(id);
  db.prepare(`UPDATE arena_runs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getArenaRun(id);
}

/**
 * Retrieve an Arena run by ID.
 * Returns null if not found.
 */
export function getArenaRun(id: string): ArenaRun | null {
  // better-sqlite3 .get() returns undefined when no row found; normalize to null
  const row = getDb().prepare('SELECT * FROM arena_runs WHERE id = ?').get(id);
  return (row as ArenaRun) ?? null;
}

// ── Messages ───────────────────────────────────────────────────

/**
 * Save a message to an Arena run.
 * Returns the persisted ArenaMessage record (DB-first guarantee).
 */
export function saveArenaMessage(params: {
  runId: string;
  role: 'gatekeeper' | 'challenger' | 'grader' | 'system';
  content: string;
  turnNumber: number;
  tokenUsage?: { inputTokens: number; outputTokens: number };
}): ArenaMessage {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  const tokenUsageJson = params.tokenUsage ? JSON.stringify(params.tokenUsage) : null;
  db.prepare(`
    INSERT INTO arena_messages (id, run_id, role, content, turn_number, token_usage)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, params.runId, params.role, params.content, params.turnNumber, tokenUsageJson);
  return db.prepare('SELECT * FROM arena_messages WHERE id = ?').get(id) as ArenaMessage;
}

/**
 * Retrieve all messages for a run, ordered by turn_number ASC, created_at ASC.
 */
export function getArenaMessages(runId: string): ArenaMessage[] {
  return getDb().prepare(
    'SELECT * FROM arena_messages WHERE run_id = ? ORDER BY turn_number ASC, created_at ASC',
  ).all(runId) as ArenaMessage[];
}

// ── Grades ─────────────────────────────────────────────────────

/**
 * Save a grading result for an Arena run.
 * Each run can have at most one grade (UNIQUE constraint on run_id).
 * Returns the persisted ArenaGrade record (DB-first guarantee).
 */
export function saveArenaGrade(params: {
  runId: string;
  passed: boolean;
  gradeData: Record<string, unknown>;
  tokenUsage?: { inputTokens: number; outputTokens: number };
}): ArenaGrade {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  const tokenUsageJson = params.tokenUsage ? JSON.stringify(params.tokenUsage) : null;
  db.prepare(`
    INSERT INTO arena_grades (id, run_id, passed, grade_data, token_usage)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, params.runId, params.passed ? 1 : 0, JSON.stringify(params.gradeData), tokenUsageJson);
  return db.prepare('SELECT * FROM arena_grades WHERE id = ?').get(id) as ArenaGrade;
}

/**
 * Retrieve the grade for a run.
 * Returns null if the run has not been graded yet.
 */
export function getArenaGrade(runId: string): ArenaGrade | null {
  // better-sqlite3 .get() returns undefined when no row found; normalize to null
  const row = getDb().prepare('SELECT * FROM arena_grades WHERE run_id = ?').get(runId);
  return (row as ArenaGrade) ?? null;
}
