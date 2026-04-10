# Architecture Patterns

**Domain:** Multi-Agent Conversation Orchestrator (Arena)
**Researched:** 2026-04-10
**Confidence:** HIGH (based on existing codebase analysis + Vercel AI SDK documentation + domain research)

## System Overview

Arena is a multi-agent conversation orchestrator embedded within the existing CodePilot Electron + Next.js application. It coordinates three LLM-powered roles (Gatekeeper, Challenger, Grader) through a server-side conversation loop, streaming progress to the frontend in real-time.

```
+------------------+     +--------------------+     +------------------+
|   React Frontend |     |  Next.js API Layer |     |  Data Layer      |
|                  |     |                    |     |                  |
| ArenaView        |<--->| /api/arena/*       |<--->| SQLite (db.ts)   |
|  - LevelDetail   | SSE | - run/route.ts     |     | - arena_runs     |
|  - ChatReplay    |<----| - RunOrchestrator  |     | - arena_messages |
|  - GradeReport   |     |   (server loop)    |     | - arena_grades   |
|  - ManualInput   |---->|                    |     |                  |
|                  |     | text-generator.ts  |     | JSON Configs     |
| Sidebar (NavRail)|     | provider-resolver  |     | - worlds/*.json  |
+------------------+     +--------------------+     +------------------+
```

## Recommended Architecture

### Design Principle: Server-Side Orchestration Loop with SSE Relay

The orchestrator runs entirely on the server (Next.js API route). Each "run" is a POST request that opens an SSE stream back to the client. The server drives the Gatekeeper-Challenger conversation loop, collects the transcript, invokes the Grader, and persists everything to SQLite. The client is a passive consumer that renders events as they arrive.

**Why server-side, not client-side orchestration:**
- Prevents prompt/system-prompt exposure to the browser (security)
- Eliminates client-disconnect-causes-lost-run problems (reliability)
- Matches the existing CodePilot pattern where `/api/chat` streams SSE from server
- Allows the orchestrator to use `generateText()` (non-streaming) for internal LLM calls while streaming progress events to the client

### Component Boundaries

| Component | Responsibility | Layer | Communicates With |
|-----------|---------------|-------|-------------------|
| **RunOrchestrator** | Drives the Gatekeeper-Challenger conversation loop, manages turn state, emits SSE events | `src/lib/arena/orchestrator.ts` | Gatekeeper, Challenger, Grader, SSE Emitter, DB |
| **Gatekeeper** | Generates questions based on scenario prompt + conversation history; decides when to end | `src/lib/arena/gatekeeper.ts` | RunOrchestrator (called by) |
| **Challenger** | Responds to Gatekeeper questions using its system prompt | `src/lib/arena/challenger.ts` | RunOrchestrator (called by) |
| **Grader** | Reviews full transcript against rubric, produces structured score | `src/lib/arena/grader.ts` | RunOrchestrator (called by) |
| **SSE Emitter** | Formats orchestrator events into SSE wire format, handles stream lifecycle | `src/lib/arena/sse-emitter.ts` | RunOrchestrator (produces events), API route (owns Response) |
| **Level Loader** | Loads and validates JSON level configs from filesystem | `src/lib/arena/level-loader.ts` | API routes, RunOrchestrator |
| **Arena DB** | CRUD for runs, messages, grades; progress tracking | `src/lib/db.ts` (new tables + functions) | All API routes |
| **Arena API Routes** | REST endpoints for worlds, levels, runs, manual input | `src/app/api/arena/*` | Frontend, RunOrchestrator |
| **ArenaView (Frontend)** | Level selection, chat display, grade report, manual Gatekeeper input | `src/app/arena/*` + `src/components/arena/*` | Arena API Routes |

### Component Detail

#### 1. RunOrchestrator (`src/lib/arena/orchestrator.ts`)

The central engine. Implements the conversation loop as an async generator that yields SSE events.

