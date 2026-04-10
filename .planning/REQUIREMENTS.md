# Requirements: Arena

**Defined:** 2026-04-10
**Core Value:** 让用户能系统化地评估 AI Agent 在不同场景下的表现，发现 prompt 设计的盲区和弱点。

## v1 Requirements

### Orchestration 编排引擎

- [ ] **ORCH-01**: 服务端编排器驱动 Gatekeeper→Challenger 对话循环，对话结束后调用 Grader 评分
- [ ] **ORCH-02**: Gatekeeper 通过结构化输出（含 `shouldEnd` 字段）自行判断何时结束对话
- [ ] **ORCH-03**: 硬性安全上限：每关设 maxTurns 上限，超出自动终止对话
- [ ] **ORCH-04**: Token 预算上限：单次运行超出预设 token 消耗时自动终止
- [ ] **ORCH-05**: 自动模式通过单个长连接 SSE 流实时推送对话进度和 Challenger 流式输出
- [ ] **ORCH-06**: `text-generator.ts` 扩展支持 `messages: ModelMessage[]` 参数（向后兼容）

### Grading 评分系统

- [ ] **GRAD-01**: 对话结束后 Grader 一次性评分，输入完整对话 transcript
- [ ] **GRAD-02**: 混合评分制：必须项 Pass/Fail（全过才通关）+ 表现项 A/B/C/D 等级
- [ ] **GRAD-03**: Rubric anchoring：每个等级在关卡配置中附带具体行为描述示例
- [ ] **GRAD-04**: Grader 输出用 Zod schema 校验，确保结构化和类型安全
- [ ] **GRAD-05**: Grader 输出包含最多 3 条改进建议，引用具体对话轮次

### Level System 关卡体系

- [ ] **LEVL-01**: 关卡通过 JSON 文件定义（场景描述、Challenger prompt、Gatekeeper prompt、评分标准）
- [ ] **LEVL-02**: 应用启动时用 Zod schema 校验关卡配置合法性
- [ ] **LEVL-03**: 世界→关卡两级层级结构，关卡按世界分组显示
- [ ] **LEVL-04**: 顺序解锁：通关前一关才能进入同世界的下一关

### UI 用户界面

- [ ] **UI-01**: CodePilot 侧边栏新增 Arena 入口，与 Chat、Plugins 并列
- [ ] **UI-02**: 对话实时流展示，区分 Gatekeeper（左侧）和 Challenger（右侧）消息
- [ ] **UI-03**: 评分报告页：通关/未通关状态、必须项逐条 Pass/Fail、表现项等级、改进建议
- [ ] **UI-04**: 世界/关卡导航侧边栏，含进度标记（通关✓/未通关/锁定🔒）
- [ ] **UI-05**: 关卡详情页：场景描述、评分维度说明、开始按钮

### Data 数据层

- [ ] **DATA-01**: SQLite 新增 `arena_runs` 表（运行记录、关卡ID、状态、通关结果）
- [ ] **DATA-02**: SQLite 新增 `arena_messages` 表（对话消息、角色、轮次、运行ID）
- [ ] **DATA-03**: SQLite 新增 `arena_grades` 表（评分详情 JSON、通关状态、运行ID）
- [ ] **DATA-04**: DB-first 架构：每轮对话先存库再推 SSE，支持断线恢复
- [ ] **DATA-05**: 运行历史列表，展示每关的历次运行记录和成绩

### Human Mode 人工模式

- [ ] **HUMN-01**: 用户可切换为人工 Gatekeeper 模式，手动输入提问
- [ ] **HUMN-02**: 人工模式使用逐轮 request-response（非长连接 SSE）
- [ ] **HUMN-03**: 人工模式下 Challenger 回复仍为流式展示

### Integration 集成

- [ ] **INTG-01**: 复用 CodePilot 已有的 Provider 配置和 Vercel AI SDK 调用链
- [ ] **INTG-02**: Gatekeeper、Challenger、Grader 三个角色可独立选择 provider 和 model
- [ ] **INTG-03**: 新增 UI 文本同步中英文 i18n 翻译

## v2 Requirements

### Power Features

- **POWR-01**: 对话回放功能，可逐轮重放对话并显示 Grader 标注
- **POWR-02**: 多次运行结果横向对比视图
- **POWR-03**: 批量运行模式（同一关卡跑多次取平均）
- **POWR-04**: 多模型对比（同一关卡用不同 Challenger 模型对比）
- **POWR-05**: 进度仪表盘（全局通关率、分数分布可视化）
- **POWR-06**: 关卡模板导入/导出分享
- **POWR-07**: 运行历史搜索/筛选

### Optimization

- **OPTM-01**: Token 成本实时计数器
- **OPTM-02**: 摘要检查点（每 N 轮压缩历史降低 token 消耗）
- **OPTM-03**: 外部 API Challenger 适配层（支持 Coze/Dify 等平台）

## Out of Scope

| Feature | Reason |
|---------|--------|
| Elo 排名系统 | 适用于众测对比场景，Arena 是单 agent 闯关模式 |
| 1-100 数值评分 | LLM 精确数值打分不可靠，用离散评分替代 |
| 红队/安全测试 | 不同的使用场景，超出 Arena 的定位 |
| 众包投票评分 | 桌面应用不适合众包模式 |
| 多模态评估（图片/语音） | v1 聚焦文本对话评估 |
| CI/CD 集成 | Arena 是交互式桌面工具，不是 CI 管道组件 |
| 关卡可视化编辑器 | v1 用 JSON 文件手动编辑，降低复杂度 |
| 示范回放 | v1 不做通关/失败示范播放功能 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORCH-01 | — | Pending |
| ORCH-02 | — | Pending |
| ORCH-03 | — | Pending |
| ORCH-04 | — | Pending |
| ORCH-05 | — | Pending |
| ORCH-06 | — | Pending |
| GRAD-01 | — | Pending |
| GRAD-02 | — | Pending |
| GRAD-03 | — | Pending |
| GRAD-04 | — | Pending |
| GRAD-05 | — | Pending |
| LEVL-01 | — | Pending |
| LEVL-02 | — | Pending |
| LEVL-03 | — | Pending |
| LEVL-04 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |
| UI-04 | — | Pending |
| UI-05 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| DATA-04 | — | Pending |
| DATA-05 | — | Pending |
| HUMN-01 | — | Pending |
| HUMN-02 | — | Pending |
| HUMN-03 | — | Pending |
| INTG-01 | — | Pending |
| INTG-02 | — | Pending |
| INTG-03 | — | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 0
- Unmapped: 31

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after initial definition*
