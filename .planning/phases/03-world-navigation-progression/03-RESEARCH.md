# Phase 3: World Navigation & Progression - Research

**Researched:** 2026-04-10
**Domain:** React UI (dual-panel layout, tree navigation, progress tracking), Next.js API routes, SQLite queries
**Confidence:** HIGH

## Summary

Phase 3 将 Arena 从全屏状态切换模式重构为双栏布局：左侧世界/关卡导航树 + 右侧内容区。核心任务包括：(1) 重构 `ArenaView.tsx` 为双栏布局，(2) 新建左侧导航树组件，(3) 新增进度查询 API 和 DB 方法，(4) 实现顺序解锁逻辑，(5) 构建关卡详情页，(6) 显示运行历史。

现有代码已具备大部分基础设施：`loadAllWorlds()` 提供完整层级数据、`arena_runs` 表记录了每次运行的 `level_id`/`world_id`/`passed` 字段、前端类型 `ArenaLevelInfo`/`ArenaWorldInfo` 已定义、Radix UI 的 ScrollArea/Collapsible 组件可直接复用。主要新增工作是 DB 查询层（按 level 聚合进度）、前端状态扩展（progress/locked 字段）、以及布局重构。

**Primary recommendation:** 基于现有 `Collapsible` + `ScrollArea` 组件构建可折叠世界树，通过新增 `/api/arena/progress` 端点一次性返回所有关卡的通关状态，前端计算解锁逻辑（无需后端强制校验，因为这是单用户桌面应用）。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Arena 页面采用内部双栏布局 -- 左侧窄栏显示世界->关卡树（带进度标记），右侧主区域显示关卡详情或运行界面。类似邮件客户端的文件夹->内容布局，用户可以快速切换关卡而不丢失导航位置
- **D-02:** 左侧世界/关卡树常驻显示，运行中也保持可见，用户始终能看到当前关卡在世界中的位置和整体进度
- **D-03:** 进入 Arena 时右侧主区域默认显示空状态引导 -- 欢迎信息 + "选择一个关卡开始挑战"提示，左侧树等待用户点击选择关卡

### Claude's Discretion
- 进度标记的具体视觉设计（通关/未通关/锁定的图标、颜色、Badge 样式）
- 锁定关卡的交互处理（可点击查看但不可开始 vs 完全禁用）
- 关卡详情页的具体布局（场景描述、评分维度说明、开始按钮的排列）
- 关卡详情页与现有 RunControls 组件的整合方式
- 顺序解锁规则细节（"通关"定义为至少一次 passed=1 的运行、每世界首关默认解锁、通关后可重复挑战）
- 运行历史的展示内容（日期、通关状态、评分摘要）和展示位置（关卡详情页内）
- 世界级别进度汇总展示（如 "2/5 通关"）
- 左侧世界树的宽度和内部排版

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEVL-03 | 世界->关卡两级层级结构，关卡按世界分组显示 | `loadAllWorlds()` 已提供完整层级数据，左侧树直接使用此数据源渲染可折叠世界->关卡层级 |
| LEVL-04 | 顺序解锁：通关前一关才能进入同世界的下一关 | 前端根据 progress API 返回的通关状态 + `sortOrder` 计算每关的 locked 状态 |
| UI-04 | 世界/关卡导航侧边栏，含进度标记（通关/未通关/锁定） | 新建 `WorldTree` 组件 + `WorldTreeItem`/`LevelTreeItem` 子组件，使用 Collapsible + ScrollArea |
| UI-05 | 关卡详情页：场景描述、评分维度说明、开始按钮 | 新建 `LevelDetail` 组件，整合现有 `RunControls` 的 provider 选择逻辑 + rubric 展示 |
| DATA-05 | 运行历史列表，展示每关的历次运行记录和成绩 | 新增 DB 查询 `getRunsByLevel()` + API 端点 `/api/arena/levels/[levelId]/runs`，关卡详情页内显示历史列表 |
</phase_requirements>

## Standard Stack

