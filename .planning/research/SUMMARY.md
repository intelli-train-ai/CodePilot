# Research Summary — Arena

**Domain:** Agent Testing/Evaluation Framework
**Synthesized:** 2026-04-10
**Confidence:** HIGH

## Executive Summary

Arena is a gamified, scenario-based AI agent testing framework embedded in CodePilot. It orchestrates three LLM roles — Gatekeeper (questioner), Challenger (agent under test), Grader (evaluator) — through a server-side conversation loop streaming results in real time. No existing tool (Promptfoo, MT-Bench, Chatbot Arena) covers this combination of scene-based progressive difficulty + desktop GUI + hybrid grading + custom JSON configs.

Implementation approach: **deliberate minimalism** — one new dependency (Zod 4), zero new LLM infrastructure (reuse `text-generator.ts` / `provider-resolver.ts`), plain async generator loop for orchestration.

## Key Findings

### Stack
- **One new dep:** `zod@^4.3` for schema validation + AI SDK `Output.object()`
- **Grading:** Use `generateText()` + `Output.object({ schema })` — `generateObject()` is deprecated
- **Blocking dependency:** Extend `text-generator.ts` with `messages: ModelMessage[]` param (current `prompt: string` interface degrades multi-turn quality)
- **Do NOT use:** LangGraph, CrewAI, `generateObject()`, `useChat` hook

### Features
- **Table stakes:** Three-role orchestration, streaming display, hybrid grading, World/Level structure, JSON configs, run history, manual Gatekeeper mode
- **Differentiators (v2):** Transcript replay, run comparison, batch mode, multi-model comparison
- **Anti-features:** Elo rankings, 1-100 numeric scores, red-teaming, crowdsourced voting

### Architecture
- **Orchestrator:** Server-side `RunOrchestrator` async generator → SSE events → API route `ReadableStream`
- **Role calls:** Gatekeeper `generateText` (non-streaming) → Challenger `streamText` (streaming) → Grader `generateText` + `Output.object`
- **Two HTTP patterns:** Auto mode = single long-lived SSE stream; Manual mode = per-turn request-response
- **Database:** Three new SQLite tables: `arena_runs`, `arena_messages`, `arena_grades`
- **Level configs:** `src/data/arena/worlds/*/` as JSON files validated with Zod

### Top Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Infinite orchestration loop | CRITICAL | Hard `maxTurns` cap + token budget + `shouldEnd` structured output |
| Grader bias | HIGH | Rubric anchoring with examples, two-pass grading, evidence citation, temperature=0 |
| SSE stream failure orphaning runs | HIGH | DB-first architecture, AbortController cleanup, partial run recovery |
| Prompt injection via Challenger | HIGH | Structured turn delimiters, anti-injection Grader prompt, input sanitization |
| `text-generator.ts` interface gap | BLOCKING | Extend with backward-compatible `messages` parameter before Phase 1 |

## Recommended Build Order

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| 1 | Data Foundation + Orchestration Core | DB schema, Zod config validation, `text-generator.ts` extension, orchestrator engine with circuit breakers |
| 2 | API Routes + Auto Mode UI | SSE routes, `RunChatView`, `GradeReportView`, `useArenaStream` hook, Grader bias mitigations |
| 3 | World Navigation + Progression | `WorldSidebar`, `LevelDetailView`, progress tracking, unlock logic, sample world content |
| 4 | Manual Gatekeeper Mode + Optimization | `ManualInputBar`, per-turn routes, token cost counter, summarization checkpoints |
| 5 | Power Features (v2) | Transcript replay, run comparison, grade visualization, level export/import |

**Phase 2 & 3 are partially parallelizable** — navigation has no dependency on the grading engine.

## Cross-Cutting Decisions Needed

1. **Gatekeeper termination signal:** Structured JSON `shouldEnd: boolean` vs. delimiter token
2. **Grader model selection:** Must differ from Challenger model to avoid self-enhancement bias
3. **Level unlock semantics:** Linear only, or support parallel branches via `prerequisites` OR logic?
4. **Provider temperature=0 support:** Not all providers support it; need fallback strategy

## Sources

- MAST study (1,642 multi-agent traces) — loop failure patterns
- "Rubric Is All You Need" 2025 — LLM grading reliability
- "Grading Scale Impact" 2025 — discrete vs. continuous scoring
- AI SDK 6 official docs — `Output.object()` API, migration guide
- Zod 4 release notes — performance, compatibility
- tau-bench — simulated user conversation termination patterns

---
*Research synthesized: 2026-04-10*
