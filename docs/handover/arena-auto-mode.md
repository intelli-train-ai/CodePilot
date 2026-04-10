> 产品思考见 [docs/insights/arena-auto-mode.md](../insights/arena-auto-mode.md)

# Arena Auto Mode -- 技术交接文档

Arena Auto Mode 是 CodePilot 中 AI Agent 闯关测试框架的核心交互层。用户选择关卡后，Gatekeeper 和 Challenger 的对话以实时流式气泡展示，运行结束后在对话流下方展开评分报告。

---

## 目录结构

```
src/
  components/arena/
    types.ts              # Arena UI 类型定义（前端解耦后端）
    ArenaView.tsx         # 页面状态机容器（levels → running → completed）
    LevelCardList.tsx     # 关卡卡片网格列表
    LevelCard.tsx         # 单张关卡卡片（名称、描述、开始按钮）
    RunControls.tsx       # 运行前配置（关卡信息 + 高级选项）
    ConversationStream.tsx # 对话流滚动容器（StickToBottom + 消息列表 + 评分报告）
    ArenaBubble.tsx       # 单条消息气泡（左右对齐、角色颜色图标）
    ArenaStatusBar.tsx    # 顶部固定状态栏（轮次、状态、token、停止按钮）
    GradeReport.tsx       # 评分报告（通关横幅 + 必须项 + 表现项 + 改进建议）
    RoleModelSelector.tsx # 角色 provider/model 选择器
  hooks/
    useArenaSSE.ts        # Arena SSE 事件流消费 hook
  app/arena/
    page.tsx              # /arena 路由入口
```

---

## 数据流

### 整体流程

```
用户点击"开始挑战"
  → ArenaView.handleStartRun(params)
    → useArenaSSE.startRun(params)
      → POST /api/arena/run (SSE 流)
        → 后端 runArenaOrchestration()
          → 事件逐条推送:
             run_started → gatekeeper_message → challenger_delta (多条)
             → challenger_message → turn_completed → ... (循环)
             → grading_started → grade_result → run_completed
```

### SSE 事件 → UI 状态映射

| SSE 事件类型 | useArenaSSE 状态变更 | UI 表现 |
|---|---|---|
| `run_started` | `runId` 赋值, `status → running` | 状态栏显示"运行中" |
| `gatekeeper_message` | 追加完整消息到 `messages[]` | 左侧蓝色气泡即时出现 |
| `challenger_delta` | `streamingDelta` 追加 token | 右侧气泡逐字流入 + 闪烁光标 |
| `challenger_message` | 追加完整消息, 清空 `streamingDelta` | 流式气泡固化为完整消息 |
| `turn_completed` | `currentTurn` 更新 | 状态栏轮次计数更新 |
| `grading_started` | `status → grading` | 状态栏显示"评分中..." |
| `grade_result` | `grade` 赋值 (GraderOutput) | 评分报告组件渲染 |
| `run_completed` | `status → completed` | 状态栏显示"已完成", 返回按钮出现 |
| `run_error` | `status → error`, `error` 赋值 | 状态栏显示"失败", 错误信息展示 |
| `token_usage` | `tokenUsage` 更新 | 状态栏 token 计数更新 |

### 组件数据透传

```
ArenaView (状态机 + useArenaSSE)
  ├─ [levels phase] → LevelCardList → LevelCard
  ├─ [run controls] → RunControls → RoleModelSelector
  └─ [running/completed] → ConversationStream
                              ├─ ArenaStatusBar (currentTurn, maxTurns, status, tokenCount, onStop)
                              ├─ ArenaBubble[] (messages.map + streamingDelta 虚拟消息)
                              └─ GradeReport (grade: GraderOutput)
```

---

## 核心类型

### ArenaUIMessage

前端消息模型，与后端 `ArenaMessage` 解耦：

```typescript
interface ArenaUIMessage {
  id: string;                           // crypto.randomUUID()
  role: 'gatekeeper' | 'challenger';    // 角色
  content: string;                      // 消息内容
  turn: number;                         // 所属轮次
  isStreaming?: boolean;                // 是否正在流式输出
}
```

### ArenaRunUIStatus

运行状态机：`'idle' → 'running' → 'grading' → 'completed'`，或 `'running' → 'error'`。

### GraderOutput

来自 `src/arena/schemas/grader-output.ts`，结构化评分结果：

```typescript
type GraderOutput = {
  passed: boolean;
  requiredCriteria: Array<{ name: string; passed: boolean; reason: string }>;
  performanceDimensions: Array<{ name: string; grade: 'A'|'B'|'C'|'D'; reason: string }>;
  suggestions: Array<{ content: string; referenceTurn: number }>;
};
```

---

## 关键设计决策

### 1. 前后端类型解耦

`ArenaUIMessage` 与后端 `ArenaMessage` 各自独立定义。前端不导入后端数据库实体，而是在 `useArenaSSE` 的 `handleEvent` 中将 SSE 事件数据转换为 UI 专用类型。这允许前后端独立演进。

