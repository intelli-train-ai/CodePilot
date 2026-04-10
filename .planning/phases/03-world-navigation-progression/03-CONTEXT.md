# Phase 3: World Navigation & Progression - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can browse worlds and levels in a sidebar, see their progress (cleared/not cleared/locked), and unlock levels sequentially by clearing prerequisite levels. Covers world/level navigation sidebar, progress indicators, level detail page, sequential unlock logic, and run history display.

</domain>

<decisions>
## Implementation Decisions

### Navigation Layout
- **D-01:** Arena 页面采用内部双栏布局 — 左侧窄栏显示世界→关卡树（带进度标记），右侧主区域显示关卡详情或运行界面。类似邮件客户端的文件夹→内容布局，用户可以快速切换关卡而不丢失导航位置
- **D-02:** 左侧世界/关卡树常驻显示，运行中也保持可见，用户始终能看到当前关卡在世界中的位置和整体进度
- **D-03:** 进入 Arena 时右侧主区域默认显示空状态引导 — 欢迎信息 + "选择一个关卡开始挑战"提示，左侧树等待用户点击选择关卡

### Claude's Discretion
- 进度标记的具体视觉设计（通关✓/未通关/锁定🔒 的图标、颜色、Badge 样式）
- 锁定关卡的交互处理（可点击查看但不可开始 vs 完全禁用）
- 关卡详情页的具体布局（场景描述、评分维度说明、开始按钮的排列）
- 关卡详情页与现有 RunControls 组件的整合方式
- 顺序解锁规则细节（"通关"定义为至少一次 passed=1 的运行、每世界首关默认解锁、通关后可重复挑战）
- 运行历史的展示内容（日期、通关状态、评分摘要）和展示位置（关卡详情页内）
- 世界级别进度汇总展示（如 "2/5 通关"）
- 左侧世界树的宽度和内部排版

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — LEVL-03 (世界→关卡层级), LEVL-04 (顺序解锁), UI-04 (导航侧边栏+进度标记), UI-05 (关卡详情页), DATA-05 (运行历史列表)

### Project Context
- `.planning/PROJECT.md` — Project vision, constraints, tech stack
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, dependency on Phase 2

### Upstream Phase Context
- `.planning/phases/01-orchestration-engine/01-CONTEXT.md` — Level config organization (D-04: bundled in codebase, D-05: world-folder grouping, D-06: 1 example world with 2-3 levels)
- `.planning/phases/02-auto-mode-ui/02-CONTEXT.md` — Arena page structure (D-06: sidebar position, D-07: single-page state switching, D-08: card list with world grouping, D-09: grade report in-page)

### Arena Backend (Phase 1 output)
- `src/arena/types.ts` — ArenaRun (has world_id, level_id, passed, status), ArenaMessage, ArenaGrade
- `src/arena/schemas/level-config.ts` — LevelConfig, WorldConfig, RubricItem Zod schemas
- `src/arena/level-loader.ts` — loadAllWorlds(), loadLevel(), getWorldLevels() functions
- `src/arena/db.ts` — createArenaRun, getArenaRun, getArenaMessages, getArenaGrade CRUD

### Existing Arena UI (Phase 2 output)
- `src/components/arena/ArenaView.tsx` — Current state machine (levels/running/completed), needs refactoring to dual-panel
- `src/components/arena/LevelCardList.tsx` — World-grouped card grid, reference for hierarchy rendering
- `src/components/arena/LevelCard.tsx` — Card component, needs progress/lock state extension
- `src/components/arena/RunControls.tsx` — Run launch UI, reference for level detail page
- `src/components/arena/ConversationStream.tsx` — Run conversation display
- `src/components/arena/types.ts` — ArenaViewState, ArenaLevelInfo, ArenaWorldInfo frontend types
- `src/hooks/useArenaSSE.ts` — Arena SSE hook

### Navigation Reference
- `src/components/layout/NavRail.tsx` — Sidebar navigation pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LevelCardList.tsx`: 已有世界分组逻辑（单世界直显、多世界按标题分组），可作为左侧树组件的逻辑参考
- `LevelCard.tsx`: 已有卡片组件（名称、描述、开始按钮），需扩展进度/锁定状态
- `ArenaView.tsx`: 已有状态机（levels→running→completed），需重构为双栏布局
- `RunControls.tsx`: 已有关卡信息展示（名称、描述、maxTurns、provider选择），可整合到关卡详情页
- `level-loader.ts`: `loadAllWorlds()` 返回完整的世界→关卡层级结构（按 sortOrder 排序），可直接用于导航树
- `arena/db.ts`: 已有 run CRUD，需新增按 level_id 查询历史运行的方法
- `ArenaLevelInfo` / `ArenaWorldInfo`: 前端类型已定义，需扩展进度字段

### Established Patterns
- React useState/useRef 状态管理（无全局状态库）
- `authFetch` 调用 API 端点
- i18n: `useTranslation()` + `arena.*` 翻译 key
- 组件目录：`src/components/arena/` 下 PascalCase .tsx 文件

### Integration Points
- `ArenaView.tsx` 重构：从全屏状态切换改为双栏布局
- 新增 API 端点：获取关卡进度信息（每关是否通关）和运行历史
- `arena/db.ts` 新增查询：按 level_id 获取历史 runs、按 world_id 获取通关状态
- `ArenaLevelInfo` / `ArenaWorldInfo` 类型扩展：添加 progress/locked 字段
- `src/i18n/en.ts` + `zh.ts` 扩展：导航、进度、详情页相关翻译

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for visual design, unlock logic, and history display.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-world-navigation-progression*
*Context gathered: 2026-04-10*
