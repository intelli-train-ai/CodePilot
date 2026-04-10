# Feature Landscape

**Domain:** AI Agent 场景化测试/评估平台（桌面端，嵌入 CodePilot）
**Researched:** 2026-04-10
**Overall confidence:** MEDIUM-HIGH

> 本文基于 LMSYS Chatbot Arena、MT-Bench、AgentBench、tau-bench、Promptfoo、SmartRole、DeepEval、LangSmith 等现有产品的功能调研，结合 Arena 的 "三角色闯关" 定位进行分类。Arena 不是通用 LLM benchmark 平台，而是面向 prompt 设计者的场景化 Agent 测试工具，因此功能取舍以 "帮用户发现 prompt 盲区" 为核心标准。

---

## Table Stakes

用户开箱即期待的功能。缺少任何一项 = 产品不可用或体验断裂。

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| T1 | **三角色对话编排** (Challenger / Gatekeeper / Grader) | Arena 的核心机制，无此则产品不存在 | High | 服务端循环：Gatekeeper 提问 -> Challenger 回答 -> Gatekeeper 判断是否继续 -> 结束后 Grader 一次性评分。需处理流式输出、错误恢复、超时 |
| T2 | **实时对话流式展示** | 自动模式下用户需要看到 AI 之间的 "对战" 过程，否则只看结果缺少可观察性 | Medium | 类似 chat 界面但区分双方角色，用颜色/位置区分 Gatekeeper vs Challenger |
| T3 | **混合评分制** (Pass/Fail 必须项 + A/B/C/D 表现项) | 离散评分比数值评分（1-100）可靠性显著更高（研究证实 LLM 在二元/离散判断上一致性远高于连续数值）。必须项捕捉 "底线"，表现项捕捉 "程度" | Medium | Grader prompt 需精心设计 rubric，明确每个等级的判定标准。参考 Promptfoo 的 llm-rubric 模式 |
| T4 | **关卡 JSON 配置** | 让用户能定义测试场景而不需要写代码。可版本控制、可分享 | Medium | 包含：场景描述、Challenger system prompt、Gatekeeper prompt、评分标准（必须项列表 + 表现维度）、元数据（世界/关卡 ID、解锁条件） |
| T5 | **World -> Level 两级结构 + 顺序解锁** | 提供结构化的测试进度，让评测不是散乱的一堆测试而是有逻辑的递进 | Low | 侧边栏或关卡选择页展示世界分组，已通关/未通关/锁定状态可视化 |
| T6 | **评分结果展示** | 用户需要立即理解测试结果：通关/未通关 + 各项得分 + 改进建议 | Medium | 必须项逐条 Pass/Fail 打勾、表现项等级卡片、Grader 生成的改进建议文本 |
| T7 | **历史记录持久化** | 每次运行的 transcript + 评分必须持久保存，用户需要回溯对比 | Medium | SQLite 存储。需设计表结构：runs, transcripts, scores。支持按关卡/时间筛选 |
| T8 | **人工 Gatekeeper 模式** | 让用户亲自扮演提问者来测试 Challenger，比纯自动模式更灵活、更有针对性 | Medium | 复用 chat 输入 UI，但对话协议需区分：人工输入替代 Gatekeeper LLM 调用，Grader 仍然自动评分 |
| T9 | **Provider 复用** | 使用 CodePilot 已有的 API key 和 Provider 配置，零额外配置即可开始测试 | Low | 直接调用 provider-resolver.ts，不新增 LLM 依赖 |
| T10 | **i18n 中英文支持** | CodePilot 已有双语支持，Arena UI 文本必须同步 | Low | 新增 arena 相关 key 到 en.ts / zh.ts |

---

## Differentiators