```typescript
interface RunOrchestratorParams {
  levelConfig: LevelConfig;
  providerId: string;
  model: string;
  mode: 'auto' | 'manual'; // Gatekeeper mode
  onManualInput?: () => Promise<string>; // For manual Gatekeeper mode
}

async function* runOrchestrator(params: RunOrchestratorParams): AsyncGenerator<ArenaSSEEvent> {
  // 1. Emit run-started
  // 2. Loop: Gatekeeper turn -> emit message -> Challenger turn -> emit message
  // 3. Check Gatekeeper's end-signal after each turn
  // 4. When done: invoke Grader with full transcript
  // 5. Emit grade-result
  // 6. Persist everything to DB
}
```

**Why async generator:** Matches the pattern in `text-generator.ts` where `streamTextFromProvider()` is already an async generator. The API route consumes the generator and writes SSE chunks to the Response stream, exactly as `/api/chat` does with `streamClaude()`.

#### 2. Gatekeeper (`src/lib/arena/gatekeeper.ts`)

Wraps a `generateTextFromProvider()` call with the Gatekeeper's system prompt and conversation history.

```typescript
interface GatekeeperResult {
  message: string;       // The question to ask
  shouldEnd: boolean;    // Whether Gatekeeper decides conversation is complete
  reasoning?: string;    // Why it decided to end (for debugging)
}

async function generateGatekeeperTurn(
  systemPrompt: string,
  conversationHistory: ConversationTurn[],
  providerId: string,
  model: string,
): Promise<GatekeeperResult>
```

**End-of-conversation detection:** The Gatekeeper's system prompt instructs it to output a structured signal (e.g., `[END_CONVERSATION]` marker or JSON with `shouldEnd: true`) when it has gathered enough information. The function parses this from the response.

**Why `generateTextFromProvider` (non-streaming) internally:** The Gatekeeper's output is consumed by the orchestrator, not streamed to the user character-by-character. Full text is needed before the Challenger can respond. However, the orchestrator streams a `gatekeeper-message` event to the frontend once the full message is ready, enabling real-time display.

**Alternative for auto mode with streaming feel:** Use `streamTextFromProvider()` for the Gatekeeper, accumulate chunks in the orchestrator, and relay each chunk to the frontend as `gatekeeper-chunk` events. This gives a typing effect in the UI. The accumulated full text is then passed to the Challenger. This is optional -- `generateText` with a single `gatekeeper-message` event is simpler and adequate for v1.

#### 3. Challenger (`src/lib/arena/challenger.ts`)

Wraps a `streamTextFromProvider()` call. The Challenger IS the agent being tested, so streaming its response makes sense -- the user wants to see it "think" in real-time.

```typescript
async function* streamChallengerTurn(
  systemPrompt: string,
  conversationHistory: ConversationTurn[],
  providerId: string,
  model: string,
): AsyncGenerator<string> // yields text chunks
```

**Why streaming for Challenger:** The Challenger is the star of the show. Users watch it respond to evaluate quality. Streaming creates engagement and lets users abort early if something goes wrong.

#### 4. Grader (`src/lib/arena/grader.ts`)

Post-conversation single-shot LLM call that produces structured output.

```typescript
interface GradeResult {
  totalScore: number;
  passed: boolean;
  coreItems: Array<{
    name: string;
    description: string;
    score: number;
    maxScore: number;
    passed: boolean;        // For mandatory items
  }>;
  bonusItems: Array<{
    name: string;
    description: string;
    score: number;
    maxScore: number;
  }>;
  highlight: string;       // Best performance callout
  suggestions: string[];   // Improvement suggestions
}

async function gradeTranscript(
  gradingPrompt: string,
  rubric: GradingRubric,
  transcript: ConversationTurn[],
  providerId: string,
  model: string,
): Promise<GradeResult>
```

**Structured output strategy:** The Grader's system prompt includes the rubric and instructs JSON output. Parse the response with `JSON.parse()` after extracting from markdown code fences if needed. Do NOT use Vercel AI SDK's `generateObject()` for v1 -- it requires Zod schemas and adds complexity. Simple prompt engineering with `generateTextFromProvider()` + JSON parsing is sufficient and matches the existing codebase pattern.

