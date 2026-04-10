---
phase: 01-orchestration-engine
plan: 03
subsystem: engine
tags: [vercel-ai-sdk, async-generator, structured-output, token-tracking, orchestration]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Arena types, DB CRUD, formatArenaSSE, streamTextFromProvider messages extension"
  - phase: 01-02
    provides: "Zod schemas (GatekeeperOutputSchema, GraderOutputSchema, LevelConfigSchema), level-loader"
provides:
  - "buildAiModel shared model builder for all Arena roles"
  - "callGatekeeper with structured output + retry logic"
  - "callChallenger as async generator yielding deltas + returning real usage"
  - "callGrader with Zod-validated grading output"
  - "TokenTracker with 200K default budget and Grader reserve"
  - "runArenaOrchestration core while-loop driving full Arena runs"
affects: [01-04, 02-ui-layer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependency injection for orchestrator testability (OrchestrationDeps interface)"
    - "Async generator for Challenger streaming (yield deltas, return result)"
    - "DB-first event ordering (save to DB before yielding SSE events)"
    - "Real usage tracking from AI SDK result.usage (not placeholder zeros)"

key-files:
  created:
    - src/arena/engine/model-builder.ts
    - src/arena/engine/gatekeeper.ts
    - src/arena/engine/challenger.ts
    - src/arena/engine/grader.ts
    - src/arena/engine/token-tracker.ts
    - src/arena/engine/orchestrator.ts
    - src/__tests__/unit/arena-token-tracker.test.ts
    - src/__tests__/unit/arena-orchestrator.test.ts
  modified: []

key-decisions:
  - "Used dependency injection for orchestrator instead of mock.module -- tsx path aliases break Node test runner module mocking"
  - "AI SDK LanguageModelUsage uses inputTokens/outputTokens (not promptTokens/completionTokens) -- adapted all role modules"
  - "Token budget check uses strictly-greater-than for GRADER_RESERVE boundary (8000 remaining with 8000 reserve = not enough)"

patterns-established:
  - "OrchestrationDeps: dependency injection interface for testing orchestrator without LLM/DB"
  - "AsyncGenerator<ChallengerDelta, ChallengerResult>: yield streaming deltas, return final result with usage"
  - "DB-first SSE: saveArenaMessage/saveArenaGrade before yielding corresponding events"

requirements-completed: [ORCH-01, ORCH-02, ORCH-03, ORCH-04, GRAD-01, GRAD-04, GRAD-05]

# Metrics
duration: 14min
completed: 2026-04-10
---

# Phase 1 Plan 3: Orchestration Engine Core Summary

**Three-role Arena engine with Gatekeeper structured output + retry, Challenger async generator streaming, Grader Zod-validated evaluation, 200K token budget tracker, and while-loop orchestrator with 4 termination conditions**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-10T05:06:15Z
- **Completed:** 2026-04-10T05:20:27Z
- **Tasks:** 2
- **Files created:** 8

## Accomplishments
- Built shared model builder extracting AI SDK provider resolution from text-generator.ts pattern
- Implemented 3 role modules: Gatekeeper (structured output + D-02 retry), Challenger (async generator with real usage), Grader (Zod-validated one-shot evaluation with turn references)
- Implemented TokenTracker with 200,000 default budget, Grader reserve, and exhaustion detection
- Built core orchestration loop with 4 termination conditions and DB-first event ordering
- Full TDD coverage: 14 passing tests (7 token-tracker + 7 orchestrator)

## Task Commits

Each task was committed atomically:

1. **Task 1: Model Builder + Gatekeeper + Challenger + Grader** - `b915ae5` (feat)
2. **Task 2 RED: Failing tests** - `d8af15c` (test)
3. **Task 2 GREEN: Token Tracker + Orchestrator implementation** - `64c9369` (feat)

## Files Created/Modified
- `src/arena/engine/model-builder.ts` - Shared AI SDK model builder using resolveProvider + toAiSdkConfig
- `src/arena/engine/gatekeeper.ts` - Gatekeeper LLM call with generateText + Output.object() + retry
- `src/arena/engine/challenger.ts` - Challenger async generator yielding deltas, returning fullContent + real usage
- `src/arena/engine/grader.ts` - Grader one-shot evaluation with GraderOutputSchema + rubric prompt builder
- `src/arena/engine/token-tracker.ts` - Token budget tracking with 200K default and 8K Grader reserve
- `src/arena/engine/orchestrator.ts` - Core while-loop orchestration with dependency injection
- `src/__tests__/unit/arena-token-tracker.test.ts` - 7 tests for TokenTracker logic
- `src/__tests__/unit/arena-orchestrator.test.ts` - 7 tests for orchestration loop via DI mocks

## Decisions Made
- **Dependency injection over mock.module:** Node test runner's mock.module doesn't work with tsx path aliases (@/), so the orchestrator accepts an optional OrchestrationDeps parameter. Production callers pass no deps (uses real modules), tests inject mocks directly. This is cleaner than runtime patching.
- **AI SDK usage field names:** Discovered LanguageModelUsage uses `inputTokens`/`outputTokens` (not `promptTokens`/`completionTokens` as in the plan). Adapted all three role modules with nullish coalescing (`?? 0`) for safety.
- **GRADER_RESERVE boundary:** Token budget check for next turn uses `remaining > GRADER_RESERVE` (strictly greater), so exactly 8000 remaining with 8000 reserve = not enough. This prevents Grader from running out of tokens.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AI SDK usage property names**
- **Found during:** Task 1 (Role modules implementation)
- **Issue:** Plan specified `promptTokens`/`completionTokens` but AI SDK LanguageModelUsage uses `inputTokens`/`outputTokens`, and `totalTokens` is `number | undefined`
- **Fix:** Changed to `usage.inputTokens ?? 0`, `usage.outputTokens ?? 0`, `usage.totalTokens ?? 0` in all three role modules
- **Files modified:** gatekeeper.ts, challenger.ts, grader.ts
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** b915ae5

**2. [Rule 3 - Blocking] Dependency injection for orchestrator testability**
- **Found during:** Task 2 (Orchestrator tests)
- **Issue:** Node test runner mock.module fails with tsx path aliases (@/ imports), making module-level mocking impossible
- **Fix:** Added OrchestrationDeps interface to orchestrator with optional second parameter for dependency injection. Tests pass mocks directly instead of intercepting module imports
- **Files modified:** orchestrator.ts, arena-orchestrator.test.ts
- **Verification:** All 7 orchestrator tests pass
- **Committed in:** 64c9369

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. DI pattern improves testability beyond what mock.module would have provided. No scope creep.

## Issues Encountered
- Pre-existing arena-db test failures (7 tests) unrelated to this plan -- DB initialization issue in test environment from wave 1. Not addressed here.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 engine modules ready for Plan 04 (SSE API route)
- Orchestrator's async generator output can be directly piped to SSE response
- Provider resolution works end-to-end through buildAiModel

## Self-Check: PASSED

All 8 created files verified on disk. All 3 commits (b915ae5, d8af15c, 64c9369) verified in git history.

---
*Phase: 01-orchestration-engine*
*Completed: 2026-04-10*
