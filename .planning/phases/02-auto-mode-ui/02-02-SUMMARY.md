---
phase: 02-auto-mode-ui
plan: 02
subsystem: arena-ui
tags: [arena, components, state-machine, ui]
dependency_graph:
  requires: ["02-01"]
  provides: ["ArenaView", "LevelCard", "LevelCardList", "RunControls", "RoleModelSelector"]
  affects: ["src/app/arena/page.tsx"]
tech_stack:
  added: []
  patterns: ["state-machine-via-useState", "full-object-pass-through", "collapsible-advanced-options"]
key_files:
  created:
    - src/components/arena/LevelCard.tsx
    - src/components/arena/LevelCardList.tsx
    - src/components/arena/RoleModelSelector.tsx
    - src/components/arena/RunControls.tsx
    - src/components/arena/ArenaView.tsx
  modified:
    - src/app/arena/page.tsx
decisions:
  - "ArenaLevelInfo passed as complete object through component tree (not decomposed into individual fields) to preserve maxTurns/name/description for downstream consumers in Plan 03"
  - "selectedLevel state typed as { worldId: string; level: ArenaLevelInfo } to bundle world context with level data"
  - "RunControls uses Collapsible for advanced options (three-role provider/model selectors) -- defaults to collapsed state for simpler UX"
metrics:
  duration: "5 minutes"
  completed: "2026-04-10T08:07:55Z"
---

# Phase 02 Plan 02: Arena Page Skeleton + Level Selection + Run Controls Summary

ArenaView 三态状态机容器 + 关卡卡片列表 + 运行启动面板 + 三角色 provider/model 选择器，完整数据透传 ArenaLevelInfo 对象链路。

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | LevelCard + LevelCardList + RoleModelSelector | 1f9747f | LevelCard.tsx, LevelCardList.tsx, RoleModelSelector.tsx |
| 2 | ArenaView state machine + RunControls + /arena page | 0e0186c | ArenaView.tsx, RunControls.tsx, arena/page.tsx |

## What Was Built

### LevelCard (Task 1)
- 关卡卡片组件：显示 name/description/maxTurns badge
- `onStart` 回调传递完整 `ArenaLevelInfo` 对象（非 levelId 字符串）
- 视觉规范：hover:shadow-md + hover:border-primary/20 + duration-200 过渡

### LevelCardList (Task 1)
- 通过 `authFetch('/api/arena/levels')` 获取世界和关卡列表
- `onSelectLevel` 签名: `(worldId: string, level: ArenaLevelInfo) => void`
- 单世界直接显示卡片网格；多世界按组显示标题
- 响应式网格: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- 加载中/错误/空状态完整处理（含 i18n）

### RoleModelSelector (Task 1)
- 复用 `useProviderModels` hook 获取 provider 和 model 选项
- 双 Select 下拉框（provider + model），角色标签通过 `arena.role.${role}` 模板拼接

### RunControls (Task 2)
- 关卡信息展示（name/description/maxTurns）
- 返回按钮: ghost variant + ArrowLeft 图标
- Collapsible 高级选项面板，默认折叠
- 三个 RoleModelSelector 实例（gatekeeper/challenger/grader）
- 开始按钮组装完整 RunParams

### ArenaView (Task 2)
- 三态状态机: levels -> running -> completed（通过 `useState<ArenaViewState>` 管理）
- `selectedLevel` 状态保存完整 `{ worldId, level: ArenaLevelInfo }` 对象
- `useArenaSSE()` hook 集成，useEffect 同步 status 和 runId 到 viewState
- levels 态渲染 LevelCardList，选中关卡后展示 RunControls
- running/completed 态预留占位（Plan 03 实现 ConversationStream + GradeReport）

### /arena page (Task 2)
- 占位内容替换为 `<ArenaView />` 组件

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **ArenaLevelInfo 完整对象透传** -- LevelCard.onStart -> LevelCardList.onSelectLevel -> ArenaView.selectedLevel -> RunControls props 全链路传递完整对象，避免 Plan 03 需要 maxTurns 时重新获取
2. **selectedLevel 状态结构** -- `{ worldId: string; level: ArenaLevelInfo }` 捆绑世界 ID 和关卡完整信息
3. **高级选项默认折叠** -- RunControls 使用 Collapsible 包裹三角色选择器，默认 closed 以简化初始界面

## Verification

- TypeScript `tsc --noEmit` 通过
- `npm run test` 565/566 通过（1 个失败是 provider-resolver 预存测试，与本 plan 无关）
- 所有 acceptance criteria grep 验证通过

## Self-Check: PASSED

All 7 created/modified files verified on disk. Both task commits (1f9747f, 0e0186c) verified in git log.