**Score model (from mockups):** The grading system uses numeric scores per dimension, not discrete Pass/Fail + A/B/C/D as originally specified. The mockups show:
- Core items: numeric score / max score (e.g., 19/20)
- Bonus items: numeric score / max score (e.g., 17/20)
- Total: sum / 100
- Pass threshold defined per level (e.g., 70/100)
- Mandatory items that, if failed, cause automatic failure regardless of score

This is a hybrid numeric + mandatory-gate model. Use this instead of pure discrete grading.

#### 5. SSE Emitter (`src/lib/arena/sse-emitter.ts`)

Utility for formatting events into SSE wire protocol. Lightweight, matches the existing pattern in `/api/chat/route.ts`.

```typescript
type ArenaSSEEvent =
  | { type: 'run-started'; data: { runId: string; levelId: string } }
  | { type: 'gatekeeper-message'; data: { turn: number; content: string } }
  | { type: 'challenger-chunk'; data: { turn: number; chunk: string } }
  | { type: 'challenger-message'; data: { turn: number; content: string } }
  | { type: 'turn-complete'; data: { turn: number } }
  | { type: 'grading-started'; data: {} }
  | { type: 'grade-result'; data: GradeResult }
  | { type: 'run-complete'; data: { passed: boolean; totalScore: number } }
  | { type: 'error'; data: { message: string } }
  | { type: 'manual-input-needed'; data: { turn: number } };

function formatSSE(event: ArenaSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
```

#### 6. Level Loader (`src/lib/arena/level-loader.ts`)

Reads JSON config files from a known directory. v1 uses filesystem, not database.

```typescript
interface LevelConfig {
  id: string;
  worldId: string;
  name: string;
  description: string;
  difficulty: 'warmup' | 'beginner' | 'intermediate' | 'advanced';
  maxTurns: number;
  passThreshold: number;          // e.g., 70
  challengerSystemPrompt: string;
  gatekeeperSystemPrompt: string;
  gradingPrompt: string;
  rubric: GradingRubric;
  order: number;                  // Position within world
  prerequisites: string[];       // Level IDs that must be passed first
}

interface WorldConfig {
  id: string;
  name: string;
  description: string;
  levels: string[];  // Ordered level IDs
  order: number;
}

interface GradingRubric {
  coreItems: Array<{
    name: string;
    description: string;
    maxScore: number;
    mandatory: boolean;  // Fail entire level if this fails
  }>;
  bonusItems: Array<{
    name: string;
    description: string;
    maxScore: number;
  }>;
}
```

**Config location:** `src/data/arena/worlds/` directory. Each world is a directory containing a `world.json` and individual `level-*.json` files. This makes configs versionable and easy to author.

```
src/data/arena/
  worlds/
    beginner-village/
      world.json
      level-warmup.json
      level-prioritize.json
    knowledge-domain/
      world.json
      level-trust.json
      ...
```

## Data Flow

### Auto Mode (AI Gatekeeper) -- Primary Flow

```
User clicks "Start Level"
        |
        v
Frontend: POST /api/arena/run  { levelId, providerId, model, mode: 'auto' }
        |
        v
API Route: creates run record in DB, starts orchestrator
        |
        v
RunOrchestrator (async generator loop):
        |
        +---> [Turn N] Gatekeeper.generateTurn(systemPrompt, history)
        |       |
        |       v
        |     text-generator.ts -> generateTextFromProvider()
        |       |
        |       v
        |     Parse response -> { message, shouldEnd }
        |       |
        |       +--- yield { type: 'gatekeeper-message', data: { turn: N, content } }
        |       |         |
        |       |         v
        |       |    SSE -> Frontend renders Gatekeeper bubble (left side, green)
        |       |
        |       +--- if shouldEnd -> break loop, go to grading
        |
        +---> [Turn N] Challenger.streamTurn(systemPrompt, history)
        |       |
        |       v
        |     text-generator.ts -> streamTextFromProvider()
        |       |
        |       v
        |     For each chunk: yield { type: 'challenger-chunk', data: { turn: N, chunk } }
        |       |                    |
        |       |                    v
        |       |              SSE -> Frontend appends to Challenger bubble (right side, white)
        |       |
        |       +--- After stream complete:
        |             yield { type: 'challenger-message', data: { turn: N, content: full } }
        |             Save message pair to DB
        |
        +---> [Check] turn >= maxTurns? -> force end
        |
        +---> Loop back to Gatekeeper turn
        |
        v (loop ended)
yield { type: 'grading-started' }
        |
        v
Grader.gradeTranscript(gradingPrompt, rubric, fullTranscript)
        |
        v
text-generator.ts -> generateTextFromProvider() (single large call)
        |
        v
Parse JSON response -> GradeResult
        |
        v
yield { type: 'grade-result', data: gradeResult }
Save grade to DB, update run status
        |
        v
yield { type: 'run-complete', data: { passed, totalScore } }
Stream ends.
```