### Core (已有，无需新增依赖)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI 组件框架 | 项目已有 [VERIFIED: package.json] |
| radix-ui | latest | ScrollArea, Collapsible 组件 | 项目已有，`scroll-area.tsx` 和 `collapsible.tsx` 可直接使用 [VERIFIED: src/components/ui/] |
| @phosphor-icons/react | latest | 图标（Lock, Check, CheckCircle, CaretDown, CaretRight, Folder 等） | 项目已有，icon.tsx 已导出所需图标 [VERIFIED: src/components/ui/icon.tsx] |
| motion | latest | 动画（列表过渡、状态切换） | 项目已有，ConversationStream/GradeReport 已使用 [VERIFIED: package.json] |
| tailwind-merge + clsx | latest | 样式合并 | 项目已有 `cn()` 工具函数 [VERIFIED: package.json] |
| better-sqlite3 | latest | 数据库查询 | 项目已有 [VERIFIED: package.json] |
| zod | latest | schema 校验 | 项目已有 [VERIFIED: package.json] |

### Supporting (无需新增)

无新增依赖。所有需要的 UI 原语（Collapsible, ScrollArea, Card, Badge, Button, Separator, Tooltip）和图标均已在项目中可用。

**Installation:** 无需安装新包。

## Architecture Patterns

### 推荐项目结构变更

```
src/
├── components/arena/
│   ├── ArenaView.tsx          # [重构] 从全屏切换改为双栏布局
│   ├── WorldTree.tsx          # [新增] 左侧世界/关卡导航树
│   ├── WorldTreeItem.tsx      # [新增] 单个世界的折叠节点（含关卡列表）
│   ├── LevelTreeItem.tsx      # [新增] 单个关卡的树节点（含进度标记）
│   ├── LevelDetail.tsx        # [新增] 右侧关卡详情（描述、rubric、开始按钮、历史）
│   ├── RunHistoryList.tsx     # [新增] 运行历史列表
│   ├── EmptyState.tsx         # [新增] 右侧空状态引导
│   ├── LevelCardList.tsx      # [保留或弃用] 原卡片网格视图
│   ├── LevelCard.tsx          # [保留或弃用] 原卡片组件
│   ├── RunControls.tsx        # [保留] provider 选择逻辑可复用
│   ├── ConversationStream.tsx # [不变]
│   ├── GradeReport.tsx        # [不变]
│   └── types.ts               # [扩展] 新增进度相关类型
├── arena/
│   ├── db.ts                  # [扩展] 新增 getRunsByLevel, getLevelProgress 查询
│   └── ...
├── app/api/arena/
│   ├── levels/route.ts        # [扩展] 可在此端点增加 progress 数据，或新建独立端点
│   ├── progress/route.ts      # [新增] 批量获取所有关卡的通关状态
│   └── levels/[levelId]/
│       └── runs/route.ts      # [新增] 获取指定关卡的运行历史
└── i18n/
    ├── en.ts                  # [扩展] 新增 arena.nav.*, arena.detail.*, arena.progress.* 翻译
    └── zh.ts                  # [扩展] 同上
```

### Pattern 1: 双栏布局 (D-01, D-02)

**What:** ArenaView 重构为 `flex` 双栏，左侧固定宽度导航树 + 右侧弹性内容区
**When to use:** 所有 Arena 状态（空状态、关卡详情、运行中、已完成）都在此布局内切换

```typescript
// [VERIFIED: 遵循项目现有模式 - ArenaView.tsx 当前结构]
// ArenaView.tsx 重构示意
export function ArenaView() {
  const [selectedLevel, setSelectedLevel] = useState<SelectedLevel | null>(null);
  // ... existing SSE hook, state machine ...

  return (
    <div className="flex h-full">
      {/* 左侧导航树 - 固定宽度，始终可见 (D-02) */}
      <aside className="w-64 shrink-0 border-r overflow-hidden">
        <WorldTree
          selectedLevelId={selectedLevel?.levelId ?? null}
          onSelectLevel={handleSelectLevel}
        />
      </aside>

      {/* 右侧主内容区 */}
      <main className="flex-1 overflow-hidden">
        {/* 根据 viewState.phase + selectedLevel 切换内容 */}
        {viewState.phase === 'levels' && !selectedLevel && <EmptyState />}
        {viewState.phase === 'levels' && selectedLevel && <LevelDetail ... />}
        {(viewState.phase === 'running' || viewState.phase === 'completed') && (
          <ConversationStream ... />
        )}
      </main>
    </div>
  );
}
```

### Pattern 2: 可折叠世界树 (UI-04)

**What:** 用 Radix Collapsible 实现世界展开/折叠，每个世界下列出关卡
**When to use:** 左侧导航栏

