---
phase: 01-orchestration-engine
reviewed: 2026-04-10T12:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - src/app/api/arena/levels/route.ts
  - src/app/api/arena/run/route.ts
  - src/arena/db.ts
  - src/arena/engine/challenger.ts
  - src/arena/engine/gatekeeper.ts
  - src/arena/engine/grader.ts
  - src/arena/engine/model-builder.ts
  - src/arena/engine/orchestrator.ts
  - src/arena/engine/token-tracker.ts
  - src/arena/level-loader.ts
  - src/arena/levels/customer-service/level-01.json
  - src/arena/levels/customer-service/level-02.json
  - src/arena/levels/customer-service/world.json
  - src/arena/schemas/gatekeeper-output.ts
  - src/arena/schemas/grader-output.ts
  - src/arena/schemas/level-config.ts
  - src/arena/types.ts
  - src/lib/db.ts
  - src/lib/text-generator.ts
  - src/__tests__/unit/arena-api-levels.test.ts
  - src/__tests__/unit/arena-db.test.ts
  - src/__tests__/unit/arena-level-loader.test.ts
  - src/__tests__/unit/arena-orchestrator.test.ts
  - src/__tests__/unit/arena-token-tracker.test.ts
  - src/__tests__/unit/text-generator-messages.test.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

The Arena orchestration engine is well-structured with clear separation of concerns: level loading, LLM calls (gatekeeper/challenger/grader), token tracking, DB persistence, and SSE streaming. The code follows a consistent DB-first pattern, uses Zod schemas for config validation, and has good dependency injection for testability.

Key concerns:
1. The SSE stream in the run API route enqueues raw strings instead of encoded bytes, which will break in runtime environments that require `Uint8Array` for `ReadableStream` bodies.
2. The `challengerResult` variable is used via non-null assertion (`!`) after a loop that could theoretically leave it undefined if the generator never reaches `done=true`.
3. Level loader rereads all worlds from disk on every `loadLevel()` call, and JSON parse errors in level files produce uncaught exceptions that could crash the process.
4. Several `as unknown as` type casts in the orchestrator default deps suppress type safety at module boundaries.

## Critical Issues

### CR-01: SSE ReadableStream enqueues raw strings instead of encoded bytes

**File:** `src/app/api/arena/run/route.ts:61-74`
**Issue:** The `ReadableStream<string>` enqueues raw string values via `controller.enqueue(formatArenaSSE(event))`. The Web Streams API `Response` constructor expects a `ReadableStream<Uint8Array>` for the body. While some runtimes (Node.js) may tolerate `ReadableStream<string>`, this is not guaranteed and will fail in stricter environments. All other SSE routes in this codebase (e.g., `src/app/api/skills/marketplace/install/route.ts:29-34`) correctly use `TextEncoder` to encode strings before enqueuing.

**Fix:**
```typescript
const encoder = new TextEncoder();

const stream = new ReadableStream({
  async start(controller) {
    try {
      const orchestration = runArenaOrchestration({
        worldId: body.worldId,
        levelId: body.levelId,
        defaultProviderId: body.providerId,
        defaultModel: body.model,
        abortSignal: abortController.signal,
      });

      for await (const event of orchestration) {
        try {
          controller.enqueue(encoder.encode(formatArenaSSE(event)));
        } catch {
          break;
        }
      }
    } catch (err) {
      try {
        controller.enqueue(encoder.encode(formatArenaSSE({
          type: 'run_error',
          data: { error: err instanceof Error ? err.message : String(err) },
        })));
      } catch { /* controller already closed */ }
    } finally {
      try { controller.close(); } catch { /* already closed */ }
    }
  },
});
```

## Warnings

### WR-01: Non-null assertion on potentially undefined challengerResult

**File:** `src/arena/engine/orchestrator.ts:240`
**Issue:** `challengerResult` is declared as `ChallengerResult | undefined` on line 227 and consumed via `challengerResult!.usage.totalTokens` on line 240. While the current `callChallenger` implementation always returns a value when `done=true`, if a custom injected implementation (or future refactor) returns `undefined` from the generator return, the non-null assertion will cause a runtime TypeError crash. The same pattern repeats on lines 245, 248-250, 254, 258.

**Fix:** Add an explicit guard before using the result:
```typescript
if (!challengerResult) {
  terminationReason = 'error';
  d.saveArenaMessage({
    runId: run.id,
    role: 'system',
    content: 'Challenger returned no result',
    turnNumber: turn,
  });
  yield { type: 'run_error', data: { error: 'Challenger returned no result', turn } };
  break;
}
```

### WR-02: Level loader JSON.parse without try-catch can crash process

**File:** `src/arena/level-loader.ts:48`
**Issue:** `JSON.parse(fs.readFileSync(worldJsonPath, 'utf-8'))` on line 48 and `JSON.parse(fs.readFileSync(levelPath, 'utf-8'))` on line 62 will throw a `SyntaxError` if the JSON file is malformed (not just schema-invalid, but syntactically broken JSON). This unhandled exception propagates up and could crash the server. The Zod `safeParse` below only catches schema validation errors, not JSON parse errors.