### Manual Mode (Human Gatekeeper)

```
User clicks "Start Level" with manual mode
        |
        v
Frontend: POST /api/arena/run  { levelId, providerId, model, mode: 'manual' }
        |
        v
API Route: creates run record, returns { runId }
(No SSE stream opened yet -- user types first question)
        |
        v
User types question in ManualInput component
        |
        v
Frontend: POST /api/arena/run/{runId}/turn  { content: "user's question" }
        |
        v
API Route: saves Gatekeeper message, starts Challenger stream
        |
        v
Challenger.streamTurn(systemPrompt, history)
        |
        v
SSE stream -> Frontend renders Challenger response
Stream ends after Challenger finishes.
        |
        v
User can: type next question OR click "End & Grade"
        |
        v
Frontend: POST /api/arena/run/{runId}/grade
        |
        v
Grader runs, returns grade result
```

**Key difference from auto mode:** Manual mode is request-response per turn, not a single long-lived SSE stream. Each turn is a separate HTTP request. This avoids the complexity of server-to-client signaling for "your input is needed" mid-stream.

### Integration with Existing CodePilot Architecture

```
Existing CodePilot                    Arena (new)
==================                    ===========

NavRail.tsx                           + Arena icon/link
  |                                     |
  v                                     v
/chat  /plugins  /settings            /arena (new page)
                                        |
                                        v
/api/chat (SSE streaming)             /api/arena/* (REST + SSE)
  |                                     |
  v                                     v
claude-client.ts                      orchestrator.ts
  |                                     |
  v                                     v
Claude Agent SDK                      text-generator.ts (reuse)
                                        |
                                        v
                                      provider-resolver.ts (reuse)
                                        |
                                        v
                                      db.ts (new arena_* tables)
```

**Shared infrastructure (zero new dependencies):**
- `text-generator.ts` -- both `streamTextFromProvider()` and `generateTextFromProvider()` for all three roles
- `provider-resolver.ts` -- user's configured API providers and keys
- `db.ts` -- add new tables, reuse getDb() + migration patterns
- `requireAuth()` -- same auth middleware
- Radix UI + Tailwind CSS -- same component library
- i18n (`useTranslation()`) -- add arena keys to en.ts + zh.ts

**Arena does NOT touch:**
- `claude-client.ts` (Claude Agent SDK) -- Arena uses lightweight text generation, not the full SDK
- `stream-session-manager.ts` (client-side) -- Arena has its own simpler SSE consumer
- `conversation-registry.ts` -- no SDK sessions to track

## Database Schema (New Tables)

