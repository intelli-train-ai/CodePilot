# Phase 1: Orchestration Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 01-orchestration-engine
**Areas discussed:** Orchestration Loop, Level Config Organization

---

## Orchestration Loop

### Loop Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Single call sync loop (Recommended) | One API call starts the run, internal while-loop drives Gatekeeper→Challenger back and forth. SSE stream pushes progress. Simple and matches existing chat streaming pattern | ✓ |
| Event-driven step-by-step | Each conversation turn is a separate API call, client triggers the next turn. More flexible but more complex | |
| Hybrid mode | Auto mode uses sync loop + SSE, manual mode uses step-by-step. Share core logic but different HTTP patterns | |

**User's choice:** Single call sync loop
**Notes:** None

### Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Retry once, then terminate (Recommended) | Resend Gatekeeper request once; if parsing still fails, terminate run and log error. Balances reliability and resource cost | ✓ |
| Terminate immediately | Parse failure immediately terminates run with error record. Simplest but may waste a run on transient format issues | |
| Extract text and continue | On parse failure, treat raw response as plain text message, default shouldEnd=false. Keeps conversation going but may affect grading accuracy | |

**User's choice:** Retry once, then terminate
**Notes:** None

### Token Budget

| Option | Description | Selected |
|--------|-------------|----------|
| Count all three roles (Recommended) | Gatekeeper + Challenger + Grader input/output tokens summed. Most comprehensive cost control | |
| Count Challenger only | Only count the tested agent's token consumption. Simple but doesn't reflect true cost | |
| You decide | Claude decides based on implementation complexity and best practices | |

**User's choice:** Other -- asked "what is the token limit u design?"
**Notes:** User asked for Claude's recommendation. Proposed default 100K, user requested higher. Final decision: default 200K tokens, counting all three roles, overridable per-level via `maxTokens`.

---

## Level Config Organization

### Storage Location

| Option | Description | Selected |
|--------|-------------|----------|
| App-bundled (Recommended) | Inside the code repository (e.g., src/arena/levels/), shipped with the app. Simple and direct for v1 | ✓ |
| User data directory | In ~/.codepilot/arena/levels/, user can freely add/edit levels. Flexible but needs initialization flow | |
| Dual-source merge | Built-in + user directory merged on load. Most flexible but more complex | |

**User's choice:** App-bundled
**Notes:** None

### Directory Structure

| Option | Description | Selected |
|--------|-------------|----------|
| World-folder grouping (Recommended) | Each world is a folder with world.json (metadata) + level JSON files. e.g., levels/customer-service/world.json + level-01.json | ✓ |
| Flat single-directory | All levels in one directory, world prefix in filename. Simple but unclear with many levels | |
| You decide | Claude determines structure based on actual level count and complexity | |

**User's choice:** World-folder grouping
**Notes:** None

### Example Levels

| Option | Description | Selected |
|--------|-------------|----------|
| 1 world, 2-3 levels (Recommended) | Minimum viable set to validate sequential unlock and grading flow. e.g., a "customer service" world with 2-3 progressive levels | ✓ |
| 2 worlds, 2-3 levels each | More thorough test coverage, validates world switching. But requires more content design work | |
| You decide | Claude determines appropriate quantity based on workload | |

**User's choice:** 1 world, 2-3 levels
**Notes:** None

---

## Claude's Discretion

- SSE event protocol (event types, payload format)
- Role model assignment mechanism
- Database schema column details
- Grader prompt engineering
- Level JSON schema field design
