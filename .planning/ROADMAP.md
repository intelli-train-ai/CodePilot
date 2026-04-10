# Roadmap: Arena

## Overview

Arena delivers a three-role AI agent testing framework embedded in CodePilot. The build progresses from a backend orchestration engine (the core loop of Gatekeeper/Challenger/Grader with data persistence) through auto-mode streaming UI, then world navigation with progression mechanics, and finally manual Gatekeeper mode as an alternative interaction pattern.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Orchestration Engine** - Backend core: three-role conversation loop, grading, data persistence, level config loading
- [ ] **Phase 2: Auto Mode UI** - First end-to-end user experience: SSE streaming display, grade report, sidebar entry
- [ ] **Phase 3: World Navigation & Progression** - World/level hierarchy, unlock logic, level details, run history
- [ ] **Phase 4: Manual Gatekeeper Mode** - Human-driven questioning with per-turn request-response

## Phase Details

### Phase 1: Orchestration Engine
**Goal**: The complete backend engine runs a Gatekeeper-Challenger-Grader conversation loop, persists every message and grade to SQLite, and validates level configs from JSON files
**Depends on**: Nothing (first phase)
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, ORCH-06, GRAD-01, GRAD-02, GRAD-03, GRAD-04, GRAD-05, DATA-01, DATA-02, DATA-03, DATA-04, LEVL-01, LEVL-02, INTG-01, INTG-02
**Success Criteria** (what must be TRUE):
  1. A test script can trigger a full orchestration run (Gatekeeper asks, Challenger responds, loop repeats, Grader scores) and receive structured SSE events for each step
  2. Gatekeeper terminates the conversation via structured `shouldEnd` output, and the run also terminates if maxTurns or token budget is exceeded
  3. Grader output contains per-criterion Pass/Fail results, performance-dimension grades (A/B/C/D), and up to 3 improvement suggestions -- all validated by Zod schema
  4. Every conversation message and grade result is persisted in SQLite tables (`arena_runs`, `arena_messages`, `arena_grades`) before being emitted via SSE
  5. Level JSON configs are loaded and validated at startup; invalid configs produce clear error messages
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md -- Arena 基础设施：text-generator 扩展 + 类型系统 + DB schema + CRUD
- [x] 01-02-PLAN.md -- 关卡体系：Zod schemas + level-loader + 示例世界
- [x] 01-03-PLAN.md -- 引擎核心：三角色模块 + Token Tracker + 编排循环
- [x] 01-04-PLAN.md -- API 路由：SSE 流端点 + 关卡列表端点 + 测试

### Phase 2: Auto Mode UI
**Goal**: Users can launch an auto-mode Arena run from the CodePilot sidebar and watch the Gatekeeper-Challenger conversation stream in real time, then view the grade report
**Depends on**: Phase 1
**Requirements**: UI-01, UI-02, UI-03, UI-06, INTG-03
**Success Criteria** (what must be TRUE):
  1. Arena appears as a sidebar entry alongside Chat and Plugins; clicking it opens the Arena view
  2. During an auto-mode run, Gatekeeper messages appear on the left and Challenger messages stream token-by-token on the right in real time
  3. After a run completes, the grade report shows pass/fail status, per-criterion results, performance grades, and improvement suggestions
  4. All UI text is available in both Chinese and English
  5. Arena 启动页提供高级选项，用户可为 Gatekeeper、Challenger、Grader 分别选择 provider 和 model（默认继承全局配置）
**Plans**: TBD
**UI hint**: yes

### Phase 3: World Navigation & Progression
**Goal**: Users can browse worlds and levels in a sidebar, see their progress, and unlock levels sequentially by clearing prerequisite levels
**Depends on**: Phase 2
**Requirements**: LEVL-03, LEVL-04, UI-04, UI-05, DATA-05
**Success Criteria** (what must be TRUE):
  1. A world/level sidebar displays all worlds with their levels grouped hierarchically, showing progress indicators (cleared, not cleared, locked)
  2. Clicking a level opens a detail page with scenario description, grading dimensions, and a start button
  3. Levels within a world unlock sequentially -- a locked level cannot be started until the previous level is cleared
  4. Each level shows its run history with past results and grades
**Plans**: TBD
**UI hint**: yes

### Phase 4: Manual Gatekeeper Mode
**Goal**: Users can take over the Gatekeeper role and manually question the Challenger, with Challenger responses still streaming in real time
**Depends on**: Phase 2
**Requirements**: HUMN-01, HUMN-02, HUMN-03
**Success Criteria** (what must be TRUE):
  1. User can switch to manual Gatekeeper mode before starting a run
  2. In manual mode, the user types questions and submits them one at a time; Challenger responds with streaming text after each submission
  3. Manual mode uses per-turn request-response (not long-lived SSE), and the conversation ends when the user explicitly stops it
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4
Note: Phase 4 depends on Phase 2 (not Phase 3), so Phase 3 and Phase 4 are theoretically parallelizable for future insertion flexibility.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Orchestration Engine | 0/4 | Planned | - |
| 2. Auto Mode UI | 0/? | Not started | - |
| 3. World Navigation & Progression | 0/? | Not started | - |
| 4. Manual Gatekeeper Mode | 0/? | Not started | - |
