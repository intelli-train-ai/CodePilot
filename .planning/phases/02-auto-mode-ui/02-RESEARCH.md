# Phase 2: Auto Mode UI - Research

**Researched:** 2026-04-10
**Domain:** React UI (Next.js App Router + Radix UI + SSE streaming)
**Confidence:** HIGH

## Summary

Phase 2 是纯前端 UI 阶段，所有后端 API（SSE 流、关卡加载、评分）已在 Phase 1 完成。核心工作是：(1) 在侧边栏添加 Arena 入口，(2) 创建 Arena 页面组件，(3) 实现 SSE 流消费和气泡对话渲染，(4) 实现评分报告展示，(5) 实现 provider/model 高级选项，(6) 同步中英文 i18n。

项目已有完整的 UI 组件库（Radix UI 基础组件）、SSE 消费模式（`useSSEStream.ts` + `consumeSSEStream`）、provider/model 选择 hook（`useProviderModels.ts`）、以及自动滚动组件（`use-stick-to-bottom`）。Arena UI 应复用这些既有模式，不需要引入新的依赖。

**Primary recommendation:** 复用项目既有的 Radix UI 组件 + SSE 消费模式 + `use-stick-to-bottom` 自动滚动 + `motion/react` 动画，新建 `src/components/arena/` 组件目录和 `src/hooks/useArenaSSE.ts` hook，不引入任何新依赖。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 气泡对话布局，Gatekeeper 消息靠左、Challenger 消息靠右，类似聊天应用的交互模式，与 CodePilot 现有聊天 UI 风格一致
- **D-02:** Challenger 流式输出使用逐字流入效果（token 逐个追加到气泡中），与 CodePilot 现有聊天流式输出体验一致
- **D-03:** 对话区顶部固定一行状态栏，显示当前轮次、运行状态（进行中/已完成/失败）、token 用量，不占用对话空间
- **D-04:** 角色通过颜色 + 图标区分：Gatekeeper 和 Challenger 各有不同的气泡背景色和角标图标，视觉上清晰明了
- **D-05:** 新消息出现时自动滚动到底部，但用户手动上滑时暂停自动滚动（与 CodePilot 聊天行为一致）
- **D-06:** Arena 入口在侧边栏 NavRail 中位于 Skills 后面（Chats -> Skills -> Arena），与 AI 功能类归组
- **D-07:** 单页切换模式，内部通过状态切换：关卡列表 -> 运行对话 -> 评分报告，不使用多页路由跳转
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | CodePilot 侧边栏新增 Arena 入口，与 Chat、Skills 并列 | ChatListPanel.tsx navItems 数组追加 Arena 条目，pattern 已验证 |
| UI-02 | 对话实时流展示，区分 Gatekeeper（左侧）和 Challenger（右侧）消息 | useArenaSSE hook 消费 SSE + 气泡组件左右对齐渲染 |
| UI-03 | 评分报告页：通关/未通关状态、必须项逐条 Pass/Fail、表现项等级、改进建议 | GraderOutput schema 已明确数据结构，Radix Badge + Card 组件可用 |
| UI-06 | 启动运行时可为三角色分别选择 provider 和 model | useProviderModels hook 直接复用 + Collapsible 折叠面板 |
| INTG-03 | 新增 UI 文本同步中英文 i18n 翻译 | en.ts/zh.ts 扩展 arena.* 命名空间 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **测试框架:** vitest（workspace 级 CLAUDE.md 要求），但当前项目实际用 tsx + node:test 做单元测试、Playwright 做 E2E [VERIFIED: package.json scripts]
- **自检命令:** `npm run test`（typecheck + 单元测试）必须在 commit 前通过
- **UI 改动验证:** 必须通过 CDP (chrome-devtools MCP) 实际验证效果
- **i18n 自查:** 改动涉及 i18n 必须同步 en.ts 和 zh.ts
- **Conventional commits:** 标题行使用 feat/fix/refactor/chore 格式
- **功能文档:** 新功能完成后需同时输出技术交接文档 (docs/handover/) 和产品思考文档 (docs/insights/)

## Standard Stack