Arena 相比通用 benchmark 工具（Promptfoo、MT-Bench）的独特价值。不是必须有，但有了能显著提升竞争力。

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **对话 Transcript 回放** | 通关/失败后可逐步回放整个对话过程，标注 Grader 扣分点。类似 tau-bench 的 trace 分析但更可视化 | Medium | 不是简单显示历史——需要在 transcript 的关键节点标注 "此处 Challenger 偏离了主题"、"此处遗漏了关键信息" 等 Grader 标注 |
| D2 | **同一关卡多次运行对比** | 修改 prompt 后重跑同一关卡，并排对比两次运行的评分差异，直观看到 prompt 改进效果 | Medium | 参考 LLM Comparator 的并排对比设计。核心价值：让 prompt 优化从 "凭感觉" 变为 "看数据" |
| D3 | **关卡进度概览 Dashboard** | 以世界为单位展示所有关卡的通关状态、最佳成绩、平均分，一眼看到 Agent 在哪些场景弱 | Low-Med | 类似游戏关卡选择界面的可视化。雷达图/热力图展示各维度表现 |
| D4 | **Grader 改进建议细化** | Grader 不仅打分，还针对每个失分点给出具体可执行的 prompt 修改建议 | Low | 在 Grader prompt 中要求输出 actionable suggestions，不增加架构复杂度，只需 prompt engineering |
| D5 | **关卡 JSON 导入/导出** | 用户可以导出自己设计的关卡分享给他人，或导入社区/团队分享的关卡包 | Low | JSON 文件 + 可选的打包格式（zip with multiple levels）。为未来社区生态奠基 |
| D6 | **批量运行模式** | 一键跑完一个 World 的所有关卡（或选中的多个关卡），生成汇总报告 | Medium | 队列管理 + 进度条 + 汇总结果页。适合 prompt 大改后的回归测试场景 |
| D7 | **多模型对比** | 同一关卡用不同 Provider/Model 分别跑一次，对比不同模型在同一场景下的表现差异 | Medium | 复用已有的 multi-provider 体系。结果页需要并排展示 |
| D8 | **评分一致性校验** | 对同一个 transcript 多次运行 Grader，检测评分是否一致。解决 LLM-as-Judge 的固有不确定性问题 | Medium | 参考 Anthropic 的 pass@k / pass^k 指标。显示置信区间 |
| D9 | **关卡模板预设** | 内置常见场景模板（客服、销售、健康管家、技术支持等），降低用户创建第一个关卡的门槛 | Low | 几个 JSON 文件，附带说明文档。冷启动体验的关键 |
| D10 | **Transcript 搜索和过滤** | 在历史记录中按关键词、评分等级、通关状态搜索特定运行记录 | Low-Med | 基于 SQLite FTS 或简单 LIKE 查询 |

---

## Anti-Features

明确不做的功能。每一条都有充分理由。

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|--------------|-----------|-------------------|
| A1 | **数值评分（1-100 分）** | 研究一致表明 LLM 在连续数值评分上的一致性和可靠性远低于离散分类。0-5 与人类对齐最高，但 A/B/C/D 更直觉 | 使用离散 Pass/Fail + A/B/C/D 等级制。如需数值化只做等级到数值的后映射（A=4, B=3...），不让 LLM 直接出数字 |
| A2 | **Elo 排名 / 竞技场排行榜** | Chatbot Arena 式的 Elo 系统需要大量众包投票（600万+），不适合桌面端个人/团队使用场景。且 Elo 系统已被证明存在操纵风险 | Arena 专注于场景通关，不做模型间的全局排名。如需对比模型，用 D7 的并排对比即可 |
| A3 | **外部 Agent API 调用（v1）** | 增加大量复杂度：认证、超时、协议适配、错误处理。v1 核心价值是验证 prompt 设计，内部模拟足够 | v1 用 Vercel AI SDK + System Prompt 模拟 Challenger。后续版本再加外部 API 适配层 |
| A4 | **关卡可视化编辑器（v1）** | 编辑器 UI 开发成本高，JSON 编辑对目标用户（prompt 工程师/开发者）完全可接受 | 提供 JSON schema + 文档 + 示例模板。后续版本可加 form-based 编辑器 |
| A5 | **红队 / 安全测试** | Promptfoo 已被 OpenAI 收购专做此方向。Arena 的定位是场景化能力评估，不是安全审计 | 专注于 "Agent 在场景中表现如何"，不做 prompt injection / jailbreak 检测 |
| A6 | **生产监控 / Observability** | 这是 Langfuse、Arize 等工具的领域。Arena 是离线测试工具，不是运行时监控 | 保持 "测试-评分-改进" 的离线循环，不接入生产 trace |
| A7 | **众包评价 / 社区投票** | 桌面端用户群无法支撑众包规模。且投票机制被证明存在操纵风险 | 评分由 Grader LLM 或用户自己完成，不引入第三方投票 |
| A8 | **通关示范回放（v1）** | 增加复杂度，需要存储 "标准答案" 对话。v1 先验证核心流程 | 后续版本再加。Grader 的改进建议（D4）已部分覆盖此需求 |
| A9 | **CI/CD 集成** | 桌面应用不适合做 CI/CD 集成。这是 Promptfoo 等 CLI 工具的场景 | Arena 保持桌面 GUI 体验，如需自动化跑测，后续可提供 CLI 子命令 |
| A10 | **多模态评测（图片/音频/视频）** | v1 专注文本对话场景，多模态增加大量 UI 和 SDK 复杂度 | 后续版本按需扩展。文本场景已覆盖绝大多数 Agent 评测需求 |

