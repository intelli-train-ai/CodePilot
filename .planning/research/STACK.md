# Technology Stack — Arena (Agent Testing Framework)

**Project:** Arena (multi-agent conversation orchestration + evaluation)
**Researched:** 2026-04-10
**Context:** Incremental feature within CodePilot (Electron + Next.js 16 + Vercel AI SDK 6)

## Guiding Principle

Arena adds **zero new LLM infrastructure**. The existing `text-generator.ts` + `provider-resolver.ts` chain already supports streaming text from any configured provider. Arena needs only: (1) a conversation orchestration loop on the server, (2) structured output for grading, (3) schema validation for level configs, and (4) SSE streaming to the frontend.

---

## Recommended Stack

### New Direct Dependencies

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| zod | ^4.3 | Level config validation, grading schema, structured output schemas | Already a transitive dep via `@anthropic-ai/claude-agent-sdk` (used in `widget-guidelines.ts`), but NOT a direct dependency. AI SDK 6 `Output.object()` requires Zod schemas. Zod 4 is 14x faster than v3, has native `z.toJSONSchema()` for level config export, and is AI SDK 6 compatible (use >= 4.1.8 for full TS performance). | HIGH |

### Existing Dependencies to Leverage (No New Install)

| Technology | Current Version | Arena Usage | Notes |
|------------|-----------------|-------------|-------|
| `ai` (Vercel AI SDK) | 6.0.73+ | `streamText()` for Challenger/Gatekeeper streaming, `generateText()` + `Output.object()` for Grader structured output | Already installed. Arena uses the `messages` param for multi-turn conversation accumulation. `generateObject()` is deprecated in v6 -- use `generateText` with `output: Output.object({ schema })` instead. |
| `@ai-sdk/anthropic`, `@ai-sdk/openai`, etc. | Current | Provider-agnostic LLM calls via existing `text-generator.ts` | No changes needed. Arena calls `streamTextFromProvider()` / `generateTextFromProvider()` directly. |
| `better-sqlite3` | 12.6.2 | Persist arena runs, transcripts, scores | Existing pattern: add new tables to `db.ts` migration chain. Sync SQLite is fine -- Arena writes happen between LLM turns, not in hot paths. |
| `nanoid` | 5.1.6 | Generate run IDs, level instance IDs | Already installed, used across codebase. |
| `uuid` | 13.0.0 | Alternative ID generation if needed | Already installed. |
| React 19 + Radix UI + Tailwind 4 | Current | Arena UI components | Reuse existing component patterns, design tokens, layout system. |
| `motion` | 12.33.0 | Conversation bubble animations, score reveal | Already installed. Use for streaming message entry animations. |

### New Patterns Using Existing Libraries (No New Deps)

| Pattern | Implementation | Why No New Dep |
|---------|---------------|----------------|
| **Multi-turn conversation loop** | Server-side `while` loop accumulating `ModelMessage[]` array, calling `streamText()` alternately for Gatekeeper and Challenger | Vercel AI SDK `streamText({ messages })` natively accepts conversation history. No orchestration framework needed for a 2-agent turn-taking loop. |
| **Structured grading output** | `generateText({ output: Output.object({ schema: gradeSchema }), messages: transcript })` | AI SDK 6 unified `Output.object()` replaces deprecated `generateObject()`. Works with Zod schemas. |
| **SSE streaming to frontend** | Next.js API route returning `new Response(readableStream, { headers: { 'Content-Type': 'text/event-stream' } })` | Existing pattern in `src/app/api/chat/route.ts`. Arena follows identical pattern with custom SSE event types. |
| **JSON level config loading** | `fs.readFileSync()` + `zodSchema.parse()` | Node.js built-in + Zod. Level configs are static JSON files, not database records. |
| **AbortController for run cancellation** | `new AbortController()` passed to `streamText({ abortSignal })` | Existing pattern in chat route. Each Arena run gets its own AbortController. |

