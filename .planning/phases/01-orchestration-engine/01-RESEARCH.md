# Phase 1: Orchestration Engine - Research

**Researched:** 2026-04-10
**Domain:** 服务端编排引擎 — 三角色 LLM 对话循环、结构化评分、SQLite 持久化、SSE 流式推送
**Confidence:** HIGH

## Summary

Phase 1 构建 Arena 的核心后端引擎：Gatekeeper→Challenger 对话循环、Grader 评分、SQLite 数据持久化、SSE 实时推送、关卡 JSON 配置加载验证。

技术栈完全复用现有 CodePilot 基础设施：Vercel AI SDK v6 (`ai@6.0.73`) 提供 `streamText` 和 `generateText` 用于三角色 LLM 调用，`provider-resolver.ts` 处理多 Provider 路由，`better-sqlite3` 持久化数据，Zod v4 (`zod@4.3.6`) 校验关卡配置和 Grader 输出。关键扩展点是 `text-generator.ts` 需要新增 `messages: ModelMessage[]` 参数支持多轮对话（ORCH-06），以及 Grader 使用 AI SDK 的 `Output.object()` + Zod schema 获取结构化评分结果。

**Primary recommendation:** 以 `text-generator.ts` 扩展为第一步（阻塞依赖），然后按 DB schema → 关卡加载 → 编排循环 → Grader → SSE 的顺序构建。Grader 使用 `generateText` + `Output.object()` 获取 Zod 校验过的结构化输出，避免手动 JSON 解析。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single API call with synchronous while-loop drives the entire run. One request starts a run, the internal loop alternates Gatekeeper→Challenger until termination. SSE stream pushes progress in real time. Matches the existing chat streaming pattern in the codebase.
- **D-02:** Gatekeeper structured output parse failure: retry once, then terminate the run with an error record if parsing fails again. Balances reliability with resource consumption.
- **D-03:** Token budget (ORCH-04): default 200,000 tokens per run, counting input+output across all three roles (Gatekeeper + Challenger + Grader). Level config can override via `maxTokens` field.
- **D-04:** Level JSON files are bundled inside the application codebase (e.g., `src/arena/levels/`), shipped with the app. No user-directory discovery in v1.
- **D-05:** Directory structure uses world-folder grouping: each world is a folder containing `world.json` (world metadata) plus individual level JSON files (e.g., `levels/customer-service/world.json` + `level-01.json`).
- **D-06:** v1 ships with 1 example world containing 2-3 progressive levels, sufficient to validate sequential unlock and grading flow.