### Core (already in project, no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | UI framework | 项目主框架 [VERIFIED: package.json] |
| Next.js | 16.2.1 | App Router pages + API routes | 项目路由框架 [VERIFIED: package.json] |
| radix-ui | 1.4.3 | Primitive UI components (Select, Collapsible, ScrollArea, Tabs) | 项目 UI 组件基础 [VERIFIED: package.json] |
| @phosphor-icons/react | 2.1.10 | Icon library | 项目图标库 [VERIFIED: package.json] |
| class-variance-authority | 0.7.1 | Variant-based className composition | 项目样式模式 [VERIFIED: package.json] |
| motion | 12.33.0 | 动画 (AnimatePresence, motion components) | 项目已用于 ChatListPanel [VERIFIED: ChatListPanel.tsx import] |
| use-stick-to-bottom | (bundled) | 自动滚动到底部 | 项目聊天已用此模式 [VERIFIED: MessageList.tsx import] |
| Tailwind CSS 4 | (bundled) | 样式 | 项目主样式方案 [VERIFIED: ARCHITECTURE.md] |
| zod | (bundled) | Schema 校验 | Phase 1 已用于 GraderOutput/LevelConfig [VERIFIED: schemas/] |

### Supporting (no new libraries)

无需新增依赖。所有 UI 需求均可通过项目既有组件库满足。

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 自建气泡组件 | chat MessageItem | 聊天 MessageItem 太复杂（工具调用、权限等），Arena 气泡结构简单，应自建轻量组件 |
| 复用 useSSEStream | 自建 useArenaSSE | useSSEStream 绑定了 chat 特有的事件类型，Arena SSE 事件完全不同，必须自建 |
| Radix ScrollArea | use-stick-to-bottom | 项目聊天场景已用 use-stick-to-bottom 实现自动滚动，Arena 应保持一致 |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── arena/
│       └── page.tsx                    # Arena 页面入口 (D-07: 单页状态切换)
├── components/
│   └── arena/
│       ├── ArenaView.tsx               # 主视图容器 (状态机: levels -> running -> report)
│       ├── LevelCardList.tsx           # 关卡卡片列表 (D-08)
│       ├── LevelCard.tsx               # 单个关卡卡片
│       ├── RunControls.tsx             # 启动控制区 (高级选项 UI-06)
│       ├── ConversationStream.tsx      # 对话流容器 (D-01, D-05 自动滚动)
│       ├── ArenaBubble.tsx             # 消息气泡 (D-01 左右对齐, D-04 颜色图标)
│       ├── ArenaStatusBar.tsx          # 顶部状态栏 (D-03)
│       ├── GradeReport.tsx             # 评分报告 (D-09, UI-03)
│       └── RoleModelSelector.tsx       # 三角色 provider/model 选择器 (UI-06)
├── hooks/
│   └── useArenaSSE.ts                  # Arena SSE 消费 hook
└── i18n/
    ├── en.ts                           # 追加 arena.* keys
    └── zh.ts                           # 追加 arena.* keys
```

### Pattern 1: Arena 页面状态机 (D-07)

**What:** Arena 页面使用单一 React 状态控制视图切换，不使用路由。
**When to use:** 所有 Arena 页面内的视图切换。

```typescript
// Source: CONTEXT.md D-07
type ArenaViewState =
  | { phase: 'levels' }                                          // 关卡列表
  | { phase: 'running'; runId: string; levelId: string }         // 运行中
  | { phase: 'completed'; runId: string; levelId: string };      // 完成 + 报告

function ArenaView() {
  const [viewState, setViewState] = useState<ArenaViewState>({ phase: 'levels' });

  switch (viewState.phase) {
    case 'levels':
      return <LevelCardList onStart={(worldId, levelId) => { /* start run */ }} />;
    case 'running':
    case 'completed':
      return (
        <ConversationStream
          runId={viewState.runId}
          isRunning={viewState.phase === 'running'}
          onBack={() => setViewState({ phase: 'levels' })}
        />
      );
  }
}
```

### Pattern 2: Arena SSE Hook (useArenaSSE)

**What:** 自建 SSE 消费 hook，适配 Arena 事件类型（与 chat useSSEStream 分离）。
**When to use:** 发起 Arena 运行并消费 SSE 流。

```typescript
// Source: 参考 src/hooks/useSSEStream.ts 模式 + src/arena/types.ts 事件类型
interface UseArenaSSEReturn {
  messages: ArenaUIMessage[];        // 累积的对话消息
  streamingDelta: string;            // 当前正在流式输出的 Challenger 内容
  currentTurn: number;
  status: 'idle' | 'running' | 'grading' | 'completed' | 'error';
  grade: GraderOutput | null;
  tokenUsage: { totalUsed: number; remaining: number } | null;
  runId: string | null;
  error: string | null;
  startRun: (params: RunParams) => Promise<void>;
  cancelRun: () => void;
}