```typescript
// [VERIFIED: Collapsible 已在 RunControls.tsx 使用]
// WorldTreeItem.tsx 示意
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';

function WorldTreeItem({ world, levels, progress, selectedLevelId, onSelectLevel }) {
  const clearedCount = levels.filter(l => progress[l.id]?.cleared).length;

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent">
        <CaretDown className="size-3.5" /> {/* 或 CaretRight when closed */}
        <span className="text-sm font-medium truncate">{world.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {clearedCount}/{levels.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {levels.map((level, index) => (
          <LevelTreeItem
            key={level.id}
            level={level}
            cleared={progress[level.id]?.cleared ?? false}
            locked={computeLocked(levels, progress, index)}
            isSelected={level.id === selectedLevelId}
            onClick={() => onSelectLevel(world.id, level)}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Pattern 3: 进度状态图标 (Claude's Discretion)

**What:** 每个关卡旁显示状态图标 -- 通关 CheckCircle (绿)、未通关 Circle (灰)、锁定 Lock (灰暗)
**推荐:** 使用项目已有的 `@phosphor-icons/react` 图标

```typescript
// [VERIFIED: CheckCircle, Circle, Lock 均已在 icon.tsx 导出]
function LevelStatusIcon({ cleared, locked }: { cleared: boolean; locked: boolean }) {
  if (locked) return <Lock size={14} className="text-muted-foreground/50" />;
  if (cleared) return <CheckCircle size={14} weight="fill" className="text-status-success" />;
  return <Circle size={14} className="text-muted-foreground" />;
}
```

### Pattern 4: Progress API (Data Layer)

**What:** 新增 DB 查询 + API 端点，返回所有关卡的通关状态
**核心查询逻辑:**

```sql
-- [VERIFIED: arena_runs 表结构包含 level_id, passed 字段]
-- 查询每个 level_id 是否至少有一次 passed=1 的运行
SELECT level_id, MAX(passed) as has_cleared
FROM arena_runs
WHERE status IN ('completed', 'terminated')
GROUP BY level_id;
```

```typescript
// arena/db.ts 新增
// [VERIFIED: 遵循现有 getArenaRun/getArenaGrade 的模式]
export function getLevelProgress(): Record<string, { cleared: boolean; runCount: number }> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT level_id, MAX(passed) as has_cleared, COUNT(*) as run_count
    FROM arena_runs
    WHERE status IN ('completed', 'terminated')
    GROUP BY level_id
  `).all() as Array<{ level_id: string; has_cleared: number | null; run_count: number }>;

  const progress: Record<string, { cleared: boolean; runCount: number }> = {};
  for (const row of rows) {
    progress[row.level_id] = {
      cleared: row.has_cleared === 1,
      runCount: row.run_count,
    };
  }
  return progress;
}
```

### Pattern 5: 顺序解锁逻辑 (LEVL-04)

**What:** 前端根据 `sortOrder` 顺序和通关状态计算每关的 locked 状态
**规则:**
1. 每个世界的第一关（sortOrder 最小）默认解锁
2. 后续关卡需前一关已通关（`cleared === true`）才解锁
3. 通关定义：至少一次 `passed=1` 的运行记录
4. 已通关的关卡可重复挑战

```typescript
// 前端纯函数，无需后端参与
// [ASSUMED] 这种纯前端计算方式对单用户桌面应用足够安全
function computeLevelsWithLockState(
  levels: ArenaLevelInfo[],  // 已按 sortOrder 排序
  progress: Record<string, { cleared: boolean }>
): Array<ArenaLevelInfo & { locked: boolean; cleared: boolean }> {
  return levels.map((level, index) => {
    const cleared = progress[level.id]?.cleared ?? false;
    // 第一关始终解锁，后续关卡需前一关通关
    const locked = index === 0
      ? false
      : !(progress[levels[index - 1].id]?.cleared ?? false);
    return { ...level, locked, cleared };
  });
}
```

### Pattern 6: 运行历史 (DATA-05)

**What:** 按 level_id 查询历史运行，在关卡详情页内显示列表

```typescript
// arena/db.ts 新增
// [VERIFIED: arena_runs + arena_grades 表结构]
export function getRunsByLevel(levelId: string): Array<ArenaRun & { grade_passed?: number }> {
  const db = getDb();
  return db.prepare(`
    SELECT r.*, g.passed as grade_passed
    FROM arena_runs r
    LEFT JOIN arena_grades g ON g.run_id = r.id
    WHERE r.level_id = ?
    ORDER BY r.created_at DESC
  `).all(levelId) as Array<ArenaRun & { grade_passed?: number }>;
}
```