### Claude's Discretion
- SSE event protocol design (event types, payload format)
- Role model assignment mechanism (INTG-02: three roles independently select provider/model)
- Database schema column details for `arena_runs`, `arena_messages`, `arena_grades` tables
- Grader prompt engineering for reliable structured output
- Level JSON schema field design beyond what's specified in requirements

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORCH-01 | 服务端编排器驱动 Gatekeeper→Challenger 对话循环 | `text-generator.ts` 扩展 + while-loop 编排模式 |
| ORCH-02 | Gatekeeper 通过结构化输出 `shouldEnd` 自行判断结束 | AI SDK `Output.object()` + Zod schema 解析 |
| ORCH-03 | maxTurns 硬性上限 | 循环计数器 + 关卡配置字段 |
| ORCH-04 | Token 预算上限 | AI SDK `usage` 返回值累加追踪 |
| ORCH-05 | SSE 长连接实时推送 | 复用 `ReadableStream` + `formatSSE` 模式 |
| ORCH-06 | text-generator.ts 扩展支持 messages 参数 | AI SDK `streamText` 原生支持 `messages` 参数 |
| GRAD-01 | 对话结束后 Grader 一次性评分 | `generateText` + `Output.object()` 结构化输出 |
| GRAD-02 | 混合评分制 Pass/Fail + A/B/C/D | Zod schema 定义评分结构 |
| GRAD-03 | Rubric anchoring 等级行为描述 | 关卡 JSON schema 中 rubric 字段设计 |
| GRAD-04 | Grader 输出 Zod schema 校验 | Zod v4 + AI SDK `Output.object()` |
| GRAD-05 | 最多 3 条改进建议引用对话轮次 | Grader schema 中 suggestions 数组定义 |
| DATA-01 | arena_runs 表 | better-sqlite3 迁移模式 |
| DATA-02 | arena_messages 表 | better-sqlite3 迁移模式 |
| DATA-03 | arena_grades 表 | better-sqlite3 迁移模式 |
| DATA-04 | DB-first 先存库再推 SSE | 同步 better-sqlite3 保证写入后推送 |
| LEVL-01 | 关卡 JSON 定义 | Zod schema + `src/arena/levels/` 目录 |
| LEVL-02 | 启动时 Zod schema 校验 | 应用启动加载 + `z.safeParse` 校验 |
| INTG-01 | 复用 Provider 配置和 AI SDK 调用链 | `provider-resolver.ts` 直接复用 |
| INTG-02 | 三角色独立选择 provider/model | 关卡配置中 per-role provider/model 字段 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **测试框架**: vitest（workspace 级别 CLAUDE.md 规定），但实际项目使用 `tsx --test`（Node.js 原生 test runner）。Arena 单元测试应沿用项目既有的 `tsx --test` + `node:test` + `node:assert/strict` 模式。[VERIFIED: package.json scripts + 现有测试文件]
- **Commit 规范**: conventional commits 格式
- **提交前必须测试**: `npm run test` 通过（typecheck + unit tests）
- **i18n**: 新增 UI 文本需同步 `src/i18n/en.ts` 和 `zh.ts`（Phase 1 纯后端，暂不涉及）
- **禁止原生 HTML 标签**: 使用 `@/components/ui`（Phase 1 纯后端，暂不涉及）
- **ESLint**: 严格模式，不允许在业务组件中使用 any（第三方 SDK 例外）
- **函数设计**: 单函数不超过 500 行，3+ 参数使用对象参数
- **Import**: 使用 `@/` 路径别名

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai (Vercel AI SDK) | 6.0.73 | LLM 调用：streamText、generateText、Output.object() | 项目已有，三角色统一调用路径 [VERIFIED: package.json] |
| zod | 4.3.6 | Schema 校验：关卡配置、Grader 输出 | 项目已有（transitive dep），AI SDK peerDependency 明确支持 ^4.1.8 [VERIFIED: package-lock.json] |
| better-sqlite3 | 12.6.2 | 数据持久化：arena_runs、arena_messages、arena_grades | 项目已有，同步 API 保证 DB-first [VERIFIED: package.json] |
| uuid / nanoid | 13.0.0 / 5.1.6 | ID 生成 | 项目已有 [VERIFIED: package.json] |
| @ai-sdk/anthropic | 3.0.47 | Anthropic provider | 项目已有 [VERIFIED: package.json] |
| @ai-sdk/openai | 3.0.34 | OpenAI/OpenRouter provider | 项目已有 [VERIFIED: package.json] |
| @ai-sdk/google | 3.0.31 | Google provider | 项目已有 [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (Node.js built-in) | — | 生成 run ID、message ID | 复用 `crypto.randomBytes(16).toString('hex')` 模式 [VERIFIED: db.ts] |
| fs / path (Node.js built-in) | — | 关卡 JSON 文件读取 | 启动时加载 `src/arena/levels/` 目录 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| generateText + Output.object() (Grader) | 手动 JSON.parse + Zod parse | Output.object() 自动处理 schema → model → validate 全流程，手动方式需处理 JSON 提取、转义、retry |
| crypto.randomBytes | nanoid / uuid | 项目两者都有，db.ts 统一用 crypto.randomBytes，Arena 应保持一致 |

**Installation:**
```bash
# 无需安装新依赖 — 所有库已在项目中
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── arena/
│   ├── engine/
│   │   ├── orchestrator.ts       # 核心编排循环 (ORCH-01~05)
│   │   ├── gatekeeper.ts         # Gatekeeper 调用 + shouldEnd 解析 (ORCH-02)
│   │   ├── challenger.ts         # Challenger 调用 (流式)
│   │   ├── grader.ts             # Grader 评分 + 结构化输出 (GRAD-01~05)
│   │   └── token-tracker.ts      # Token 预算追踪 (ORCH-04)
│   ├── schemas/
│   │   ├── level-config.ts       # 关卡 JSON Zod schema (LEVL-01)
│   │   ├── grader-output.ts      # Grader 输出 Zod schema (GRAD-04)
│   │   └── gatekeeper-output.ts  # Gatekeeper 结构化输出 schema (ORCH-02)
│   ├── levels/
│   │   └── customer-service/     # 示例世界 (D-05, D-06)
│   │       ├── world.json
│   │       ├── level-01.json
│   │       └── level-02.json
│   ├── level-loader.ts           # 关卡加载 + 校验 (LEVL-02)
│   └── db.ts                     # Arena DB 操作 (DATA-01~04)
├── app/api/arena/
│   ├── run/route.ts              # POST: 启动 run (SSE 流)
│   └── levels/route.ts           # GET: 关卡列表
└── lib/
    └── text-generator.ts         # 扩展 messages 支持 (ORCH-06)
```

### Pattern 1: 编排循环 (Orchestrator Loop)

**What:** 单 API 请求触发 while-loop，循环内交替调用 Gatekeeper → Challenger，循环外调用 Grader。
**When to use:** D-01 锁定决策，每次 run 由一个 HTTP 请求驱动。

```typescript
// [VERIFIED: 基于 chat/route.ts 的 ReadableStream + formatSSE 模式]
export async function runArena(params: RunParams): Promise<ReadableStream<string>> {
  return new ReadableStream<string>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: ArenaSSEEvent) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      };

      // 创建 run 记录 (DB-first)
      const run = createArenaRun({ levelId: params.levelId, ... });
      emit({ type: 'run_started', data: { runId: run.id } });

      let turn = 0;
      let tokenBudget = params.maxTokens ?? 200_000;
      const transcript: Message[] = [];

      while (turn < params.maxTurns) {
        // 1. Gatekeeper 生成提问
        const gkResult = await callGatekeeper(transcript, params);
        tokenBudget -= gkResult.usage.totalTokens;
        if (tokenBudget <= 0) { /* 终止: token 超限 */ break; }

        // DB-first: 先存库
        saveArenaMessage(run.id, 'gatekeeper', gkResult.content, turn);
        emit({ type: 'gatekeeper_message', data: { content: gkResult.content, turn } });

        if (gkResult.shouldEnd) break;

        // 2. Challenger 流式回复
        for await (const chunk of callChallenger(transcript, params)) {
          emit({ type: 'challenger_delta', data: { delta: chunk, turn } });
        }
        // DB-first: 完整回复存库
        saveArenaMessage(run.id, 'challenger', challengerFull, turn);
        emit({ type: 'challenger_message', data: { content: challengerFull, turn } });

        turn++;
      }

      // 3. Grader 评分
      const grade = await callGrader(transcript, params);
      saveArenaGrade(run.id, grade);
      emit({ type: 'grade_result', data: grade });

      emit({ type: 'run_completed', data: { runId: run.id, passed: grade.passed } });
      controller.close();
    }
  });
}
```

### Pattern 2: text-generator.ts 扩展 (ORCH-06)

**What:** 向后兼容扩展 `StreamTextParams`，新增可选 `messages` 字段。
**When to use:** Arena 多轮对话需要传入 conversation history。

```typescript
// [VERIFIED: 基于现有 text-generator.ts 结构]
// 现有 StreamTextParams 已有 prompt + system
// 新增 messages 字段，与 prompt 互斥
export interface StreamTextParams {
  providerId: string;
  model: string;
  system: string;
  prompt: string;         // 保持不变
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;  // 新增
  maxTokens?: number;
  abortSignal?: AbortSignal;
}

// streamTextFromProvider 内部:
const result = streamText({
  model: model!,
  system: params.system,
  // messages 和 prompt 二选一
  ...(params.messages
    ? { messages: params.messages }
    : { prompt: params.prompt }),
  maxOutputTokens: params.maxTokens || 4096,
  abortSignal: params.abortSignal || AbortSignal.timeout(120_000),
});
```

### Pattern 3: Grader 结构化输出

**What:** 使用 AI SDK `generateText` + `Output.object()` + Zod schema 获取经过校验的评分结果。
**When to use:** GRAD-01~05 评分环节。

```typescript
// [CITED: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data]
import { generateText, Output } from 'ai';
import { z } from 'zod';

const GraderOutputSchema = z.object({
  passed: z.boolean().describe('是否通关（所有必须项全部 Pass 才为 true）'),
  requiredCriteria: z.array(z.object({
    name: z.string().describe('必须项名称'),
    passed: z.boolean().describe('是否通过'),
    reason: z.string().describe('判定理由'),
  })).describe('必须项评估结果'),
  performanceDimensions: z.array(z.object({
    name: z.string().describe('表现维度名称'),
    grade: z.enum(['A', 'B', 'C', 'D']).describe('等级评分'),
    reason: z.string().describe('判定理由'),
  })).describe('表现项评估结果'),
  suggestions: z.array(z.object({
    content: z.string().describe('改进建议内容'),
    referenceTurn: z.number().describe('引用的对话轮次编号'),
  })).max(3).describe('最多 3 条改进建议'),
});

const { output } = await generateText({
  model: graderModel,
  output: Output.object({ schema: GraderOutputSchema }),
  system: graderSystemPrompt,
  prompt: buildGraderPrompt(transcript, rubric),
});
// output 已通过 Zod 校验，类型安全
```

### Pattern 4: Gatekeeper 结构化输出 (shouldEnd)

**What:** Gatekeeper 返回包含 `shouldEnd` 字段的结构化 JSON，用于控制循环终止。
**When to use:** ORCH-02。

```typescript
// [CITED: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data]
const GatekeeperOutputSchema = z.object({
  message: z.string().describe('Gatekeeper 的提问或结束语'),
  shouldEnd: z.boolean().describe('是否结束对话'),
  endReason: z.string().optional().describe('结束原因（仅 shouldEnd=true 时）'),
});

// 使用 generateText + Output.object 而非 streamText
// 因为需要完整解析 shouldEnd 字段后才能决定是否继续循环
const { output, usage } = await generateText({
  model: gatekeeperModel,
  output: Output.object({ schema: GatekeeperOutputSchema }),
  system: gatekeeperSystemPrompt,
  messages: transcript,
});
```

### Pattern 5: SSE Event Protocol (Arena 专用)

**What:** Arena 自定义 SSE 事件类型，与现有 chat SSE 分离。
**When to use:** ORCH-05。

```typescript
// [VERIFIED: 基于 src/types/index.ts SSEEvent 模式]
export type ArenaSSEEventType =
  | 'run_started'           // 运行开始
  | 'gatekeeper_message'    // Gatekeeper 完整消息
  | 'challenger_delta'      // Challenger 流式增量
  | 'challenger_message'    // Challenger 完整消息
  | 'turn_completed'        // 一轮结束
  | 'grading_started'       // 开始评分
  | 'grade_result'          // 评分结果
  | 'run_completed'         // 运行完成
  | 'run_error'             // 运行错误
  | 'token_usage';          // Token 使用量更新

export interface ArenaSSEEvent {
  type: ArenaSSEEventType;
  data: unknown;
}
```

### Pattern 6: Database Schema (Arena Tables)

**What:** 三张新表 + 迁移代码。
**When to use:** DATA-01~04。

```typescript
// [VERIFIED: 基于 db.ts 的 CREATE TABLE + migrateDb 模式]
// 在 initDb 中添加:
CREATE TABLE IF NOT EXISTS arena_runs (
  id TEXT PRIMARY KEY,
  level_id TEXT NOT NULL,
  world_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK(status IN ('running', 'completed', 'failed', 'terminated')),
  passed INTEGER,                    -- NULL while running, 0/1 after grading
  turn_count INTEGER NOT NULL DEFAULT 0,
  token_usage_total INTEGER NOT NULL DEFAULT 0,
  termination_reason TEXT,           -- 'gatekeeper_end' | 'max_turns' | 'token_budget' | 'error'
  gatekeeper_provider_id TEXT NOT NULL DEFAULT '',
  gatekeeper_model TEXT NOT NULL DEFAULT '',
  challenger_provider_id TEXT NOT NULL DEFAULT '',
  challenger_model TEXT NOT NULL DEFAULT '',
  grader_provider_id TEXT NOT NULL DEFAULT '',
  grader_model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_arena_runs_level ON arena_runs(level_id);
CREATE INDEX IF NOT EXISTS idx_arena_runs_status ON arena_runs(status);

CREATE TABLE IF NOT EXISTS arena_messages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('gatekeeper', 'challenger', 'system')),
  content TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  token_usage TEXT,                   -- JSON: { input_tokens, output_tokens }
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES arena_runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_arena_messages_run ON arena_messages(run_id);

CREATE TABLE IF NOT EXISTS arena_grades (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE,
  passed INTEGER NOT NULL,            -- 0/1
  grade_data TEXT NOT NULL,           -- JSON: full GraderOutput
  token_usage TEXT,                   -- JSON: grader call token usage
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES arena_runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_arena_grades_run ON arena_grades(run_id);
```

### Anti-Patterns to Avoid

- **SSE-first, DB-second:** DATA-04 明确要求 DB-first。better-sqlite3 是同步的，写入后立即推 SSE 不会有延迟问题。绝对不能先推 SSE 再写 DB（断线恢复会丢数据）。
- **手动 JSON.parse Grader 输出:** 不要从 LLM 文本响应中手动提取 JSON。使用 `Output.object()` 让 AI SDK 处理 schema 传递、响应解析、Zod 校验全流程。
- **共享 chat SSE 事件类型:** Arena SSE 事件与 chat SSE 是独立的协议。不要复用 `SSEEvent` 类型，定义 Arena 专用的事件类型。
- **在编排循环中使用 async generators:** D-01 锁定了 while-loop 模式。不要用 generator 或递归，保持简单的同步循环 + await。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM 结构化输出 | 手动 JSON.parse + regex 提取 | AI SDK `Output.object()` + Zod | 自动处理 schema → model prompt → response parsing → Zod validation，覆盖 edge cases（转义、partial JSON 等）[CITED: ai-sdk.dev/docs/ai-sdk-core/generating-structured-data] |
| Schema 校验 | 手动 if/else 类型检查 | Zod v4 `z.object().safeParse()` | 类型推导、错误消息、嵌套校验开箱即用 |
| Provider 解析 | 手动读 DB + 构建 API client | `resolveProvider()` + `toAiSdkConfig()` | 完整的解析链（explicit → session → default → env），支持所有 provider 类型 [VERIFIED: provider-resolver.ts] |
| SSE 格式化 | 手动拼接 `data:` + `\n\n` | 复用 `formatSSE()` 模式 | 已有的 JSON 序列化 + 换行符处理 [VERIFIED: claude-client.ts:176] |
| ID 生成 | `Math.random().toString(36)` | `crypto.randomBytes(16).toString('hex')` | 项目统一使用 crypto，256-bit 熵 [VERIFIED: db.ts] |
| Token 计数 | 手动 tokenizer 库 | AI SDK `usage.totalTokens` 返回值 | streamText/generateText 自带 usage 统计 [CITED: ai-sdk.dev/docs/reference/ai-sdk-core/stream-text] |

**Key insight:** 本项目已有完整的 LLM 调用 → Provider 解析 → SSE 流式 → DB 持久化基础设施。Arena 应最大化复用，不引入新的 LLM 调用路径。

## Common Pitfalls

### Pitfall 1: Gatekeeper shouldEnd 解析失败导致无限循环

**What goes wrong:** LLM 偶尔不遵守 structured output 格式，返回纯文本而非 JSON，shouldEnd 无法解析，循环永不终止。
**Why it happens:** 即使使用 Output.object()，某些模型/provider 可能不完美支持 structured output。
**How to avoid:**
1. D-02 锁定决策：解析失败重试一次，再失败终止 run
2. maxTurns 作为硬性安全网（ORCH-03）
3. Token budget 作为第二层安全网（ORCH-04）
4. 使用 `try-catch` 包裹 `generateText` + `Output.object()`，捕获 `NoObjectGeneratedError`
**Warning signs:** Run 时间异常长、token 消耗远超预期

### Pitfall 2: Token 预算计算遗漏 Grader 消耗

**What goes wrong:** Token budget 只统计 Gatekeeper + Challenger，Grader 调用时已超预算但无法中止。
**Why it happens:** D-03 明确要求跨三角色计数，但 Grader 在循环外调用容易遗漏。
**How to avoid:** Token tracker 在编排器级别维护，Grader 调用前检查剩余预算是否足够（预留 Grader 所需的 ~4000-8000 tokens）。
**Warning signs:** Grader 调用失败、总 token 超出配置值

### Pitfall 3: SSE 流在 Challenger 流式输出中断开

**What goes wrong:** Challenger 流式输出期间客户端断开，ReadableStream controller 抛错。
**Why it happens:** 长时间 run（多轮对话可能持续数分钟），网络不稳定。
**How to avoid:**
1. controller.enqueue 用 try-catch 包裹
2. 利用 AbortSignal 监听客户端断开
3. DB-first 保证数据已持久化，断线不丢数据
**Warning signs:** Unhandled promise rejection in ReadableStream

### Pitfall 4: 并发 Run 同一关卡导致 DB 竞争

**What goes wrong:** 用户快速点击导致同一关卡同时运行多个 run。
**Why it happens:** Arena API 没有锁机制。
**How to avoid:** 参考 chat/route.ts 的 `acquireSessionLock` 模式，或在 API 层检查是否有同一关卡的 running 状态 run。
**Warning signs:** 多条 running 状态的 arena_runs 记录

### Pitfall 5: Zod v4 与 AI SDK Output.object() 的兼容性

**What goes wrong:** Zod v4 schema 传入 `Output.object()` 时抛出类型错误或 JSON schema 转换失败。
**Why it happens:** AI SDK v6.0.73 的 peerDependency 声明 `zod ^3.25.76 || ^4.1.8`，理论上支持 v4，但 `zod-to-json-schema@3.25.1` 可能仍有边缘 case。
**How to avoid:**
1. 先写一个最小 POC 验证 `generateText` + `Output.object()` + Zod v4 schema 在本项目中正常工作
2. 如果 v4 有问题，使用 `zodSchema()` helper 包裹或回退到 `jsonSchema()` + 手动类型定义
**Warning signs:** `ZodFirstPartyTypeKind` 相关错误、schema 转换异常

## Code Examples

### Example 1: text-generator.ts 扩展（ORCH-06 核心变更）

```typescript
// [VERIFIED: 基于现有 text-generator.ts:98-108]
// 扩展 streamText 调用以支持 messages 参数

export interface StreamTextParams {
  providerId: string;
  model: string;
  system: string;
  prompt: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  maxTokens?: number;
  abortSignal?: AbortSignal;
}

// 在 streamTextFromProvider 函数内部，替换 streamText 调用:
const result = streamText({
  model: model!,
  system: params.system,
  ...(params.messages && params.messages.length > 0
    ? { messages: params.messages }
    : { prompt: params.prompt }),
  maxOutputTokens: params.maxTokens || 4096,
  abortSignal: params.abortSignal || AbortSignal.timeout(120_000),
});
```

### Example 2: Arena DB 操作函数

```typescript
// [VERIFIED: 基于 db.ts 的 CRUD 模式]
import { getDb } from '@/lib/db';
import crypto from 'crypto';

export function createArenaRun(params: {
  levelId: string;
  worldId: string;
  gatekeeperProviderId: string;
  gatekeeperModel: string;
  challengerProviderId: string;
  challengerModel: string;
  graderProviderId: string;
  graderModel: string;
}): ArenaRun {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  db.prepare(`
    INSERT INTO arena_runs (id, level_id, world_id, status, gatekeeper_provider_id, gatekeeper_model, challenger_provider_id, challenger_model, grader_provider_id, grader_model, created_at)
    VALUES (?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, params.levelId, params.worldId, params.gatekeeperProviderId, params.gatekeeperModel, params.challengerProviderId, params.challengerModel, params.graderProviderId, params.graderModel, now);

  return db.prepare('SELECT * FROM arena_runs WHERE id = ?').get(id) as ArenaRun;
}
```

### Example 3: 关卡配置 Zod Schema

```typescript
// [VERIFIED: Zod v4 语法, 基于项目现有 zod 使用模式]
import { z } from 'zod';