// SSE 事件映射:
// run_started       -> status='running', runId=data.runId
// gatekeeper_message -> 追加 Gatekeeper 消息到 messages[]
// challenger_delta   -> 追加到 streamingDelta（逐 token 更新）
// challenger_message -> 固化 Challenger 完整消息到 messages[], 清空 streamingDelta
// turn_completed    -> currentTurn++
// grading_started   -> status='grading'
// grade_result      -> grade=data
// run_completed     -> status='completed'
// run_error         -> status='error', error=data.error
// token_usage       -> tokenUsage=data
```

### Pattern 3: 气泡消息模型

**What:** Arena 对话消息的 UI 数据模型，与 Phase 1 ArenaMessage 区分。
**When to use:** ConversationStream 和 ArenaBubble 组件的数据传递。

```typescript
// UI 层消息模型（从 SSE 事件构建，不直接依赖 DB 类型）
interface ArenaUIMessage {
  id: string;                          // 客户端生成的唯一 ID
  role: 'gatekeeper' | 'challenger';   // 仅显示这两个角色
  content: string;
  turn: number;
  isStreaming?: boolean;               // Challenger 正在流式输出
}
```

### Pattern 4: 侧边栏集成 (UI-01)

**What:** 在 ChatListPanel.tsx 的 navItems 数组中追加 Arena 条目。
**When to use:** D-06 指定位置：Skills 后面。

```typescript
// Source: src/components/layout/ChatListPanel.tsx line 427-432
// 注意：实际导航不在 NavRail.tsx，而是在 ChatListPanel.tsx
const navItems = [
  { href: "/skills", label: t('nav.skills' as TranslationKey), icon: Lightning },
  // ---- 新增 Arena 入口 ----
  { href: "/arena", label: t('nav.arena' as TranslationKey), icon: GameController },
  // ---- 以上为新增 ----
  { href: "/mcp", label: t('nav.mcp' as TranslationKey), icon: Plug },
  { href: "/cli-tools", label: t('nav.cliTools' as TranslationKey), icon: Terminal },
  { href: "/bridge", label: t('nav.bridge' as TranslationKey), icon: WifiHigh },
];
```

**Critical finding:** CONTEXT.md 中 D-06 提到的 "NavRail" 实际上是 `ChatListPanel.tsx` 中的 navItems。NavRail.tsx 文件存在但不再被 AppShell 使用（有注释 `// NavRail removed -- navigation merged into ChatListPanel`）。实现时必须修改 `ChatListPanel.tsx`。[VERIFIED: AppShell.tsx line 6 comment, ChatListPanel.tsx line 427]

### Pattern 5: 自动滚动 (D-05)

**What:** 使用 `use-stick-to-bottom` 实现与聊天一致的自动滚动行为。
**When to use:** ConversationStream 对话流容器。

```typescript
// Source: src/components/ai-elements/conversation.tsx + MessageList.tsx
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';

// 直接复用项目的 Conversation 组件或按相同模式自建
<StickToBottom className="relative flex-1 overflow-y-hidden" initial="smooth" resize="instant">
  <StickToBottom.Content className="flex flex-col gap-4 p-4">
    {messages.map(msg => <ArenaBubble key={msg.id} message={msg} />)}
    {streamingDelta && <ArenaBubble role="challenger" content={streamingDelta} isStreaming />}
    {grade && <GradeReport grade={grade} />}
  </StickToBottom.Content>
</StickToBottom>
```

### Anti-Patterns to Avoid
- **直接复用 chat 的 MessageItem/StreamingMessage:** 这些组件绑定了大量 chat 特有逻辑（工具调用、权限请求、代码高亮），Arena 气泡应自建轻量版本
- **在 NavRail.tsx 中添加 Arena:** NavRail 已废弃，应在 ChatListPanel.tsx 修改
- **使用 Next.js 路由切换 Arena 子视图:** D-07 明确要求单页状态切换
- **全局状态管理:** 项目不使用 Redux/Zustand 等，Arena 状态保持在 ArenaView 组件内

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 自动滚动 | 自己实现 scrollIntoView + scroll position tracking | `use-stick-to-bottom` (StickToBottom) | 边界情况多（用户上滑暂停、新消息恢复），项目聊天已验证此方案 [VERIFIED: conversation.tsx] |
| 下拉选择器 | 自建 dropdown | Radix `Select` + `SelectGroup` | 项目已有封装好的 Select 组件 [VERIFIED: ui/select.tsx] |
| 折叠面板 | 自建 toggle | Radix `Collapsible` | 项目已有封装 [VERIFIED: ui/collapsible.tsx] |
| SSE 文本解码 | 自写 TextDecoder + buffer split | 参考 `consumeSSEStream` 的 `data:` 行解析模式 | 已处理好分段解码和 buffer 拼接 [VERIFIED: useSSEStream.ts] |
| Provider/Model 列表 | 自建 API fetch | `useProviderModels` hook | 已处理默认值、fallback、provider-changed 事件 [VERIFIED: useProviderModels.ts] |
| 认证请求 | 手写 fetch + auth header | `authFetch` | 自动附加 auth token、处理 401 [VERIFIED: api-client.ts] |