---

## Architecture Decisions

### 1. Conversation Orchestration: Plain Loop, Not a Framework

**Decision:** Implement the Gatekeeper-Challenger turn-taking loop as a plain `async` function with a `while` loop, not with LangGraph, CrewAI, or any multi-agent framework.

**Rationale:**
- Arena has exactly 2 conversational agents (Gatekeeper, Challenger) in a strict alternating pattern. This is a `while` loop, not a graph.
- A third role (Grader) runs once after conversation ends -- a single `generateText()` call.
- Adding LangGraph (@langchain/langgraph) would introduce a heavy dependency tree (~15+ packages) for what amounts to: `while (!done) { gatekeeper(); challenger(); }`.
- The Vercel AI SDK already handles streaming, abort, message history, and provider abstraction. A framework on top adds abstraction without value.
- If Arena later needs complex multi-agent topologies (supervisor patterns, parallel agents), reassess then.

**Confidence:** HIGH -- verified that the AI SDK `streamText({ messages })` accepts accumulated `ModelMessage[]` arrays for multi-turn conversations.

### 2. Structured Output: `generateText` + `Output.object()`, Not `generateObject()`

**Decision:** Use `generateText({ output: Output.object({ schema }) })` for grading.

**Rationale:**
- `generateObject()` and `streamObject()` are deprecated in AI SDK 6.0 (will be removed in a future version).
- The unified approach lets grading combine `messages` (full transcript) with structured output in a single call.
- `Output.object()` validates the response against the Zod schema automatically, throwing `AI_NoObjectGeneratedError` on parse failure.

**Confidence:** HIGH -- verified via AI SDK 6 migration guide and official docs.

### 3. Schema Validation: Zod 4, Not AJV or JSON Schema Libraries

**Decision:** Use Zod 4 for all schema validation (level configs, grading output, API request validation).

**Rationale:**
- Zod is the native schema language for AI SDK `Output.object()`. Using it for level config validation too means one schema language everywhere.
- Zod 4 has native `z.toJSONSchema()` -- if level configs need to be exported/shared as JSON Schema later, Zod generates it.
- Zod 4 is 14x faster than v3, has 57% smaller bundle, and has first-class TypeScript inference.
- AJV is an alternative JSON Schema validator, but introduces a separate schema language. Zod lets you define the schema once and get both TypeScript types and validation.
- Already a transitive dependency (used in `widget-guidelines.ts`, `cli-tools-mcp.ts`, etc. via `claude-agent-sdk`).

**Version note:** Use Zod >= 4.1.8 to avoid TypeScript performance issues with AI SDK. The latest is 4.3.6.

**Confidence:** HIGH -- verified Zod 4 compatibility with AI SDK 6 via GitHub discussion #7289.

### 4. Streaming Architecture: SSE with Custom Event Types

**Decision:** Use the same SSE pattern as the existing chat route (`text/event-stream` Response), but with Arena-specific event types.

**Proposed SSE event types for Arena:**
```typescript
type ArenaSSEEvent =
  | { type: 'turn_start'; role: 'gatekeeper' | 'challenger'; turnIndex: number }
  | { type: 'text'; role: 'gatekeeper' | 'challenger'; data: string }
  | { type: 'turn_end'; role: 'gatekeeper' | 'challenger'; turnIndex: number }
  | { type: 'conversation_end'; reason: 'gatekeeper_decided' | 'max_turns' | 'error' }
  | { type: 'grading_start' }
  | { type: 'grade_result'; data: GradeResult }
  | { type: 'error'; message: string }
  | { type: 'done' }
```

**Rationale:**
- Matches existing pattern (chat route uses `SSEEvent` with `type` + `data` fields).
- SSE is simpler than WebSocket for this use case (server pushes turns; client only sends start/cancel).
- Client only needs to `POST /api/arena/run` and consume the SSE stream. Cancellation via `AbortController`.
- The existing `ws` package is for WebSocket connections to external services (Discord), not client-server streaming.

