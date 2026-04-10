---
phase: 01-orchestration-engine
plan: 04
subsystem: api
tags: [sse, next-api-routes, arena, streaming, authentication]

# Dependency graph
requires:
  - phase: 01-orchestration-engine/plan-03
    provides: "runArenaOrchestration async generator, ArenaSSEEvent, formatArenaSSE"
  - phase: 01-orchestration-engine/plan-02
    provides: "loadAllWorlds, LoadedWorld, LoadedLevel, LevelConfig"
provides:
  - "POST /api/arena/run SSE endpoint for starting Arena runs"
  - "GET /api/arena/levels JSON endpoint for listing worlds and levels"
affects: [phase-02-ui, arena-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Arena SSE stream via ReadableStream + async generator", "Arena API auth via requireAuth()"]

key-files:
  created:
    - src/app/api/arena/run/route.ts
    - src/app/api/arena/levels/route.ts
    - src/__tests__/unit/arena-api-levels.test.ts
  modified: []

key-decisions:
  - "Used requireAuth() from src/lib/auth.ts instead of inline token check -- consistent with project's existing chat route pattern"
  - "ReadableStream<string> with formatArenaSSE -- follows same pattern as chat SSE stream"
  - "Strict type validation on worldId/levelId before passing to orchestrator -- defense in depth"

patterns-established:
  - "Arena API route pattern: requireAuth -> validate body -> AbortController -> ReadableStream SSE"
  - "Arena levels endpoint: loadAllWorlds() -> map to client-safe shape with rubricCount"

requirements-completed: [ORCH-05]

# Metrics
duration: 5min
completed: 2026-04-10
---

# Phase 1 Plan 04: Arena API Routes + SSE Streaming Summary

**POST /api/arena/run SSE endpoint and GET /api/arena/levels JSON endpoint exposing the orchestration engine to HTTP clients**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-10T05:26:01Z
- **Completed:** 2026-04-10T05:30:51Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- POST /api/arena/run endpoint that accepts worldId+levelId, creates a ReadableStream SSE connection, and drives a full Arena run via runArenaOrchestration async generator
- GET /api/arena/levels endpoint that returns all worlds with their levels mapped to a client-safe shape (id, name, description, maxTurns, rubricCount)
- Both endpoints use requireAuth() for authentication, matching the project's existing chat route pattern
- 4 integration tests verifying loadAllWorlds() returns correct structure backing the levels API

## Task Commits

Each task was committed atomically:

1. **Task 1: POST /api/arena/run SSE endpoint + GET /api/arena/levels endpoint** - `a3c6e70` (feat)
2. **Task 2: API levels integration tests (TDD)** - `3063fa7` (test)

## Files Created/Modified
- `src/app/api/arena/run/route.ts` - POST endpoint: parses body, validates worldId/levelId, creates AbortController for client disconnect, streams SSE events from runArenaOrchestration
- `src/app/api/arena/levels/route.ts` - GET endpoint: calls loadAllWorlds(), maps to client-safe response with rubricCount
- `src/__tests__/unit/arena-api-levels.test.ts` - 4 tests: world existence, level count/order, required fields, rubric counts

## Decisions Made
- Used `requireAuth()` from `src/lib/auth.ts` rather than inline CODEPILOT_ACCESS_TOKEN check. The chat route uses requireAuth which handles Bearer token extraction and SHA-256 hash comparison with timing-safe equality. This is more secure and consistent than a raw env var comparison.
- Added `X-Accel-Buffering: no` header to SSE response to prevent Nginx buffering in production deployments.
- Added `runtime = 'nodejs'` and `dynamic = 'force-dynamic'` exports to match existing API route conventions.
- Tests call `loadAllWorlds()` directly rather than instantiating the HTTP handler, since the API route is a thin wrapper and the data layer is what needs validation.

## Deviations from Plan

None - plan executed exactly as written.

Note: Plan specified inline auth check pattern (`process.env.CODEPILOT_ACCESS_TOKEN`), but the actual codebase uses `requireAuth()` from `src/lib/auth.ts` with Bearer token + SHA-256 hashing. Used the real pattern per plan's own note: "if project uses requireAuth(request) helper, use that instead."

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 orchestration engine is now fully exposed via HTTP API
- POST /api/arena/run provides the SSE stream Phase 2 UI will consume
- GET /api/arena/levels provides the world/level listing Phase 2 UI will display
- All 529 tests passing (525 existing + 4 new)

## Self-Check: PASSED

- [x] src/app/api/arena/run/route.ts exists
- [x] src/app/api/arena/levels/route.ts exists
- [x] src/__tests__/unit/arena-api-levels.test.ts exists
- [x] .planning/phases/01-orchestration-engine/01-04-SUMMARY.md exists
- [x] Commit a3c6e70 found in git log
- [x] Commit 3063fa7 found in git log

---
*Phase: 01-orchestration-engine*
*Completed: 2026-04-10*