**Key insight:** Phase 2 是一个"组合阶段"——所有底层能力（SSE 解析、provider 解析、组件库、认证）都已就绪，关键是正确组合而非重新发明。

## Common Pitfalls

### Pitfall 1: SSE 事件格式差异
**What goes wrong:** Arena SSE 事件结构是 `{ type, data }` 格式，与 chat SSE 的 `{ type, data: string }` 不同。Arena 的 `data` 字段已经是 object（不需要额外 JSON.parse）。
**Why it happens:** 开发者可能照搬 `useSSEStream.ts` 的 `JSON.parse(event.data)` 模式。
**How to avoid:** Arena SSE 的 `data:` 行是完整的 `{"type":"...", "data":{...}}` JSON，外层 parse 一次即可，内部 data 已经是对象。
**Warning signs:** `challenger_delta` 事件中 `data.delta` 是 undefined（因为多了一次 parse）。

### Pitfall 2: NavRail vs ChatListPanel
**What goes wrong:** 在 NavRail.tsx 中添加 Arena 入口，但该组件未被使用。
**Why it happens:** CONTEXT.md D-06 提到 "NavRail"，但实际代码中 NavRail 已被 ChatListPanel 替代。
**How to avoid:** 在 `src/components/layout/ChatListPanel.tsx` 的 `navItems` 数组中添加 Arena 入口。也要同步更新 NavRail.tsx 以保持一致（虽然未被使用，但保持代码同步可避免后续混淆）。
**Warning signs:** Arena 入口不出现在侧边栏。

### Pitfall 3: Challenger Delta 累积
**What goes wrong:** `challenger_delta` 事件的 `data.delta` 只包含增量文本片段，不是完整内容。如果直接赋值而非追加，会丢失前面的内容。
**Why it happens:** 开发者将 delta 当作完整文本处理。
**How to avoid:** 维护 `streamingDelta` 状态，每收到 `challenger_delta` 就追加：`setStreamingDelta(prev => prev + delta)`。收到 `challenger_message` 时将完整内容固化到 messages 数组，清空 streamingDelta。
**Warning signs:** Challenger 回复只显示最后一个 token。

### Pitfall 4: i18n 类型不同步
**What goes wrong:** 在 en.ts 添加了 arena.* keys 但忘记在 zh.ts 同步，TypeScript 编译报错。
**Why it happens:** zh.ts 类型是 `Record<TranslationKey, string>`，TranslationKey 从 en.ts 推断，任何缺失的 key 都会导致编译错误。
**How to avoid:** 每次添加 i18n key 时同时编辑 en.ts 和 zh.ts。先确定所有 key，一次性添加。
**Warning signs:** `npm run typecheck` 报 zh.ts 缺少属性。

### Pitfall 5: 流式渲染性能
**What goes wrong:** 每个 `challenger_delta` 事件都触发整个对话列表重渲染，导致卡顿。
**Why it happens:** streaming delta 状态变更触发父组件 re-render。
**How to avoid:** (1) 将 streamingDelta 状态隔离在最底部的 ArenaBubble 组件中，通过 ref + 直接 DOM 操作更新文本（类似项目 StreamingMessage 的 `streamdown` 模式），或 (2) 使用 React.memo 隔离不变的消息气泡。
**Warning signs:** 长对话中 Challenger 流式输出明显卡顿（>100ms 延迟）。

### Pitfall 6: AbortController 清理
**What goes wrong:** 用户在运行中导航到其他页面，SSE 连接未关闭，继续消耗资源。
**Why it happens:** 没有在组件卸载时 abort 请求。
**How to avoid:** 在 `useArenaSSE` hook 中用 AbortController，在 `useEffect` cleanup 或组件卸载时调用 `controller.abort()`。后端 route.ts 已经监听 abort signal。
**Warning signs:** 切换页面后控制台仍输出 SSE 事件日志。

