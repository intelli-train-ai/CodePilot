# Phase 1: Orchestration Engine - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend core engine: three-role (Gatekeeper/Challenger/Grader) conversation loop, grading system with mixed scoring, data persistence to SQLite, level config loading and validation from JSON files, SSE streaming for auto mode, and text-generator.ts extension for multi-turn messages.

</domain>

<decisions>
## Implementation Decisions

### Orchestration Loop
- **D-01:** Single API call with synchronous while-loop drives the entire run. One request starts a run, the internal loop alternates Gatekeeper→Challenger until termination. SSE stream pushes progress in real time. Matches the existing chat streaming pattern in the codebase.
- **D-02:** Gatekeeper structured output parse failure: retry once, then terminate the run with an error record if parsing fails again. Balances reliability with resource consumption.
- **D-03:** Token budget (ORCH-04): default 200,000 tokens per run, counting input+output across all three roles (Gatekeeper + Challenger + Grader). Level config can override via `maxTokens` field.

### Level Config Organization
- **D-04:** Level JSON files are bundled inside the application codebase (e.g., `src/arena/levels/`), shipped with the app. No user-directory discovery in v1.
- **D-05:** Directory structure uses world-folder grouping: each world is a folder containing `world.json` (world metadata) plus individual level JSON files (e.g., `levels/customer-service/world.json` + `level-01.json`).
- **D-06:** v1 ships with 1 example world containing 2-3 progressive levels, sufficient to validate sequential unlock and grading flow.

### Claude's Discretion
- SSE event protocol design (event types, payload format) -- Claude determines the contract between Phase 1 and Phase 2
- Role model assignment mechanism (INTG-02: three roles independently select provider/model) -- Claude determines the configuration approach
- Database schema column details for `arena_runs`, `arena_messages`, `arena_grades` tables
- Grader prompt engineering for reliable structured output
- Level JSON schema field design beyond what's specified in requirements

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` -- Full requirement definitions for ORCH-01~06, GRAD-01~05, DATA-01~04, LEVL-01~02, INTG-01~02

### Project Context
- `.planning/PROJECT.md` -- Project vision, constraints, key decisions, tech context
- `.planning/ROADMAP.md` -- Phase 1 goal, success criteria, dependency graph

### Existing Code (reuse targets)
- `src/lib/text-generator.ts` -- Current text generation utility; ORCH-06 requires extending to support `messages: ModelMessage[]`
- `src/lib/provider-resolver.ts` -- Provider configuration resolution; fully reusable for INTG-01
- `src/lib/db.ts` -- Database schema, CRUD, migration patterns; Arena tables follow this pattern
- `src/lib/stream-session-manager.ts` -- SSE stream lifecycle management; reference for Arena SSE design

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `text-generator.ts` (`streamTextFromProvider`): Streams text from any configured provider. Currently accepts `prompt: string`; needs extension for `messages: ModelMessage[]` (ORCH-06). Provider resolution, model creation, and streaming infrastructure are all reusable.
- `provider-resolver.ts` (`resolveProvider`, `toAiSdkConfig`): Unified provider resolution chain. Directly usable for INTG-01 -- Arena roles can resolve providers through this same path.
- `db.ts`: SQLite database with established migration pattern (version checks + ALTER TABLE). Arena tables follow the same pattern.
- `stream-session-manager.ts`: SSE lifecycle management with `globalThis` singleton. Reference pattern for Arena's SSE streaming, though Arena will likely need its own simpler stream since it doesn't involve SDK conversations.

### Established Patterns
- API routes use Next.js App Router in `src/app/api/` with `authFetch` authentication
- SSE streams use `ReadableStream` + `TextEncoder` pattern
- Database operations are synchronous (better-sqlite3)
- Zod is available for schema validation (used in existing codebase)
- Error classification follows structured categories in `error-classifier.ts`

### Integration Points
- New API route: `src/app/api/arena/` for orchestration endpoints
- New database tables in `src/lib/db.ts` migration chain
- `text-generator.ts` extension for multi-turn message support
- Level JSON files in new `src/arena/levels/` directory

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches for SSE protocol, database schema, and Grader prompt design.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 01-orchestration-engine*
*Context gathered: 2026-04-10*