**Confidence:** HIGH -- existing pattern in `src/app/api/chat/route.ts` lines 249-255.

### 5. Level Config Format: Static JSON Files with Zod Validation

**Decision:** Level configs are JSON files on disk, validated at load time with Zod schemas. Not stored in SQLite.

**Rationale:**
- PROJECT.md explicitly states: "JSON 文件配置，不做可视化编辑界面" (JSON file config, no visual editor).
- JSON files are version-controllable, shareable, and editable with any text editor.
- Zod validates at load time -- invalid configs fail fast with clear error messages.
- Run results (transcripts, scores) go in SQLite. Config definitions stay as files.

**File structure:**
```
src/arena/worlds/
  customer-service/
    world.json          # World metadata
    level-01.json       # Level config
    level-02.json
  health-advisor/
    world.json
    level-01.json
```

**Confidence:** HIGH -- directly from project requirements.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Orchestration | Plain async loop | LangGraph / @langchain/langgraph | Massive dependency for a 2-agent loop. Arena is sequential alternation, not a graph. |
| Orchestration | Plain async loop | OpenAI Agents SDK / Swarm | Python-first, TypeScript support is limited. Adds unnecessary abstraction. |
| Schema validation | Zod 4 | AJV (JSON Schema) | Separate schema language from AI SDK. No TypeScript type inference. |
| Schema validation | Zod 4 | Valibot | AI SDK 6 supports it, but Zod is far more established and already in the codebase transitively. |
| Structured output | `generateText` + `Output.object()` | `generateObject()` | Deprecated in AI SDK 6. Will be removed. |
| Streaming | SSE via API route | WebSocket (ws) | Overkill for unidirectional server-to-client streaming. SSE matches existing chat pattern. |
| Streaming | SSE via API route | Vercel AI SDK `toDataStreamResponse()` | Designed for `useChat` hook integration. Arena needs custom event types (turn_start, grade_result), not chat-compatible data streams. |
| Database | better-sqlite3 (existing) | New database / Prisma | Adding an ORM for 3-4 new tables is unnecessary. The existing raw SQL pattern in `db.ts` is proven. |
| Level configs | JSON files | YAML files | JSON is parseable without additional deps. YAML needs `js-yaml`. JSON is sufficient for structured config. |
| Level configs | JSON files | SQLite tables | Project explicitly chose file-based config for version control and shareability. |

---

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| **LangChain / LangGraph** | The Arena's agent orchestration is a simple turn-based loop (2 agents alternating). LangGraph's graph abstraction adds complexity without benefit. The entire orchestration is ~50 lines of code with raw AI SDK calls. |
| **`generateObject()` / `streamObject()`** | Deprecated in AI SDK 6.0. Use `generateText` + `Output.object()` instead. The codebase should not adopt APIs that are being removed. |
| **Zod 3** | Zod 4 is stable (4.3.6), 14x faster, and the recommended version. Zod 3 is legacy. AI SDK 6 supports both, but new code should use v4. |
| **Separate evaluation frameworks (promptfoo, Braintrust, etc.)** | These are standalone CLI/SaaS tools for prompt evaluation. Arena is a custom UI-integrated testing framework with its own grading system. These tools solve a different problem (offline batch evaluation). |
| **React Server Components for streaming** | The Arena conversation display needs client-side state management (message list, scroll position, animation). RSC streaming is for initial page renders, not interactive real-time UI. Use a client component consuming SSE. |
| **`useChat` hook from AI SDK** | Designed for human-to-AI chat. Arena's conversation is AI-to-AI with the human observing. The `useChat` hook's message format and interaction model don't fit. Build a custom `useArenaRun` hook instead. |

---

## Installation

```bash
# Single new dependency
npm install zod@^4.3

# No other new dependencies needed -- everything else is already installed
```

