---
phase: 01-orchestration-engine
plan: 01
subsystem: database, api
tags: [arena, sqlite, better-sqlite3, vercel-ai-sdk, text-generator, sse, crud]

# Dependency graph
requires: []
provides:
  - "StreamTextParams with optional messages field for multi-turn LLM calls"
  - "Arena type system (ArenaRun, ArenaMessage, ArenaGrade, ArenaSSEEvent, etc.)"
  - "arena_runs, arena_messages, arena_grades SQLite tables"
  - "Arena CRUD operations (createArenaRun, updateArenaRun, getArenaRun, saveArenaMessage, getArenaMessages, saveArenaGrade, getArenaGrade)"
affects: [01-orchestration-engine/02, 01-orchestration-engine/03, 01-orchestration-engine/04]

# Tech tracking
tech-stack:
  added: []
  patterns: [db-first-write-then-read, conditional-messages-vs-prompt, arena-sse-event-format]

key-files:
  created:
    - src/arena/types.ts
    - src/arena/db.ts
    - src/__tests__/unit/arena-db.test.ts
    - src/__tests__/unit/text-generator-messages.test.ts
  modified:
    - src/lib/text-generator.ts
    - src/lib/db.ts

key-decisions:
  - "Used undefined-to-null normalization in get functions because better-sqlite3 returns undefined for missing rows"
  - "Arena SSE events are separate from chat SSE events (distinct type system in arena/types.ts)"
  - "DB-first pattern: all writes return the persisted row via SELECT after INSERT/UPDATE"

patterns-established:
  - "Arena module layout: src/arena/ directory for Arena-specific code"
  - "DB-first write pattern: INSERT then SELECT to guarantee returned data matches DB state"
  - "Conditional messages/prompt in streamText: use messages when provided, fall back to prompt"

requirements-completed: [ORCH-06, DATA-01, DATA-02, DATA-03, DATA-04, INTG-01]

# Metrics
duration: 11min
completed: 2026-04-10
---

# Phase 01 Plan 01: Arena Infrastructure Summary

**text-generator.ts multi-turn messages extension + Arena type system + 3 SQLite tables with full CRUD operations**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-10T04:46:48Z
- **Completed:** 2026-04-10T04:57:33Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extended text-generator.ts StreamTextParams with optional messages array for multi-turn LLM conversations (ORCH-06), fully backward compatible with existing prompt-only callers
- Defined complete Arena type system: ArenaRole, ArenaRunStatus, TerminationReason, ArenaSSEEventType, ArenaSSEEvent, ArenaRun, ArenaMessage, ArenaGrade, formatArenaSSE
- Created arena_runs, arena_messages, arena_grades SQLite tables with CHECK constraints, foreign keys, and indexes in initDb()
- Implemented 7 CRUD functions following DB-first pattern with full unit test coverage (536 tests total, 0 failures)

## Task Commits

Each task was committed atomically:

1. **Task 1: Arena type definitions + text-generator.ts messages parameter extension** - `6b41ab7` (feat)
2. **Task 2: SQLite Arena data tables + CRUD operations** - `5b36d68` (feat)

## Files Created/Modified
- `src/arena/types.ts` - Arena type system: roles, statuses, SSE events, DB row types, formatArenaSSE helper
- `src/arena/db.ts` - Arena CRUD operations: create/update/get runs, save/get messages, save/get grades
- `src/lib/text-generator.ts` - Extended StreamTextParams with optional messages field; conditional messages-vs-prompt in streamText call
- `src/lib/db.ts` - Added arena_runs, arena_messages, arena_grades table definitions to initDb()
- `src/__tests__/unit/text-generator-messages.test.ts` - 3 tests for messages parameter acceptance and backward compatibility
- `src/__tests__/unit/arena-db.test.ts` - 8 tests for all Arena CRUD operations

## Decisions Made
- Used undefined-to-null normalization in getArenaRun/getArenaGrade because better-sqlite3 .get() returns undefined (not null) for missing rows; this maintains consistent API contract
- Arena SSE events use a separate type system from chat SSE events to avoid coupling
- Followed existing project pattern for tests: node:test + node:assert/strict with temp CLAUDE_GUI_DATA_DIR

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed undefined-vs-null in get functions**
- **Found during:** Task 2 (Arena CRUD implementation)
- **Issue:** better-sqlite3 .get() returns undefined when no row found, but API contract specifies null
- **Fix:** Added explicit `?? null` normalization in getArenaRun() and getArenaGrade()
- **Files modified:** src/arena/db.ts
- **Verification:** Tests 6 and 7 in arena-db.test.ts pass (getArenaRun returns null, getArenaGrade returns null)
- **Committed in:** 5b36d68 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for API contract correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- text-generator.ts messages extension ready for orchestrator to use multi-turn LLM calls
- Arena DB layer ready for orchestration engine to persist runs, messages, and grades
- Type system ready for import by all downstream Arena modules

---
*Phase: 01-orchestration-engine*
*Completed: 2026-04-10*