## Code Examples

### 完整的 useArenaSSE Hook 骨架

```typescript
// Source: 参考 src/hooks/useSSEStream.ts 模式适配 src/arena/types.ts
import { useState, useRef, useCallback } from 'react';
import { authFetch } from '@/lib/api-client';
import type { ArenaSSEEvent, ArenaSSEEventType } from '@/arena/types';

export function useArenaSSE() {
  const [messages, setMessages] = useState<ArenaUIMessage[]>([]);
  const [streamingDelta, setStreamingDelta] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'grading' | 'completed' | 'error'>('idle');
  const [grade, setGrade] = useState<GraderOutput | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{ totalUsed: number; remaining: number } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startRun = useCallback(async (params: {
    worldId: string; levelId: string;
    providerId?: string; model?: string;
  }) => {
    // Reset state
    setMessages([]);
    setStreamingDelta('');
    setGrade(null);
    setStatus('running');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const res = await authFetch('/api/arena/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const event: ArenaSSEEvent = JSON.parse(line.slice(6));
        handleEvent(event);
      }
    }
  }, []);

  const cancelRun = useCallback(() => {
    abortRef.current?.abort();
    setStatus('error');
    setError('Run cancelled');
  }, []);

  return { messages, streamingDelta, status, grade, tokenUsage, runId, error, startRun, cancelRun };
}
```

### 气泡组件模式 (D-01, D-04)

```typescript
// Source: 项目 Radix UI 组件 + CONTEXT.md D-01, D-04
function ArenaBubble({ message, isStreaming }: {
  message: ArenaUIMessage;
  isStreaming?: boolean;
}) {
  const isGatekeeper = message.role === 'gatekeeper';

  return (
    <div className={cn(
      "flex gap-3 max-w-[80%]",
      isGatekeeper ? "self-start" : "self-end flex-row-reverse"
    )}>
      {/* 角色图标 */}
      <div className={cn(
        "shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
        isGatekeeper ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500"
      )}>
        {isGatekeeper ? <Shield size={16} /> : <Lightning size={16} />}
      </div>
      {/* 消息气泡 */}
      <div className={cn(
        "rounded-2xl px-4 py-3 text-sm",
        isGatekeeper
          ? "bg-muted text-foreground rounded-tl-sm"
          : "bg-primary text-primary-foreground rounded-tr-sm",
      )}>
        {message.content}
        {isStreaming && <span className="animate-pulse">|</span>}
      </div>
    </div>
  );
}
```

### Provider/Model 选择器 (UI-06)

```typescript
// Source: src/hooks/useProviderModels.ts 直接复用
import { useProviderModels } from '@/hooks/useProviderModels';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

function RoleModelSelector({ role, providerId, model, onChange }: {
  role: 'gatekeeper' | 'challenger' | 'grader';
  providerId?: string;
  model?: string;
  onChange: (providerId: string, model: string) => void;
}) {
  const { providerGroups, modelOptions } = useProviderModels(providerId, model);

  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm font-medium capitalize w-24">{role}</span>
      <Select value={providerId} onValueChange={pid => onChange(pid, model || '')}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Default" /></SelectTrigger>
        <SelectContent>
          {providerGroups.map(g => (
            <SelectItem key={g.provider_id} value={g.provider_id}>{g.provider_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={model} onValueChange={m => onChange(providerId || '', m)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Default" /></SelectTrigger>
        <SelectContent>
          {modelOptions.map(m => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

### GradeReport 数据结构映射

```typescript
// Source: src/arena/schemas/grader-output.ts
// GraderOutput 结构 (grade_result 事件的 data):
{
  passed: boolean;                                    // 是否通关
  requiredCriteria: Array<{                           // 必须项
    name: string;
    passed: boolean;
    reason: string;
  }>;
  performanceDimensions: Array<{                      // 表现项
    name: string;
    grade: 'A' | 'B' | 'C' | 'D';
    reason: string;
  }>;
  suggestions: Array<{                                // 改进建议 (max 3)
    content: string;
    referenceTurn: number;
  }>;
}