export const RubricItemSchema = z.object({
  name: z.string().describe('评分项名称'),
  type: z.enum(['required', 'performance']).describe('required=必须项, performance=表现项'),
  description: z.string().describe('评分项说明'),
  // required 类型：只有 pass/fail
  // performance 类型：A/B/C/D 各等级的行为描述
  gradeDescriptions: z.record(z.string()).optional().describe('等级→行为描述 mapping，如 {"A":"...", "B":"...", ...}'),
});

export const LevelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().describe('场景描述（展示给用户）'),
  challengerSystemPrompt: z.string().describe('Challenger 的 system prompt'),
  gatekeeperSystemPrompt: z.string().describe('Gatekeeper 的 system prompt'),
  graderSystemPrompt: z.string().optional().describe('Grader 的 system prompt（可选，有默认值）'),
  rubric: z.array(RubricItemSchema).describe('评分标准'),
  maxTurns: z.number().int().positive().default(10).describe('最大对话轮数'),
  maxTokens: z.number().int().positive().optional().describe('Token 预算上限（覆盖默认 200,000）'),
  roleConfig: z.object({
    gatekeeper: z.object({ providerId: z.string().optional(), model: z.string().optional() }).optional(),
    challenger: z.object({ providerId: z.string().optional(), model: z.string().optional() }).optional(),
    grader: z.object({ providerId: z.string().optional(), model: z.string().optional() }).optional(),
  }).optional().describe('角色级别的 provider/model 覆盖'),
  sortOrder: z.number().int().default(0).describe('关卡排序'),
});