```sql
-- Arena run records
CREATE TABLE IF NOT EXISTS arena_runs (
  id TEXT PRIMARY KEY,
  level_id TEXT NOT NULL,
  world_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK(status IN ('running', 'grading', 'completed', 'failed', 'cancelled')),
  mode TEXT NOT NULL DEFAULT 'auto'
    CHECK(mode IN ('auto', 'manual')),
  provider_id TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  total_score INTEGER,
  passed INTEGER,                -- 0 or 1
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'
);

-- Conversation messages within a run
CREATE TABLE IF NOT EXISTS arena_messages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  turn INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('gatekeeper', 'challenger')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES arena_runs(id) ON DELETE CASCADE
);

-- Grading results
CREATE TABLE IF NOT EXISTS arena_grades (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE,
  total_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 100,
  passed INTEGER NOT NULL DEFAULT 0,
  core_items TEXT NOT NULL DEFAULT '[]',    -- JSON array of scored items
  bonus_items TEXT NOT NULL DEFAULT '[]',   -- JSON array of scored items
  highlight TEXT NOT NULL DEFAULT '',
  suggestions TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  raw_response TEXT NOT NULL DEFAULT '',    -- Full LLM grading response for debugging
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES arena_runs(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arena_runs_level ON arena_runs(level_id);
CREATE INDEX IF NOT EXISTS idx_arena_runs_status ON arena_runs(status);
CREATE INDEX IF NOT EXISTS idx_arena_messages_run ON arena_messages(run_id);
CREATE INDEX IF NOT EXISTS idx_arena_grades_run ON arena_grades(run_id);
```

## API Routes Structure

```
src/app/api/arena/
  worlds/
    route.ts              GET    -> list all worlds with levels
  levels/
    [levelId]/
      route.ts            GET    -> level config + unlock status
  runs/
    route.ts              POST   -> start a new run (returns SSE stream for auto, runId for manual)
                          GET    -> list runs (with filters: levelId, status)
    [runId]/
      route.ts            GET    -> run details + messages + grade
      turn/
        route.ts          POST   -> submit manual Gatekeeper turn (returns Challenger SSE stream)
      grade/
        route.ts          POST   -> trigger grading for manual mode
      cancel/
        route.ts          POST   -> cancel a running run
  progress/
    route.ts              GET    -> user's overall progress (passed levels, unlock status)
```

## Patterns to Follow

### Pattern 1: Async Generator for SSE (matches existing codebase)

The existing chat API uses `streamClaude()` which returns a `ReadableStream`. The Arena orchestrator should produce a similar stream from an async generator.

```typescript
// In the API route
export async function POST(request: NextRequest) {
  // ... setup ...

  const eventStream = runOrchestrator(params);

  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const event of eventStream) {
          controller.enqueue(formatSSE(event));
        }
        controller.close();
      } catch (error) {
        controller.enqueue(formatSSE({ type: 'error', data: { message: error.message } }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### Pattern 2: Conversation History as Array (standard LLM pattern)

```typescript
interface ConversationTurn {
  role: 'gatekeeper' | 'challenger';
  content: string;
  turn: number;
}

// In orchestrator loop:
const history: ConversationTurn[] = [];

// Each Gatekeeper/Challenger call receives the full history
// and the system prompt as a formatted prompt string:
function buildPromptWithHistory(
  systemPrompt: string,
  history: ConversationTurn[],
  role: 'gatekeeper' | 'challenger',
): string {
  const formatted = history
    .map(t => `[${t.role === 'gatekeeper' ? 'Customer' : 'Agent'}]: ${t.content}`)
    .join('\n\n');
  return `${formatted}\n\n[Your turn as ${role === 'gatekeeper' ? 'Customer' : 'Agent'}]:`;
}
```

**Note:** Using `text-generator.ts` `streamTextFromProvider()` which takes a single `prompt` string + `system` string. The history is formatted into the prompt, not passed as a messages array. This is a deliberate simplification that avoids needing to modify `text-generator.ts` to accept a messages array. For the Arena's use case (evaluating prompt quality, not tool-calling agents), this is sufficient.

### Pattern 3: Level Unlock Logic (client-side check, server-side enforcement)

```typescript
// Level unlock check
function isLevelUnlocked(levelId: string, progress: Map<string, boolean>): boolean {
  const level = loadLevel(levelId);
  return level.prerequisites.every(prereq => progress.get(prereq) === true);
}
```

Server enforces on run creation; frontend grays out locked levels in the sidebar.

### Pattern 4: Abort Handling (matches existing pattern)

```typescript
// API route passes AbortSignal to orchestrator
const abortController = new AbortController();
request.signal.addEventListener('abort', () => abortController.abort());