### Anti-Patterns to Avoid

- **过度组件化:** 世界树不需要拆成 5 个以上组件。WorldTree + WorldTreeItem + LevelTreeItem 三层足够
- **全局状态库:** 不要引入 zustand/jotai。项目模式是 React useState/useRef，进度数据通过 props 传递
- **后端强制解锁校验:** 单用户桌面应用不需要在 POST /api/arena/run 校验关卡是否已解锁。前端计算锁定状态 + 禁用按钮即可
- **轮询进度:** 不要用 setInterval 轮询进度 API。运行完成时（SSE run_completed 事件）手动刷新进度即可
- **嵌套路由:** Arena 是单页应用内的一个视图，不要用 Next.js 嵌套路由（/arena/world/xxx/level/yyy）。保持 `/arena` 单页，通过组件状态管理导航

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 可折叠树节点 | 自定义 disclosure 逻辑 | Radix `Collapsible` | 已在项目中使用，处理好了键盘可访问性和动画 |
| 滚动区域 | overflow-y-auto div | Radix `ScrollArea` | 已有组件，提供自定义滚动条样式和触摸支持 |
| 图标 | SVG 手写 | `@phosphor-icons/react` (Lock, CheckCircle, Circle 等) | 项目已有完整图标库 |
| 时间格式化 | 手写日期格式化 | `Intl.DateTimeFormat` (浏览器原生) | 无需引入 date-fns/dayjs，原生 API 足够 |
| 列表动画 | 手写 CSS transition | `motion` (AnimatePresence) | 项目已使用，参考 ConversationStream.tsx |

**Key insight:** 此阶段不需要引入任何新依赖。所有 UI 原语和工具函数项目中已全部具备。

## Common Pitfalls

### Pitfall 1: ArenaView 重构导致运行状态丢失

**What goes wrong:** 重构 ArenaView 为双栏时，如果破坏了现有的 viewState 状态机或 useArenaSSE hook 的生命周期，会导致运行中的对话中断或完成后无法显示评分
**Why it happens:** 现有 ArenaView 的 viewState (levels/running/completed) 和 arenaSSE hook 紧密耦合
**How to avoid:**
1. 保持 viewState 状态机不变，仅改变渲染位置（从全屏到右侧面板）
2. 确保 useArenaSSE hook 在 ArenaView 顶层调用，不会因为面板切换而卸载重建
3. selectedLevel 和 arenaSSE 状态之间的同步逻辑保持现有模式
**Warning signs:** 点击关卡树切换关卡后，运行中的对话消失

### Pitfall 2: 进度数据与关卡列表不同步

**What goes wrong:** levels API 返回关卡列表，progress API 返回通关状态，两者的 level_id 可能不匹配（如关卡配置文件被修改或删除）
**Why it happens:** 关卡配置来自文件系统（JSON），运行记录来自数据库，两者没有外键关联
**How to avoid:**
1. progress 数据以 level_id 为 key 的 Record 结构返回，前端在渲染时做安全的可选链访问（`progress[level.id]?.cleared ?? false`）
2. 不要假设数据库中的每个 level_id 都对应一个当前有效的关卡配置
**Warning signs:** 删除一个关卡 JSON 文件后应用崩溃

### Pitfall 3: 左侧树宽度挤压右侧内容

**What goes wrong:** 固定宽度的左侧树在小窗口下挤压右侧内容，导致对话消息或评分报告布局破裂
**Why it happens:** Electron 桌面应用窗口可调大小，但双栏布局的最小宽度没有约束
**How to avoid:**
1. 左侧树设 `w-64 shrink-0`（固定 256px，不可收缩）
2. 右侧内容区设 `flex-1 min-w-0 overflow-hidden`
3. 考虑整体最小宽度约束或在窄窗口下自动折叠树
**Warning signs:** ConversationStream 或 GradeReport 在双栏模式下布局异常

### Pitfall 4: LevelCardList/LevelCard 与新组件职责重叠