export const WorldConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export type LevelConfig = z.infer<typeof LevelConfigSchema>;
export type WorldConfig = z.infer<typeof WorldConfigSchema>;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK `generateObject()` 独立函数 | `generateText()` + `Output.object()` 组合 | AI SDK v5+ (2025) | Schema 通过 Output helper 传入，与 generateText/streamText 统一 [CITED: ai-sdk.dev/docs/ai-sdk-core/generating-structured-data] |
| Zod v3 `z.object()` | Zod v4 `z.object()` + `.meta()` | 2025 | `.describe()` 仍可用，但推荐 `.meta({ describe: '...' })`；AI SDK 两者都支持 [CITED: ai-sdk.dev/docs/reference/ai-sdk-core/zod-schema] |
| AI SDK `prompt` only | `messages` array 原生支持 | AI SDK v4+ | `streamText` / `generateText` 均支持 `messages` 参数替代 `prompt` |

**Deprecated/outdated:**
- `generateObject` 作为独立顶层函数：在 AI SDK v6 中仍然可用但推荐使用 `generateText` + `Output.object()` 模式 [ASSUMED]
- Zod v3 的 `.describe()` 语法在 v4 中仍然兼容，但 `.meta()` 是新的推荐方式 [CITED: ai-sdk.dev/docs/reference/ai-sdk-core/zod-schema]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `generateObject` 在 AI SDK v6 中仍可用，但 `generateText` + `Output.object()` 是推荐方式 | State of the Art | 如果 `generateObject` 已移除需要确认替代 API；如果 `Output.object()` 不可用需回退到 `generateObject` |
| A2 | Zod v4 `.describe()` 在 AI SDK Output.object() 中正常工作 | Code Examples | 如果不兼容需改用 `.meta({ describe: '...' })` 或 `zodSchema()` wrapper |
| A3 | AI SDK `streamText` 的 `usage` 返回 `totalTokens` 包含 input + output | Patterns | 如果只返回 output tokens，需要额外计算 input tokens |

