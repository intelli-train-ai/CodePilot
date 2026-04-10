# Arena — Agent 闯关测试框架

## What This Is

Arena 是 CodePilot 内嵌的通用 Agent 测试框架。用户通过配置关卡（场景、评分标准），让 AI Agent（Challenger）接受自动或人工提问（Gatekeeper），对话结束后由 Grader 按混合评分制（必须项 Pass/Fail + 表现项等级）判定通关。支持任意主题的 Agent 测试，如客服、健康管家、销售等。

## Core Value

让用户能系统化地评估 AI Agent 在不同场景下的表现，发现 prompt 设计的盲区和弱点。

## Requirements

### Validated

- [x] 对话实时展示：自动模式下实时流式展示 Gatekeeper 与 Challenger 的对话 — Validated in Phase 2: Auto Mode UI
- [x] 评分结果展示：通关/未通关状态、必须项逐条 Pass/Fail、表现项等级、改进建议 — Validated in Phase 2: Auto Mode UI
- [x] 侧边栏入口：在 CodePilot 侧边栏增加 Arena 入口，与 Chat、Plugins 并列 — Validated in Phase 2: Auto Mode UI

### Active

- [ ] 三角色编排：Challenger / Gatekeeper / Grader 通过服务端循环对话
- [ ] Challenger 接入：v1 用 Vercel AI SDK + System Prompt 内部模拟
- [ ] Gatekeeper AI 模式：LLM 根据场景 prompt 自动生成提问，自行判断何时结束
- [ ] Gatekeeper 人工模式：用户手动输入提问替代 AI Gatekeeper
- [ ] Grader 评分：对话结束后一次性评分，混合制（必须项 Pass/Fail + 表现项 A/B/C/D）
- [ ] 关卡配置：JSON 文件定义关卡（场景描述、Challenger prompt、Gatekeeper prompt、评分标准）
- [ ] 世界→关卡两级结构：关卡按世界分组，同世界内关卡有递进关系
- [ ] 顺序解锁：通关前一关才能进入下一关
- [ ] 对话实时展示：自动模式下实时流式展示 Gatekeeper 与 Challenger 的对话
- [ ] 评分结果展示：通关/未通关状态、必须项逐条 Pass/Fail、表现项等级、改进建议
- [ ] 历史记录持久化：每次运行的对话 transcript 和评分结果存入 SQLite
- [ ] 侧边栏入口：在 CodePilot 侧边栏增加 Arena 入口，与 Chat、Plugins 并列
- [ ] Provider 复用：使用 CodePilot 已有的 Provider 配置和 Vercel AI SDK 调用链

### Out of Scope

- 示范回放 — v1 不做通关/失败示范播放功能，后续版本再加
- 外部 API Challenger — v1 不支持调用外部已部署的 Agent API，后续版本再加
- 数值评分（1-100） — LLM 在精确数值打分上不可靠，改用离散评分
- 关卡编辑 UI — v1 关卡通过 JSON 文件配置，不做可视化编辑界面

## Context

- CodePilot 已有 Vercel AI SDK（`ai` 包 + `@ai-sdk/anthropic` 等）和多 Provider 支持（Anthropic、OpenAI、Google 等）
- 轻量 LLM 调用走 `src/lib/text-generator.ts` 的 `streamText()` 路径，Arena 三角色均用此路径
- Provider 解析通过 `src/lib/provider-resolver.ts`，可直接复用用户已配置的 API key
- 数据库使用 better-sqlite3，schema 在 `src/lib/db.ts`，Arena 需新增表
- 前端组件基于 React 19 + Radix UI + Tailwind CSS 4
- 侧边栏导航在 `src/components/layout/` 中管理
- i18n 支持中英文（`src/i18n/en.ts` + `zh.ts`）

## Constraints

- **Tech Stack**: 必须使用已有的 Vercel AI SDK + Provider 体系，不引入新 LLM 依赖
- **Database**: 使用已有的 better-sqlite3，新增 Arena 相关表
- **UI Framework**: 使用已有的 Radix UI + Tailwind CSS 组件体系
- **评分可靠性**: 不使用数值评分，仅用离散判断（Pass/Fail、A/B/C/D），提高 LLM 评分一致性
- **i18n**: 新增 UI 文本需同步中英文翻译

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 用 Vercel AI SDK 而非 Claude Agent SDK | Arena 只需轻量文本生成，不需要工具调用/MCP/子进程 | — Pending |
| 混合评分制（Pass/Fail + 等级） | LLM 精确数值打分不可靠，离散评分更稳定 | — Pending |
| Gatekeeper 自行判断结束 | 比固定轮数更灵活，能根据场景深度调整对话长度 | — Pending |
| v1 Challenger 仅内部模拟 | 降低复杂度，先验证核心流程，后续再加外部 API 适配 | — Pending |
| 关卡用 JSON 配置而非数据库 | 配置可版本控制、易于分享、方便批量管理 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 after Phase 2 completion*