**What goes wrong:** 新建了 WorldTree + LevelDetail 后，旧的 LevelCardList + LevelCard 仍存在，代码冗余且数据流混乱
**Why it happens:** Phase 2 的卡片网格视图被 Phase 3 的树+详情双栏完全替代
**How to avoid:**
1. 明确定义 LevelCardList/LevelCard 的去留。推荐保留文件但不再在 ArenaView 中引用
2. 或者直接重构为新组件，避免两套并存
**Warning signs:** 同一份 worlds 数据被两个不同组件独立获取

### Pitfall 5: i18n key 遗漏

**What goes wrong:** 新增 UI 文本时忘记在 en.ts 和 zh.ts 两侧同步添加翻译 key
**Why it happens:** 项目自检清单明确要求 i18n 同步，但实际操作中容易遗漏
**How to avoid:** 每个新增组件完成后立即添加所有 i18n key，不要等到最后统一添加
**Warning signs:** 页面上出现翻译 key 原文（如 `arena.nav.worldProgress`）

### Pitfall 6: 运行中切换关卡的状态冲突

**What goes wrong:** 用户在一个关卡运行中（SSE 连接活跃）时，在左侧树点击了另一个关卡，导致 SSE 状态与 selectedLevel 不一致
**Why it happens:** D-02 要求运行中左侧树仍然可见，用户可能误操作
**How to avoid:**
1. 运行中禁用树节点点击，或者点击时弹出确认（放弃当前运行？）
2. 推荐简单方案：运行中高亮当前关卡，其他关卡节点可点击但切换到详情页不影响运行的 SSE 连接
3. 关键：selectedLevel 影响的是 "右侧显示什么"，运行状态由 viewState 独立管理
**Warning signs:** 运行中点击其他关卡后 SSE 连接断开

## Code Examples

### 已验证的数据获取模式

```typescript
// [VERIFIED: LevelCardList.tsx 第 26-48 行的 authFetch 模式]
// 所有前端数据获取使用 authFetch + useEffect + 三状态 (loading/error/data)
useEffect(() => {
  let cancelled = false;
  setLoading(true);

  authFetch('/api/arena/progress')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (!cancelled) setProgress(data.progress);
    })
    .catch(err => {
      if (!cancelled) setError(err.message);
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });

  return () => { cancelled = true; };
}, []);
```

### 已验证的 API 路由模式

```typescript
// [VERIFIED: src/app/api/arena/levels/route.ts 的模式]
// 所有 API 路由遵循: runtime 声明 + requireAuth + try/catch + JSON response
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    // ... business logic
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Internal error',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
```

### 已验证的组件样式模式

```typescript
// [VERIFIED: LevelCard.tsx 使用 Card + Badge + Button 的组合]
// [VERIFIED: GradeReport.tsx 使用 status-success / status-error 语义色]
// 状态颜色: text-status-success, text-status-error, text-muted-foreground
// 交互状态: hover:bg-accent, bg-sidebar-accent
```

### 已验证的 i18n 模式

```typescript
// [VERIFIED: 所有 arena 组件使用此模式]
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n';

const { t } = useTranslation();
// 使用: t('arena.xxx' as TranslationKey)
```

## State of the Art

| Old Approach (Phase 2) | Current Approach (Phase 3) | Impact |
|------------------------|---------------------------|--------|
| 全屏卡片网格 (LevelCardList) | 双栏: 左侧树 + 右侧详情/运行 | D-01 锁定决策 |
| 全屏状态切换 (levels/running/completed) | 左侧树常驻 + 右侧内容切换 | D-02 锁定决策 |
| 无进度追踪 | 每关通关/未通关/锁定状态 | UI-04 新功能 |
| 无运行历史 | 关卡详情页内显示历史列表 | DATA-05 新功能 |
| 无顺序解锁 | 前一关通关解锁下一关 | LEVL-04 新功能 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 前端计算解锁逻辑足够安全（不需后端校验） | Architecture Patterns - Pattern 5 | 低 -- 单用户桌面应用，即使绕过前端限制也只是影响自己的测试体验 |
| A2 | 运行中用户切换关卡时不中断 SSE 连接 | Common Pitfalls - Pitfall 6 | 中 -- 如果实现不当可能导致运行状态丢失，需在重构时仔细处理 |
| A3 | `arena_runs` 表现有索引 `idx_arena_runs_level` 足以支撑 progress 查询性能 | Architecture Patterns - Pattern 4 | 低 -- 桌面应用数据量小，即使全表扫描也不会慢 |

