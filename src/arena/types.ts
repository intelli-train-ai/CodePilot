/**
 * Arena type system -- types for the Agent challenge testing framework.
 *
 * Defines roles, run statuses, SSE events, and DB row types used across
 * the orchestration engine, grader, and persistence layers.
 */

// ── Roles & Statuses ───────────────────────────────────────────

/** Arena participant roles */
export type ArenaRole = 'gatekeeper' | 'challenger' | 'grader' | 'system';

/** Run lifecycle states */
export type ArenaRunStatus = 'running' | 'completed' | 'failed' | 'terminated';

/** Why a run ended early */
export type TerminationReason = 'gatekeeper_end' | 'max_turns' | 'token_budget' | 'error' | 'parse_failure';

// ── SSE Events (Arena-specific, separate from chat SSE) ────────

export type ArenaSSEEventType =
  | 'run_started'
  | 'gatekeeper_message'
  | 'challenger_delta'
  | 'challenger_message'
  | 'turn_completed'
  | 'grading_started'
  | 'grade_result'
  | 'run_completed'
  | 'run_error'
  | 'token_usage';

export interface ArenaSSEEvent {
  type: ArenaSSEEventType;
  data: unknown;
}

// ── DB Row Types ───────────────────────────────────────────────

/** A single challenge run (maps to arena_runs table) */
export interface ArenaRun {
  id: string;
  level_id: string;
  world_id: string;
  status: ArenaRunStatus;
  passed: number | null;
  turn_count: number;
  token_usage_total: number;
  termination_reason: TerminationReason | null;
  gatekeeper_provider_id: string;
  gatekeeper_model: string;
  challenger_provider_id: string;
  challenger_model: string;
  grader_provider_id: string;
  grader_model: string;
  created_at: string;
  completed_at: string | null;
}

/** A single message in a run (maps to arena_messages table) */
export interface ArenaMessage {
  id: string;
  run_id: string;
  role: ArenaRole;
  content: string;
  turn_number: number;
  token_usage: string | null;
  created_at: string;
}

/** Grading result for a run (maps to arena_grades table) */
export interface ArenaGrade {
  id: string;
  run_id: string;
  passed: number;
  grade_data: string;
  token_usage: string | null;
  created_at: string;
}

// ── SSE Helpers ────────────────────────────────────────────────

/**
 * Format an Arena SSE event for streaming to the client.
 * Follows the same `data: {...}\n\n` convention as the chat SSE path.
 */
export function formatArenaSSE(event: ArenaSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