## Open Questions

1. **Zod v4 + Output.object() 实际兼容性**
   - What we know: AI SDK v6.0.73 peerDep 声明支持 zod ^4.1.8，项目安装了 zod 4.3.6
   - What's unclear: 实际调用 `Output.object()` + Zod v4 schema 是否有边缘问题
   - Recommendation: Phase 1 实施第一步写一个最小 POC 验证此路径

2. **generateText vs generateObject 在当前 AI SDK 版本**
   - What we know: 文档推荐 `generateText` + `Output.object()`
   - What's unclear: `generateObject` 是否仍是独立 export
   - Recommendation: 优先使用 `generateText` + `Output.object()`，如不可用再回退 `generateObject`

3. **Arena 角色的默认 Provider/Model**
   - What we know: INTG-02 要求三角色可独立选择
   - What's unclear: 用户未配置时的 fallback 策略
   - Recommendation: 未配置时 fallback 到用户全局默认 provider + model（通过 `resolveProvider()` 无参调用）

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 全部 | 可用 | 22.22.0 | — |
| ai (Vercel AI SDK) | LLM 调用 | 可用 (package.json) | 6.0.73 | — |
| zod | Schema 校验 | 可用 (transitive) | 4.3.6 | — |
| better-sqlite3 | 数据持久化 | 可用 (package.json) | 12.6.2 | — |
| tsx | 单元测试 | 可用 (devDependency) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.
**Note:** `node_modules` 目录不存在于当前环境（可能是 CI 或 clean checkout），但所有依赖已声明在 package.json 中。实施前需 `npm install`。