**Dev dependencies:** None new required. Existing TypeScript, ESLint, and Playwright cover Arena code.

---

## Key API Surfaces for Arena

### 1. Conversation Turn (Challenger/Gatekeeper)

```typescript
import { streamText } from 'ai';
import { Output } from 'ai';

// Streaming a turn (Challenger or Gatekeeper)
const result = streamText({
  model: resolvedModel,
  system: roleSystemPrompt,     // Challenger prompt or Gatekeeper prompt from level config
  messages: conversationHistory, // Accumulated ModelMessage[] array
  maxOutputTokens: 4096,
  abortSignal: controller.signal,
});

for await (const chunk of result.textStream) {
  // SSE push to client: { type: 'text', role: currentRole, data: chunk }
}
```

### 2. Grading (Structured Output)

```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';

const gradeSchema = z.object({
  passed: z.boolean().describe('Overall pass/fail'),
  mandatory: z.array(z.object({
    criterion: z.string(),
    passed: z.boolean(),
    evidence: z.string(),
  })).describe('Must-pass criteria'),
  performance: z.array(z.object({
    criterion: z.string(),
    grade: z.enum(['A', 'B', 'C', 'D']),
    feedback: z.string(),
  })).describe('Performance ratings'),
  summary: z.string().describe('Overall improvement suggestions'),
});

const { output } = await generateText({
  model: resolvedModel,
  system: graderSystemPrompt,  // From level config
  messages: fullTranscript,     // Complete Gatekeeper-Challenger conversation
  output: Output.object({ schema: gradeSchema }),
});
// output is fully typed: { passed, mandatory, performance, summary }
```

### 3. Level Config Validation

```typescript
import { z } from 'zod';

const levelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  worldId: z.string(),
  order: z.number().int().positive(),
  scenario: z.string().describe('Situation description for the Challenger'),
  challengerPrompt: z.string().describe('System prompt for the Challenger agent'),
  gatekeeperPrompt: z.string().describe('System prompt for the Gatekeeper agent'),
  graderPrompt: z.string().describe('System prompt for the Grader'),
  maxTurns: z.number().int().positive().default(20),
  gradingCriteria: z.object({
    mandatory: z.array(z.object({
      criterion: z.string(),
      description: z.string(),
    })),
    performance: z.array(z.object({
      criterion: z.string(),
      description: z.string(),
    })),
  }),
});

type LevelConfig = z.infer<typeof levelConfigSchema>;

// Load and validate
const raw = JSON.parse(fs.readFileSync(levelPath, 'utf-8'));
const config = levelConfigSchema.parse(raw); // Throws ZodError on invalid
```

---

## Sources

- [AI SDK 6 announcement](https://vercel.com/blog/ai-sdk-6) -- unified `Output.object()`, deprecated `generateObject()`
- [AI SDK 6 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) -- breaking changes, `ModelMessage` type
- [AI SDK Core: streamText reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) -- `messages` param, `textStream`, `abortSignal`
- [AI SDK Core: generateText reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) -- `output` param with `Output.object()`
- [AI SDK Core: Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) -- `Output.object()` usage with Zod
- [AI SDK Core: Output reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/output) -- `Output.object()`, `Output.array()`, `Output.choice()`
- [Zod 4 release notes](https://zod.dev/v4) -- performance improvements, `z.toJSONSchema()`, breaking changes
- [Zod + AI SDK compatibility discussion](https://github.com/vercel/ai/discussions/7289) -- Zod 4 with AI SDK 6
- [AI SDK Zod incompatibility issue](https://github.com/vercel/ai/issues/7189) -- use Zod >= 4.1.8
- Existing codebase: `src/lib/text-generator.ts`, `src/app/api/chat/route.ts` (SSE pattern), `src/lib/widget-guidelines.ts` (Zod usage via claude-agent-sdk)