// UI 渲染示例:
// 1. 通关/未通关大标题 + Badge
// 2. requiredCriteria -> 列表，每项 CheckCircle(green) 或 XCircle(red) + 名称 + 理由
// 3. performanceDimensions -> 列表，每项 Badge(A/B/C/D) + 名称 + 理由
// 4. suggestions -> Card 列表，每条显示建议内容 + "参考轮次 N" 链接
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NavRail 独立侧边栏 | NavRail 合并到 ChatListPanel | 项目近期重构 | Arena 入口必须在 ChatListPanel 添加 [VERIFIED] |
| useSSEStream 通用 hook | 每个 SSE 场景独立 hook | 项目设计 | Arena 需要自建 useArenaSSE [VERIFIED] |

**Deprecated/outdated:**
- `NavRail.tsx` 组件存在但不再被 AppShell 渲染 [VERIFIED: AppShell.tsx line 6]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `use-stick-to-bottom` 已作为依赖安装（在 MessageList.tsx 中 import） | Architecture Patterns #5 | 若未安装需添加到 package.json，但 import 存在说明已安装 |
| A2 | `GameController` 图标已在 phosphor-icons 导出中 | Pattern 4 (侧边栏) | 若未导出需在 icon.tsx 中添加导出 |
| A3 | `motion/react` 的 `AnimatePresence` 可用于 Arena 气泡入场动画 | Claude's Discretion | ChatListPanel 已用此 import 路径，应可用 |

## Open Questions

1. **Arena 运行取消 UX**
   - What we know: 后端 route.ts 已支持 AbortController（client disconnect 时 abort）
   - What's unclear: 取消按钮应在状态栏还是对话区底部？取消后是否需要保存部分对话到 DB？
   - Recommendation: 在状态栏右侧放置 Stop 按钮（使用 Stop 图标），取消后显示 "已中断" 状态。后端已经在 catch 中处理 error 状态的 DB 更新，部分对话自然保留。

2. **关卡卡片列表分组**
   - What we know: Phase 2 只有 1 个示例世界，Phase 3 才做世界分组
   - What's unclear: Phase 2 是否需要显示 World 标题？
   - Recommendation: 显示 World 标题但不做分组 UI（为 Phase 3 预留空间），如果只有 1 个世界则只显示关卡列表。

3. **评分报告中"参考轮次"的交互**
   - What we know: suggestions 中有 referenceTurn 字段，UI 可以高亮对应对话轮次
   - What's unclear: 点击"参考轮次 N"是滚动到对应消息还是仅标注？
   - Recommendation: Phase 2 先做简单标注（显示文本 "Turn N"），Phase 3 可增强为点击滚动。

## Environment Availability

Step 2.6: SKIPPED (纯前端代码改动，无外部依赖。所有 UI 组件库和工具链已在项目中就绪。)

## Sources

### Primary (HIGH confidence)
- `src/arena/types.ts` -- ArenaSSEEvent 类型定义，10 种事件类型
- `src/arena/schemas/grader-output.ts` -- GraderOutput schema，评分报告数据结构
- `src/arena/schemas/level-config.ts` -- LevelConfig/WorldConfig schema
- `src/app/api/arena/run/route.ts` -- POST /api/arena/run SSE 端点，请求参数
- `src/app/api/arena/levels/route.ts` -- GET /api/arena/levels 端点，响应格式
- `src/arena/engine/orchestrator.ts` -- SSE 事件发射顺序和 data payload 结构
- `src/hooks/useSSEStream.ts` -- 既有 SSE 消费模式，data: 行解析
- `src/hooks/useProviderModels.ts` -- Provider/Model 列表 hook
- `src/components/layout/ChatListPanel.tsx` -- 实际导航入口（navItems 数组 line 427）
- `src/components/layout/AppShell.tsx` -- 布局容器，NavRail removed 注释
- `src/components/ai-elements/conversation.tsx` -- use-stick-to-bottom 封装
- `src/i18n/en.ts` + `src/i18n/zh.ts` -- i18n 文件，TranslationKey 类型推断模式
- `src/components/ui/*.tsx` -- Radix UI 基础组件（Card, Badge, Select, Collapsible, ScrollArea, Tabs）
- `package.json` -- 所有依赖版本

### Secondary (MEDIUM confidence)
None -- all findings verified against codebase source.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 全部从 package.json 和源码验证
- Architecture: HIGH -- 基于 CONTEXT.md 锁定决策 + 代码模式验证
- Pitfalls: HIGH -- 基于代码实际结构分析（NavRail 废弃、SSE 事件格式）

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (稳定的前端 UI 阶段，代码依赖不会快速变化)