---

## Feature Dependencies

```
T1 (三角色编排) ─── 所有功能的基础
├── T2 (实时流式展示) ← 依赖 T1 的对话循环
├── T3 (混合评分制) ← 依赖 T1 的 Grader 环节
│   └── T6 (评分结果展示) ← 依赖 T3 的评分数据
│       ├── D1 (Transcript 回放) ← 依赖 T6 + T7
│       ├── D2 (多次运行对比) ← 依赖 T6 + T7
│       └── D4 (改进建议细化) ← 依赖 T3 的 Grader prompt
├── T4 (关卡 JSON 配置) ← 依赖 T1 理解配置格式
│   ├── T5 (World/Level 结构) ← 依赖 T4 的配置定义
│   │   └── D3 (进度概览 Dashboard) ← 依赖 T5 + T7
│   ├── D5 (导入/导出) ← 依赖 T4 的 JSON 格式
│   └── D9 (模板预设) ← 依赖 T4 的配置格式
├── T7 (历史记录持久化) ← 依赖 T1 产出的数据
│   └── D10 (搜索过滤) ← 依赖 T7 的数据存储
├── T8 (人工模式) ← 依赖 T1 的对话协议，替换 Gatekeeper
├── T9 (Provider 复用) ← T1 依赖此获取 LLM 能力
└── T10 (i18n) ← 所有 UI 组件依赖此

D6 (批量运行) ← 依赖 T1 + T4 + T5 + T7
D7 (多模型对比) ← 依赖 T1 + T9 + D2
D8 (评分一致性) ← 依赖 T3 + T7
```

---

## MVP Recommendation

### Phase 1: Core Loop (必须先达成，否则产品无价值)

**优先构建：**
1. **T9 Provider 复用** — 零成本复用已有基础设施
2. **T4 关卡 JSON 配置** — 定义关卡的数据格式，后续一切围绕它
3. **T1 三角色对话编排** — 核心引擎：Gatekeeper 提问 -> Challenger 回答 -> 循环 -> Grader 评分
4. **T3 混合评分制** — 评分是测试的最终产出
5. **T2 实时对话展示** — 用户需要看到过程
6. **T6 评分结果展示** — 用户需要看到结果

### Phase 2: Persistence + Structure (让产品从 "能用" 到 "好用")

7. **T7 历史记录持久化** — 存储运行记录
8. **T5 World/Level 结构 + 解锁** — 关卡组织和进度
9. **T10 i18n** — 中英文支持
10. **D9 模板预设** — 降低冷启动门槛

### Phase 3: Human Mode + Polish (扩展使用场景)

11. **T8 人工 Gatekeeper 模式** — 让人可以亲自测试
12. **D1 Transcript 回放** — 深度分析对话
13. **D4 改进建议细化** — 提升 Grader 输出质量

### Defer to Later Phases:

- **D2 多次运行对比** — 需要足够的历史数据积累后才有意义
- **D3 进度概览 Dashboard** — 需要 World/Level 结构 + 历史数据
- **D5 导入/导出** — 产品稳定后再开放
- **D6 批量运行** — 高级功能，核心循环验证后再加
- **D7 多模型对比** — 需要多运行对比 UI，可后续迭代
- **D8 评分一致性校验** — 高级分析功能
- **D10 搜索过滤** — 数据量大后再需要

---

## Key Research Insights

### 1. 离散评分 vs 数值评分

研究明确支持 Arena 选择离散评分（Pass/Fail + A/B/C/D）的决策。2025 年的 "Grading Scale Impact" 研究发现 0-5 等级制与人类评价对齐度最高。二元判断（Pass/Fail）的一致性远高于连续数值，Cohen's Kappa 可达 0.95。Arena 的混合制（必须项 Pass/Fail + 表现项 A/B/C/D）是文献支持的最佳方案。

### 2. Gatekeeper 自主结束 vs 固定轮数

tau-bench 使用模拟用户来驱动对话，结束条件是 "用户目标达成"。Arena 的 "Gatekeeper 自行判断结束" 设计与此一致，比固定轮数更合理。但需要在 Gatekeeper prompt 中明确定义结束条件，否则会出现对话过长或过早终止的问题。建议设置最大轮数作为安全阀（如 20 轮）。

### 3. LLM-as-Judge 的偏差

Position bias（48.4% 的判定在调换顺序后反转）和 verbosity bias 是已知问题，但 Arena 的 Grader 是对单个 Challenger 的表现评分，不是对比两个模型，因此 position bias 的影响较小。主要需关注的是：
- **Self-enhancement bias**：避免用同一个模型同时当 Challenger 和 Grader
- **Rubric 质量**：明确的评分标准比模糊的 "评估表现" 一致性高 10 倍以上
- **Chain-of-thought**：要求 Grader 先分析再打分，显著提升评分质量

### 4. 与竞品的差异化定位

| 竞品 | 定位 | Arena 的差异 |
|------|------|-------------|
| Chatbot Arena (LMSYS) | 众包盲评，模型排名 | Arena 不做排名，做场景通关 |
| MT-Bench | 固定 80 题基准测试 | Arena 支持自定义场景，有递进结构 |
| AgentBench | 8 种环境的学术 benchmark | Arena 面向终端用户，GUI 而非 CLI |
| tau-bench | 客服/零售领域专用 | Arena 通用场景，不限领域 |
| Promptfoo | 开发者 CLI 工具，prompt 回归测试 | Arena 是桌面 GUI，强调可视化和游戏化体验 |
| SmartRole | 客服培训 SaaS | Arena 测 AI Agent，不测人类 |

Arena 的独特组合是：**场景化 + 游戏化进度 + 桌面 GUI + 混合评分 + 自定义关卡**。没有现成产品完全覆盖这个组合。

---

## Sources

- [LMSYS Chatbot Arena](https://www.lmsys.org/blog/2023-05-03-arena/) — 众包盲评机制参考
- [MT-Bench 论文](https://arxiv.org/abs/2306.05685) — LLM-as-a-Judge 方法论
- [AgentBench](https://github.com/THUDM/AgentBench) — 多维度 Agent 基准测试
- [tau-bench (Sierra)](https://sierra.ai/blog/benchmarking-ai-agents) — 场景化 Agent 评估
- [Promptfoo LLM Rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/) — 结构化评分模板
- [Anthropic: Demystifying Evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — Agent 评估最佳实践
- [Grading Scale Impact on LLM-as-a-Judge](https://arxiv.org/html/2601.03444v1) — 评分量表可靠性研究
- [LLM Comparator (Google PAIR)](https://github.com/PAIR-code/llm-comparator) — 并排对比可视化
- [SmartRole](https://www.smartrole.ai/) — 角色扮演评估平台参考
- [10 AI Agent Benchmarks (Evidently AI)](https://www.evidentlyai.com/blog/ai-agent-benchmarks) — Agent benchmark 全景