// Orchestrator checks signal between turns
if (abortSignal?.aborted) {
  yield { type: 'run-cancelled' };
  // Save partial run to DB
  return;
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Orchestration
**What:** Frontend drives the loop by calling Gatekeeper API, then Challenger API, then repeat.
**Why bad:** Exposes system prompts in network requests. Client disconnect loses state. Race conditions when multiple tabs. Violates the existing pattern where server drives conversation.
**Instead:** Server-side orchestrator with SSE relay.

### Anti-Pattern 2: Reusing stream-session-manager.ts
**What:** Try to shoe-horn Arena streaming into the existing chat stream session manager.
**Why bad:** The chat stream manager is deeply tied to Claude Agent SDK events (tool_use, tool_result, permission_request, etc.). Arena has completely different event types (gatekeeper-message, challenger-chunk, grade-result). Forcing Arena events through the chat manager would require ugly adapters and create coupling.
**Instead:** Arena has its own lightweight SSE consumer hook (`useArenaStream`) that understands Arena event types.

### Anti-Pattern 3: Using Claude Agent SDK for Arena Roles
**What:** Spawn Claude Code CLI processes for Gatekeeper/Challenger/Grader.
**Why bad:** Massive overhead for lightweight text generation. The SDK brings tool-calling, file editing, MCP, permissions -- none of which Arena needs. Each role just needs prompt-in, text-out.
**Instead:** Use `text-generator.ts` (Vercel AI SDK `streamText`/`generateText`) directly.

### Anti-Pattern 4: Shared Database Tables with Chat
**What:** Store Arena messages in the existing `messages` table, Arena runs in `chat_sessions`.
**Why bad:** Different schemas (Arena has roles gatekeeper/challenger vs user/assistant, has turn numbers, has grade references). Queries become complex with WHERE clauses to separate chat from arena. Schema evolution becomes coupled.
**Instead:** Dedicated `arena_runs`, `arena_messages`, `arena_grades` tables.

### Anti-Pattern 5: Polling for Manual Mode
**What:** Server holds connection open and polls for user input.
**Why bad:** Ties up server resources. HTTP request timeout issues. Complex state management for "waiting for input".
**Instead:** Manual mode uses per-turn request-response. No long-lived SSE stream for manual mode. User submits a turn, gets Challenger response, submits next turn.

## Frontend Component Hierarchy

```
ArenaPage (src/app/arena/page.tsx)
  |
  +-- ArenaView (src/components/arena/ArenaView.tsx)
        |
        +-- WorldSidebar
        |     +-- WorldGroup
        |           +-- LevelItem (locked/unlocked/passed/active states)
        |
        +-- ArenaContent (right panel, switches between views)
              |
              +-- LevelDetailView (before run starts)
              |     +-- LevelHeader (name, difficulty badge, max turns, pass threshold)
              |     +-- RubricDisplay (core items + bonus items)
              |     +-- StartButton / DemoTabs
              |
              +-- RunChatView (during active run)
              |     +-- MessageList (gatekeeper + challenger bubbles)
              |     +-- ManualInputBar (only in manual mode)
              |     +-- RunProgress (turn counter, status)
              |
              +-- GradeReportView (after run completes)
                    +-- ScoreHeader (total score, pass/fail badge, stars)
                    +-- Highlight (best performance callout)
                    +-- CoreItemsList (scores per dimension)
                    +-- BonusItemsList (scores per dimension)
                    +-- SuggestionsList (improvement advice)
                    +-- ActionButtons (Retry / Next Level)
```

## Suggested Build Order

Dependencies flow bottom-up. Build foundational layers first, then compose.

### Phase 1: Data Foundation
**Build:** Database schema + Level Loader + Level JSON configs (1-2 sample levels)
**Why first:** Everything depends on data structures. Schema defines the contract. Level configs validate the data model against real content.
**Deliverable:** `arena_*` tables in db.ts, `level-loader.ts`, sample world + levels in `src/data/arena/`

### Phase 2: Orchestration Core (no UI)
**Build:** Gatekeeper, Challenger, Grader modules + RunOrchestrator + SSE Emitter
**Why second:** This is the engine. It depends on Phase 1 (configs, DB) and the existing `text-generator.ts`. Can be tested in isolation via curl or a simple test script without any UI.
**Deliverable:** `orchestrator.ts`, `gatekeeper.ts`, `challenger.ts`, `grader.ts`, `sse-emitter.ts`. Testable via POST to API route.

### Phase 3: API Routes
**Build:** All `/api/arena/*` routes
**Why third:** Routes are thin wrappers around the orchestrator and DB queries. Depends on Phase 1 (DB) and Phase 2 (orchestrator).
**Deliverable:** Full REST API surface. Can be tested with curl/Postman.

### Phase 4: Frontend -- Chat + Grading Views
**Build:** ArenaView, RunChatView, GradeReportView, SSE consumer hook
**Why fourth:** UI depends on API shape (Phase 3) and data models (Phase 1). The chat view needs the SSE event format from Phase 2.
**Deliverable:** Working auto-mode end-to-end flow. User can start a run, watch conversation, see grade.

### Phase 5: Frontend -- Navigation + Level Selection
**Build:** WorldSidebar, LevelDetailView, progress tracking, NavRail integration
**Why fifth:** Navigation chrome around the core experience. Depends on the progress API (Phase 3) and level configs (Phase 1).
**Deliverable:** Full sidebar with world/level hierarchy, lock/unlock states, level detail pages.

### Phase 6: Manual Gatekeeper Mode
**Build:** ManualInputBar, per-turn API routes, manual-mode orchestration path
**Why last:** Additive feature on top of the working auto-mode. Different interaction pattern (request-response vs SSE stream) that can be developed independently.
**Deliverable:** Manual mode fully functional.

### Build Order Dependency Graph

```
Phase 1 (Data)
    |
    v
Phase 2 (Orchestrator)
    |
    v
Phase 3 (API Routes)
    |
    +--------+--------+
    |                  |
    v                  v
Phase 4 (Chat+Grade)  Phase 5 (Navigation)
    |                  |
    +--------+--------+
             |
             v
      Phase 6 (Manual Mode)
```

Phases 4 and 5 can be parallelized since they depend on the same foundation (Phases 1-3) but don't depend on each other.

## Scalability Considerations

| Concern | Current (single user Electron) | If scaled to multi-user |
|---------|-------------------------------|------------------------|
| Concurrent runs | One at a time per user (adequate) | Would need run queue + worker pool |
| LLM cost | 3-8 LLM calls per run (Gatekeeper turns + Challenger turns + 1 Grader) | Rate limiting, cost estimation before run |
| DB load | Negligible for SQLite | Would need PostgreSQL for concurrent writes |
| SSE connections | One per active run (adequate) | Would need connection pooling |

For v1 (single-user Electron app), none of these are concerns. The architecture does not preclude future scaling but does not over-engineer for it.

## Sources

- CodePilot codebase analysis: `src/lib/text-generator.ts`, `src/lib/provider-resolver.ts`, `src/lib/stream-session-manager.ts`, `src/app/api/chat/route.ts`
- [Vercel AI SDK Agents Documentation](https://ai-sdk.dev/docs/agents/overview) -- agent loop patterns, generateText/streamText usage
- [Vercel AI SDK Loop Control](https://ai-sdk.dev/docs/agents/loop-control) -- stopWhen, prepareStep patterns
- [AI SDK 6 announcement](https://vercel.com/blog/ai-sdk-6) -- latest SDK capabilities
- [Evaluating LLM-based Agents for Multi-Turn Conversations: A Survey](https://arxiv.org/abs/2503.22458) -- evaluation architecture patterns
- [Agent Arena (Berkeley)](https://gorilla.cs.berkeley.edu/blogs/14_agent_arena.html) -- arena platform architecture reference
- [SSE streaming for AI agents](https://akanuragkumar.medium.com/streaming-ai-agents-responses-with-server-sent-events-sse-a-technical-case-study-f3ac855d0755) -- SSE architecture patterns
- Arena mockup images: `images/level_1_*.png`, `images/level_3_*.png` -- UI expectations, grading schema