## Sources

### Primary (HIGH confidence)
- `src/lib/text-generator.ts` — 当前 streamText 实现，ORCH-06 扩展基础
- `src/lib/provider-resolver.ts` — Provider 解析链，INTG-01 直接复用
- `src/lib/db.ts` — DB schema、迁移模式、CRUD 模式
- `src/lib/claude-client.ts` — SSE formatSSE 模式、ReadableStream 模式
- `src/app/api/chat/route.ts` — API route 模式、session lock 模式
- `src/types/index.ts` — SSEEvent 类型定义
- `package.json` / `package-lock.json` — 依赖版本验证

### Secondary (MEDIUM confidence)
- [AI SDK: Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) — Output.object() + Zod schema 用法
- [AI SDK: streamText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) — messages 参数、usage 返回值
- [AI SDK: zodSchema Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/zod-schema) — Zod v4 兼容性、.meta() 语法

### Tertiary (LOW confidence)
- [GitHub Issue #7189](https://github.com/vercel/ai/issues/7189) — zod-to-json-schema 与 Zod v4 兼容性讨论（可能已解决）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 全部复用现有依赖，版本已验证
- Architecture: HIGH — 模式直接基于现有代码库 patterns
- Pitfalls: MEDIUM — Zod v4 兼容性需实测验证（A2）
- SSE Protocol: HIGH — 完全基于已有 chat SSE 模式

**Research date:** 2026-04-10
**Valid until:** 2026-05-10（稳定栈，30 天有效）