## Open Questions

1. **LevelCardList/LevelCard 是否保留？**
   - What we know: Phase 3 的双栏布局完全替代了 Phase 2 的卡片网格
   - What's unclear: 是保留文件作为备用，还是直接删除/重命名
   - Recommendation: 在重构 ArenaView 时不再引用这两个组件，但不主动删除文件（可能在其他地方还有参考价值）

2. **运行中切换关卡的交互方案**
   - What we know: D-02 要求树常驻可见，运行中用户能看到进度
   - What's unclear: 运行中点击其他关卡是否应该中断当前运行
   - Recommendation: 运行中允许点击查看其他关卡详情，但不允许开始新运行（SSE 只能有一个活跃连接）。如果要开始新运行，先取消当前运行

3. **进度数据的获取时机**
   - What we know: 需要 progress 数据来计算解锁状态
   - What's unclear: 是否在 levels API 中直接附带 progress（一次请求），还是单独的 progress API（两次请求）
   - Recommendation: 扩展现有 `GET /api/arena/levels` 端点，在返回 worlds 数据时同时查询并附带每个 level 的 progress 信息。一次请求完成，减少前端复杂度

## Project Constraints (from CLAUDE.md)

以下指令摘自 CLAUDE.md，计划必须遵守：

1. **测试框架: vitest** (来自 Husky/CLAUDE.md) -- 所有测试使用 vitest，不是 jest。但注意 ARCHITECTURE.md 记录项目使用 Playwright (E2E) + tsx + node:test (单元)
2. **语言: 中文** -- 所有回复和输出使用中文
3. **提交前测试:** `npm run test` 至少通过（typecheck + 单元测试）
4. **UI 改动需 CDP 验证:** 修改组件/样式后需用 chrome-devtools MCP 截图验证
5. **i18n 同步:** 新增 UI 文本需同步 `src/i18n/en.ts` 和 `zh.ts`
6. **数据库改动:** 如果需要修改 schema，需在 `src/lib/db.ts` 更新迁移逻辑
7. **类型更新:** 新增类型需更新 `src/types/index.ts`（但 arena 类型定义在 `src/components/arena/types.ts` 和 `src/arena/types.ts`）
8. **Commit 规范:** conventional commits 格式（feat/fix/refactor）
9. **禁止 git push:** 除非用户主动提出

## Sources

### Primary (HIGH confidence)
- `src/components/arena/ArenaView.tsx` -- 现有状态机和组件结构 [VERIFIED: codebase read]
- `src/components/arena/types.ts` -- 前端类型定义 [VERIFIED: codebase read]
- `src/arena/db.ts` -- 现有 DB CRUD 操作 [VERIFIED: codebase read]
- `src/arena/level-loader.ts` -- loadAllWorlds(), loadLevel() [VERIFIED: codebase read]
- `src/arena/types.ts` -- ArenaRun, ArenaMessage, ArenaGrade 类型 [VERIFIED: codebase read]
- `src/lib/db.ts` -- arena_runs/arena_messages/arena_grades 表 schema [VERIFIED: codebase read]
- `src/components/ui/icon.tsx` -- 可用图标列表 [VERIFIED: codebase read]
- `src/components/ui/scroll-area.tsx` -- Radix ScrollArea 组件 [VERIFIED: codebase read]
- `src/app/api/arena/levels/route.ts` -- API 路由模式参考 [VERIFIED: codebase read]
- `src/i18n/en.ts` + `zh.ts` -- 现有 arena i18n keys [VERIFIED: codebase read]
- `.planning/phases/03-world-navigation-progression/03-CONTEXT.md` -- 锁定决策 [VERIFIED: file read]

### Secondary (MEDIUM confidence)
- `src/components/layout/NavRail.tsx` -- 侧边栏导航模式参考 [VERIFIED: codebase read]
- `src/components/arena/RunControls.tsx` -- Collapsible 使用模式 [VERIFIED: codebase read]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 全部基于已有依赖，无需新增包
- Architecture: HIGH -- 基于对现有代码结构的逐文件审查，所有模式来自项目既有实践
- Pitfalls: HIGH -- 基于对 ArenaView 状态机和数据流的详细理解
- DB queries: HIGH -- 基于对 arena_runs 表结构和索引的直接确认

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (30 days -- stable domain, no fast-moving dependencies)