### 2. 流式输出双缓冲

Challenger 的流式消息通过两个状态协同：
- `streamingDelta`: 累积当前正在流入的 token
- `messages[]`: 完成的消息列表

`challenger_delta` 事件追加到 `streamingDelta`；`challenger_message` 事件将完整内容追加到 `messages[]` 并清空 `streamingDelta`。ConversationStream 用 `streamingDelta` 渲染一个临时的"流式气泡"（带闪烁光标）。

### 3. 自动滚动 (use-stick-to-bottom)

复用项目已有的 `use-stick-to-bottom` 库（与聊天页面一致）：
- 新消息到达自动滚动到底部
- 用户手动上滑暂停自动滚动
- 滚动按钮在非底部时出现

### 4. 状态机不改 URL

ArenaView 内部通过 React state 切换 `levels → running → completed`（D-07），不使用 Next.js 路由跳转。原因：
- 运行状态是临时的，刷新页面回到关卡列表是合理行为
- 避免 URL 污染（不需要 /arena/run/xxx 路径）
- 页面切换更快（无路由跳转开销）

### 5. 取消运行 (AbortController)

`useArenaSSE` 使用 `AbortController` 中断 SSE 连接。取消是即时的、无确认对话框（因为对话已在服务端持久化，取消只是断开前端订阅）。

---

## 角色视觉区分

| 角色 | 对齐 | 气泡颜色 | 图标 | 图标颜色 |
|---|---|---|---|---|
| Gatekeeper | 左 | `bg-muted` | Shield | `bg-blue-500/10 text-blue-500` |
| Challenger | 右 | `bg-primary text-primary-foreground` | Lightning | `bg-orange-500/10 text-orange-500` |

蓝/橙色对选择理由：最大色相分离（冷 vs 暖），避免与现有 primary（紫蓝色）和 destructive（红色）冲突。

---

## 评分报告结构

GradeReport 由四个纵向段落组成：

1. **Pass/Fail 横幅** -- 全宽色块，success (绿) 或 error (红) 背景 + Display 级标题 + Badge
2. **必须项列表** -- 每行：CheckCircle/XCircle 图标 + 标准名 + 理由
3. **表现维度列表** -- 每行：等级 Badge (A/B/C/D, 颜色各异) + 维度名 + 理由
4. **改进建议** -- 最多 3 张 Card，每张含建议文本 + "轮次 N" 引用

入场动画：从下方滑入（translateY 16px -> 0, opacity 0 -> 1, 300ms easeOut）。

---

## i18n Key 结构

所有 Arena UI 文本在 `src/i18n/en.ts` 和 `zh.ts` 中以 `arena.*` 前缀组织：

```
arena.startChallenge        // 开始挑战
arena.backToLevels          // 返回关卡列表
arena.empty.title           // 暂无关卡
arena.empty.body            // 添加关卡引导
arena.status.running        // 运行中
arena.status.grading        // 评分中...
arena.status.completed      // 已完成
arena.status.failed         // 失败
arena.status.cancelled      // 已取消
arena.status.turn           // 轮次 {current}/{max}
arena.status.tokens         // {count} tokens
arena.grade.passed          // 挑战通过
arena.grade.failed          // 挑战未通过
arena.grade.requiredCriteria  // 必须项
arena.grade.performanceDimensions  // 表现评估
arena.grade.suggestions     // 改进建议
arena.grade.turnReference   // 轮次 {n}
arena.advancedOptions       // 高级选项
arena.role.gatekeeper       // 守门人
arena.role.challenger       // 挑战者
arena.role.grader           // 评分官
arena.stop                  // 停止运行
arena.error.connection      // 连接断开
arena.error.runFailed       // 运行失败：{reason}
```

---

## 动画规范

| 元素 | 动画 | 时长 | 缓动 |
|---|---|---|---|
| 新消息气泡 | fadeIn + translateY(8px -> 0) | 200ms | easeOut |
| 评分报告入场 | fadeIn + translateY(16px -> 0) | 300ms | easeOut |
| 流式光标闪烁 | CSS `animate-pulse` | 浏览器默认 | linear |
| 关卡卡片 hover | shadow-sm -> shadow-md | 200ms | ease |

动画库：`motion/react`（项目已有依赖），结合 `AnimatePresence` 实现消息列表进出场。

---

## 依赖关系

### 上游

- **Phase 1 (编排引擎)**: SSE 事件协议 (`ArenaSSEEventType`)、编排循环 (`runArenaOrchestration`)、关卡加载 (`level-loader`)、评分 schema (`GraderOutput`)
- **Plan 02-01 (UI 基础)**: Arena 类型定义、useArenaSSE hook、侧边栏入口、/arena 路由、i18n keys
- **Plan 02-02 (页面骨架)**: ArenaView 状态机、LevelCardList、RunControls、RoleModelSelector

### 下游

- **Phase 3**: 世界分组、顺序解锁、历史记录 UI 等功能将在此组件基础上扩展

---

*最后更新：2026-04-10*