**Fix:** Wrap each `JSON.parse` in a try-catch that produces a clear error message:
```typescript
let worldRaw;
try {
  worldRaw = JSON.parse(fs.readFileSync(worldJsonPath, 'utf-8'));
} catch (err) {
  throw new Error(`[arena] Invalid JSON in ${entry.name}/world.json: ${err instanceof Error ? err.message : String(err)}`);
}
```

### WR-03: Grader call has no retry logic -- single parse failure crashes the run

**File:** `src/arena/engine/grader.ts:50-59`
**Issue:** The Gatekeeper has retry logic (attempt up to 2 times on parse failure, per D-02), but the Grader has none. If `result.output` is null (structured output parse failure), line 59 throws an error that propagates to the orchestrator's catch block, marking the run as `failed`. Since the Grader runs after the entire conversation is complete, a transient parse failure discards all conversation data and token usage without a retry attempt.

**Fix:** Add retry logic similar to the Gatekeeper:
```typescript
for (let attempt = 0; attempt < 2; attempt++) {
  const result = await generateText({ /* ... */ });
  if (result.output) {
    return { output: result.output, usage: { /* ... */ } };
  }
  if (attempt === 0) continue; // retry once
}
throw new Error('[arena:grader] Failed to generate structured grading output after 2 attempts');
```

### WR-04: process.env mutation in model-builder is not safe for concurrent requests

**File:** `src/arena/engine/model-builder.ts:38-39`
**Issue:** `process.env[k] = v` mutates global state. If two Arena runs execute concurrently with different Bedrock/Vertex credentials (e.g., different `AWS_REGION` values), they will race on `process.env` and one run may use the other's credentials. This is the same pattern as `text-generator.ts`, but worth flagging because Arena runs are long-lived and concurrent runs are an expected use case.

**Fix:** This is a known limitation inherited from `text-generator.ts`. For a future fix, consider passing credentials directly to the SDK constructors instead of via `process.env`, or use a mutex around the env-set + SDK-create sequence.

### WR-05: Type safety bypassed with multiple `as unknown as` casts in orchestrator default deps

**File:** `src/arena/engine/orchestrator.ts:108-110`
**Issue:** Three default dependency assignments use `as unknown as` double casts to bypass TypeScript type checking:
- Line 108: `defaultUpdateArenaRun as unknown as OrchestrationDeps['updateArenaRun']`
- Line 109: `defaultSaveArenaMessage as unknown as OrchestrationDeps['saveArenaMessage']`
- Line 110: `defaultSaveArenaGrade as unknown as OrchestrationDeps['saveArenaGrade']`

These casts suppress type errors that indicate the `OrchestrationDeps` interface types do not match the actual function signatures. If the real functions change signature, TypeScript will not catch the mismatch, leading to silent runtime errors.

**Fix:** Align the `OrchestrationDeps` interface signatures with the actual function signatures from `../db`, so the casts become unnecessary. For example, `saveArenaMessage` in the deps interface takes `role: string` but the actual function takes `role: 'gatekeeper' | 'challenger' | 'grader' | 'system'`. The interface should use the same union type.

## Info

### IN-01: loadLevel re-reads all worlds from disk on every call

**File:** `src/arena/level-loader.ts:84-92`
**Issue:** `loadLevel()` calls `loadAllWorlds()` which reads all world directories and level JSON files from disk. For a single level lookup, this reads every level file in every world. This is called from the orchestrator on every run start.

**Fix:** Consider caching the result of `loadAllWorlds()` in a module-level variable (invalidated on file changes if needed), or loading only the requested world directory.

### IN-02: Gatekeeper retry loop consumes usage from both attempts but only the first attempt's usage may be counted

**File:** `src/arena/engine/gatekeeper.ts:47-76`
**Issue:** When the first attempt produces `result.output === null` (parse failure) and the retry succeeds, the first attempt's token usage is discarded (not accumulated). The TokenTracker only sees the second attempt's usage. This is not a bug per se (the first attempt produced no usable output), but it means actual API cost is higher than tracked.

**Fix:** If accurate cost tracking is desired, accumulate usage from both attempts:
```typescript
let accumulatedUsage = { totalTokens: 0, promptTokens: 0, completionTokens: 0 };
// In each attempt, add to accumulatedUsage before checking output
```

### IN-03: Test file uses `require()` with eslint-disable for dynamic import

**File:** `src/__tests__/unit/arena-db.test.ts:26-35`
**Issue:** The test uses `require()` with `/* eslint-disable @typescript-eslint/no-require-imports */` to import modules after setting `process.env.CLAUDE_GUI_DATA_DIR`. This is a workaround for ensuring the env var is set before module initialization, but it bypasses ESM module loading and loses type safety.

**Fix:** This is an acceptable test workaround given the constraint. Consider extracting the data dir path into a configuration function that can be called before DB initialization, which would allow normal `import` statements.

---

_Reviewed: 2026-04-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
