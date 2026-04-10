# Phase 2: Auto Mode UI - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can launch an auto-mode Arena run from the CodePilot sidebar and watch the Gatekeeper-Challenger conversation stream in real time, then view the grade report. Covers sidebar entry, conversation streaming display, grade report rendering, provider/model selection UI, and i18n.

</domain>

<decisions>
## Implementation Decisions

### 对话展示布局
- **D-01:** 气泡对话布局，Gatekeeper 消息靠左、Challenger 消息靠右，类似聊天应用的交互模式，与 CodePilot 现有聊天 UI 风格一致
- **D-02:** Challenger 流式输出使用逐字流入效果（token 逐个追加到气泡中），与 CodePilot 现有聊天流式输出体验一致
- **D-03:** 对话区顶部固定一行状态栏，显示当前轮次、运行状态（进行中/已完成/失败）、token 用量，不占用对话空间
- **D-04:** 角色通过颜色 + 图标区分：Gatekeeper 和 Challenger 各有不同的气泡背景色和角标图标，视觉上清晰明了
- **D-05:** 新消息出现时自动滚动到底部，但用户手动上滑时暂停自动滚动（与 CodePilot 聊天行为一致）

### Arena 页面结构
- **D-06:** Arena 入口在侧边栏 NavRail 中位于 Skills 后面（Chats → Skills → Arena），与 AI 功能类归组
- **D-07:** 单页切换模式，内部通过状态切换：关卡列表 → 运行对话 → 评分报告，不使用多页路由跳转
- **D-08:** 关卡使用卡片列表展示，每张卡片显示关卡名称、简述和"开始挑战"按钮，为 Phase 3 的世界分组和解锁预留扩展空间
- **D-09:** 评分报告在对话流下方展开，用户可以向上滚动回顾对话，不需要页面跳转

### Claude's Discretion
- 评分报告的具体视觉设计（通关/未通关状态标记、必须项 Pass/Fail 列表布局、表现项等级展示、改进建议卡片样式）
- 运行启动页的具体布局和交互（关卡信息展示、高级选项折叠面板设计）
- 高级选项中三角色 provider/model 选择器的 UI 形式（UI-06）
- 运行中断机制（是否支持取消运行、取消按钮位置）
- Gatekeeper 和 Challenger 的具体图标选择和配色方案
- Arena SSE hook 的具体实现方式（基于现有 useSSEStream 模式但适配 Arena 事件类型）
- 关卡卡片的具体视觉设计（阴影、圆角、hover 效果等）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — UI-01 (sidebar entry), UI-02 (conversation stream), UI-03 (grade report), UI-06 (provider/model selection), INTG-03 (i18n)

### Project Context
- `.planning/PROJECT.md` — Project vision, constraints, tech stack context
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, dependency on Phase 1

### Phase 1 Context (upstream dependency)
- `.planning/phases/01-orchestration-engine/01-CONTEXT.md` — SSE event protocol (Claude's Discretion), orchestration loop design, level config organization

### Arena Backend (Phase 1 output, reuse targets)
- `src/arena/types.ts` — ArenaSSEEventType, ArenaSSEEvent, ArenaRun, ArenaMessage, ArenaGrade, formatArenaSSE
- `src/app/api/arena/run/route.ts` — POST /api/arena/run SSE endpoint (request body: worldId, levelId, providerId?, model?)
- `src/app/api/arena/levels/route.ts` — GET /api/arena/levels endpoint
- `src/arena/engine/orchestrator.ts` — runArenaOrchestration function
- `src/arena/level-loader.ts` — Level config loading and validation
- `src/arena/db.ts` — Arena DB CRUD operations

### Existing UI (reuse patterns)
- `src/components/layout/NavRail.tsx` — Sidebar navigation; add Arena entry to navItems array
- `src/hooks/useSSEStream.ts` — Existing SSE hook pattern; Arena needs similar but for ArenaSSEEvent
- `src/components/layout/AppShell.tsx` — Main layout container
- `src/lib/provider-resolver.ts` — Provider resolution for UI-06 model selection
- `src/hooks/useProviderModels.ts` — Provider/model listing hook for selection UI
- `src/i18n/en.ts` + `src/i18n/zh.ts` — i18n files to extend for INTG-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NavRail.tsx`: navItems 数组可直接追加 Arena 入口，已有 Tooltip + Button + Link 模式
- `useSSEStream.ts`: SSE 解析模式可参考，但 Arena SSE 事件类型不同（ArenaSSEEventType），需新建 useArenaSSE hook
- `useProviderModels.ts`: Provider/Model 列表 hook，可直接复用于 UI-06 的 provider/model 选择器
- `provider-resolver.ts`: Provider 解析链，Arena API 请求时携带用户选择的 providerId/model
- `useTranslation()`: i18n hook 直接可用，新增 arena.* 翻译 key 即可
- `@/components/ui/`: Radix UI 组件库（Button, Card, Select, Badge 等）直接可用

### Established Patterns
- 页面路由：Next.js App Router，新增 `src/app/arena/page.tsx`
- SSE 流：`ReadableStream` + `TextEncoder` 模式（后端已在 Phase 1 实现）
- 组件命名：PascalCase .tsx 文件，按功能目录分组
- 状态管理：React useState/useRef 为主，无全局状态库
- i18n：key 路径如 `arena.levelCard.start`，需同步 en.ts 和 zh.ts

### Integration Points
- NavRail navItems 数组新增 `{ href: "/arena", label: "Arena", icon: ... }`
- 新建 `src/app/arena/page.tsx` 路由入口
- 新建 `src/components/arena/` 组件目录
- 新建 `src/hooks/useArenaSSE.ts` Arena SSE 订阅 hook
- 扩展 `src/i18n/en.ts` 和 `zh.ts` 增加 arena.* 翻译

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for visual details, animations, and interaction patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-auto-mode-ui*
*Context gathered: 2026-04-10*
