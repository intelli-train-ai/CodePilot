import type { GraderOutput } from '@/arena/schemas/grader-output';

/** Arena page view state (D-07: single-page state switching) */
export type ArenaViewState =
  | { phase: 'levels' }
  | { phase: 'running'; runId: string; levelId: string }
  | { phase: 'completed'; runId: string; levelId: string };

/** Arena frontend message model (decoupled from backend ArenaMessage) */
export interface ArenaUIMessage {
  id: string;
  role: 'gatekeeper' | 'challenger';
  content: string;
  turn: number;
  isStreaming?: boolean;
}

/** useArenaSSE hook run status */
export type ArenaRunUIStatus = 'idle' | 'running' | 'grading' | 'completed' | 'error';

/** Run start parameters */
export interface RunParams {
  worldId: string;
  levelId: string;
  gatekeeperProviderId?: string;
  gatekeeperModel?: string;
  challengerProviderId?: string;
  challengerModel?: string;
  graderProviderId?: string;
  graderModel?: string;
}

/** useArenaSSE return type */
export interface UseArenaSSEReturn {
  messages: ArenaUIMessage[];
  streamingDelta: string;
  currentTurn: number;
  status: ArenaRunUIStatus;
  grade: GraderOutput | null;
  tokenUsage: { totalUsed: number; remaining: number } | null;
  runId: string | null;
  error: string | null;
  startRun: (params: RunParams) => Promise<void>;
  cancelRun: () => void;
}

/** GET /api/arena/levels response types */
export interface ArenaLevelInfo {
  id: string;
  name: string;
  description: string;
  maxTurns: number;
  rubricCount: number;
}

export interface ArenaWorldInfo {
  id: string;
  name: string;
  description: string;
  icon?: string;
  levels: ArenaLevelInfo[];
}
