# Codebase Concerns

**Analysis Date:** 2026-04-09

## Tech Debt

**ESLint Errors (存量 4 个)**
- Issue: CI lint 步骤中存在 4 个 error，阻止自动化通过但代码仍能运行
- Files: `src/components/chat/MessageItem.tsx` (hooks 条件调用), `src/components/chat/ChatView.tsx` (impure render), `src/components/gallery/GalleryDetail.tsx` (setState in effect)
- Impact: Pre-commit hook 跳过 lint，手动测试后仍能提交，但 CI 需要 `continue-on-error`
- Fix approach: 修复各文件的特定 ESLint 违规，具体为：hooks 需要无条件调用、render 不能有副作用、effect 不能直接 setState

**Runtime Registry 内存依赖**
- Issue: `conversation-registry.ts` 和 `permission-registry.ts` 中的活跃 SDK 会话和权限请求存储为 `Map<string, ...>` 在内存中，应用重启或部署后丢失
- Files: `src/lib/conversation-registry.ts`, `src/lib/permission-registry.ts`
- Impact: 长时间运行的桥接会话、待批准的权限请求在 restart 后无法恢复；Bridge 模式下用户需要重新批准权限
- Fix approach: 将活跃状态迁移到 SQLite（新增表 `active_conversations`、`pending_permissions`），并在应用启动时恢复；添加超时清理机制

**消息上下文截断固定 50 条**
- Issue: `src/lib/stream-session-manager.ts` 中 fallback 上下文固定取最近 50 条消息，无动态 token 预算截断逻辑
- Files: `src/lib/stream-session-manager.ts` (line ~400-450)
- Impact: 长会话中上下文质量下降，重要信息可能被截断；llama-2 等小模型容易溢出 token 限制
- Fix approach: 实现动态上下文窗口，根据模型 max_tokens 和预留 output tokens，计算允许的输入 token 数，从最近消息向后遍历直至接近限制

**Context Storage Migration Phase 0 不完整**
- Issue: `projects` 表未建、`canUpdateSdkCwd` 函数未实现，影响多项目隔离
- Files: `src/lib/db.ts` (schema), `src/app/api/chat/route.ts`
- Impact: 无法正确隔离不同项目的会话上下文和工作目录；跨项目时上下文污染
- Fix approach: 按 `docs/exec-plans/active/context-storage-migration.md` Phase 0 补完 `projects` 表 schema、实现权限检查、更新 db.ts CRUD

**Bridge 权限语义不一致（Bridge vs Desktop）**
- Issue: Bridge 中 `/mode plan` 命令在 `full_access` 权限档位下被 `bypassPermissions` 覆盖，导致 Plan 语义失效；与桌面聊天不一致
- Files: `src/lib/bridge/permission-broker.ts`, `src/lib/bridge/conversation-engine.ts` (line ~300-350)
- Impact: Bridge 用户无法通过权限设置控制聊天模式，安全语义失效
- Fix approach: 在权限解析逻辑中，让显式的 Plan 模式优先于 full_access 档位；统一 Bridge 和桌面的权限语义

---

## Known Bugs

**Windows 发消息弹出 cmd 窗口 (P1)**
- Symptoms: 每次向 Claude 发送消息，Claude Code 子进程会弹出一个 cmd 窗口
- Files: `src/lib/claude-client.ts` (line ~60-90, spawn 调用)
- Trigger: 在 Windows 上运行 CodePilot，发送任何消息
- Root cause: `child_process.spawn()` 缺少 `windowsHide: true` 选项
- Workaround: 暂无
- Fix approach: 在 claude-client.ts 的 spawn options 中添加 `windowsHide: true`

**中文输入法误发送消息 (P1)**
- Symptoms: macOS 中文输入法输入后按回车确认，消息被直接发送而不是插入到输入框
- Files: `src/components/ai-elements/prompt-input.tsx` (composition handling, line ~200-250)
- Trigger: macOS with Chinese input method, compose character then press Enter
- Root cause: `compositionend` 事件同步重置 `isComposing` flag，后续 `keydown(Enter)` 看到 flag 已是 false 触发提交
- Workaround: 在输入法确认前不要按 Enter
- Fix approach: `handleCompositionEnd` 用 `setTimeout(0)` 延迟重置 `isComposing`，确保 keydown 看到正确状态（详见 GitHub issue #225）

**主题设置重启后丢失 (Windows) (P2)**
- Symptoms: 在设置中改变主题（亮/暗），关闭应用再打开，主题恢复为默认
- Files: `src/lib/theme/loader.ts`, localStorage 相关代码
- Trigger: Windows 上设置主题后重启应用
- Root cause: 主题设置仅存储在 localStorage，Electron 重启可能丢失；跨进程或存储策略问题
- Workaround: 每次启动手动设置主题
- Fix approach: 将主题设置迁移到 SQLite `settings` 表，应用启动时从 DB 恢复

**Windows GLM exit code 1 (P2)**
- Symptoms: v0.30+ 版本使用 GLM coding plan 报 exit code 1，而 v0.26 正常
- Files: 大概率同 #241（空 env 变量覆盖凭据），该 bug 已在 `src/lib/claude-client.ts` 修复待验证
- Trigger: 在 Windows 上使用 GLM 提供商做 plan 模式聊天
- Root cause: 环境变量中 undefined 值被 spawn 当作覆盖，造成 API 密钥丢失
- Status: 该问题已修复在 PR 中，待下个版本发布后验证
- Fix approach: 确保 sanitizeEnv() 函数正确过滤所有非字符串值

**Bridge 斜杠命令不识别 (P3)**
- Symptoms: 通过 Telegram/飞书/Discord 桥接发送 `/compact`、`/clear` 等命令无法识别
- Files: `src/lib/bridge/adapters/telegram-adapter.ts`, `src/lib/bridge/conversation-engine.ts`
- Trigger: 在桥接通道中输入任何以 `/` 开头的 Claude CLI 命令
- Root cause: 桥接使用 SDK `query()` 接口而非 CLI 命令行，CLI 层不解析斜杠命令
- Workaround: 在桌面客户端中执行，或在桥接消息前加注释说明
- Fix approach: 在 Bridge messageHandler 中增加命令拦截器，将特定斜杠命令转换为等价的 SDK 操作（如 `/clear` → 清空 context state）

---

## Security Considerations

**Type Safety Gaps in Feishu Plugin (High Risk)**
- Risk: `src/lib/channels/feishu/` 中大量 `any` 类型，特别是在 API 响应处理中，可能导致类型混淆攻击
- Files: 
  - `src/lib/channels/feishu/card-controller.ts` (line 1: eslint-disable, lines 99, 126, 179 等)
  - `src/lib/channels/feishu/outbound.ts` (line 1: eslint-disable, lines 132, 154, 177 等)
  - `src/lib/channels/feishu/gateway.ts` (lines 70, 93, 152-161)
  - `src/lib/channels/feishu/message-actions.ts` (lines 47, 68, 97, 118, 148, 153)
- Current mitigation: Line-level eslint-disable comments，但实际无类型保护
- Recommendations: 为飞书 SDK 响应创建专用 interfaces，逐步替代 `any`；至少对关键数据路径（消息内容、用户 ID、权限）做类型断言验证

**Process Env Spreading without Sanitization (Medium Risk)**
- Risk: 多处代码直接 spread `process.env` 到 spawn options，可能包含 undefined 或包含特殊字符的值，导致 EINVAL 或密钥泄露
- Files:
  - `src/lib/claude-client.ts` (multiple spawn calls)
  - `src/lib/platform.ts` (lines 224, 315, 349)
  - `src/lib/git/service.ts` (line 14)
  - `src/lib/cli-tools-mcp.ts` (line 84)
- Current mitigation: `src/lib/claude-client.ts` 中有 `sanitizeEnv()` 函数，但不是所有 spawn 调用都使用
- Recommendations: 在所有 spawn 调用前使用 sanitizeEnv()；创建 spawn wrapper 函数强制清理所有 env 参数；禁止直接 spread process.env

**Permission Request Storage in Memory (Medium Risk)**
- Risk: 待批准的权限请求存储在 `permission-registry` 的内存 Map，应用 crash 或强制关闭导致请求丢失，用户误以为已批准
- Files: `src/lib/permission-registry.ts`, `src/lib/bridge/permission-broker.ts`
- Current mitigation: 权限请求超时 5 分钟后自动清理，但无持久化
- Recommendations: 将待批准请求存储到 SQLite `pending_permissions` 表；启动时恢复已超时请求的列表并通知；实现权限请求日志审计

**File Path Validation in Bridge (Low-Medium Risk)**
- Risk: Bridge 中接受用户提交的文件路径（如 `/cwd` 回调），虽有 `validateWorkingDirectory()` 但仍需防止 traversal 和符号链接跨界
- Files: `src/lib/bridge/security/validators.ts`, `src/lib/bridge/bridge-manager.ts` (line ~700-800)
- Current mitigation: `validateWorkingDirectory()` 检查路径在项目根内，但未检查符号链接
- Recommendations: 使用 `fs.realpathSync()` 解析符号链接，确保不逃出项目根；加入文件系统能力检查（disallow `/dev`, `/proc`, `/sys`）

---

## Performance Bottlenecks

**Large Files Cause Render Freezes (High Impact)**
- Problem: `src/components/layout/panels/PreviewPanel.tsx` (1329 行) 和 `src/components/ai-elements/prompt-input.tsx` (1345 行) 是仓库最大的单个组件，monolithic 设计导致频繁全量 re-render
- Files: `src/components/layout/panels/PreviewPanel.tsx`, `src/components/ai-elements/prompt-input.tsx`
- Cause: 这两个组件处理所有输入解析、预览、图片生成、工具调用反馈，缺乏细粒度的 memo 和状态隔离
- Impact: 每次用户输入字符都会触发完整组件 re-render，导致 UI 卡顿；在文件附件多（>10 个）或生成图片中时明显
- Improvement path: 
  1. 将 PreviewPanel 按功能拆分：FilePreview 子组件、ImageGenPanel 子组件、OutputPreview 子组件，各自独立 memo
  2. 将 prompt-input 的状态分离：编辑状态、预览状态、图片生成状态分开管理，避免一个变化触发所有重新计算
  3. 使用 useTransition/useDeferredValue 延迟低优先级更新

**Database Query in Render Path (Medium Impact)**
- Problem: `src/lib/db.ts` 是同步 SQLite 操作，某些 API 路由在 render path 中触发 getDb().prepare().all() 会阻塞 event loop
- Files: `src/app/api/chat/sessions/[id]/route.ts`, `src/app/api/settings/route.ts` (message loading)
- Cause: better-sqlite3 同步 API，单次大查询（如加载 50 条消息）可能需要 50-200ms，在高频请求时累积
- Impact: 聊天列表加载 > 1s，消息历史加载卡顿，API 响应延迟
- Improvement path:
  1. 消息分页加载，初始加载最近 20 条，用户滚动时增量加载
  2. 在 API 层增加缓存层（内存 LRU cache 或 Redis），避免重复查询
  3. 考虑异步 SQL 库（如 `better-sqlite3` 的 worker 线程模式），但成本较高

**MCP Capability Fetching on Every Chat (Medium Impact)**
- Problem: `src/app/api/chat/route.ts` 每次启动新聊天都调用 `captureCapabilities()` 抓取 MCP server 能力，同步等待所有 server 响应
- Files: `src/app/api/chat/route.ts` (line ~150-200), `src/lib/agent-sdk-capabilities.ts`
- Cause: 无缓存机制，即使 server 配置未变也重复查询；MCP server 响应慢（如飞书 webhook）拖累首包延迟
- Impact: 新聊天首个 token 延迟 + 200-500ms，影响体感响应速度
- Improvement path: 
  1. 实现 capability 缓存（TTL 5 min），只在启动或配置变化时更新
  2. 将 capability fetching 移出首包关键路径（按 chat-latency-remediation.md Phase 3 方案）
  3. 异步获取并在后续步骤进行能力检查，不阻塞初始流启动

---

## Fragile Areas

**Bridge System Adapter Lifecycle (Critical)**
- Files: `src/lib/bridge/bridge-manager.ts`, `src/lib/bridge/adapters/*`
- Why fragile: 
  - Adapter event loop (`runAdapterLoop()`) 要在 `state.running = true` 之后调用；如果在之前启动，while 条件会同步求值为 false
  - Offset 安全水位：`fetchOffset`（API 调用结果）和 `committedOffset`（持久化状态）分离，只有 handleMessage 完全成功才推进 committed
  - 适配器重启/异常退出需要保证 idempotency，否则消息重复或丢失
- Safe modification: 
  - 修改 adapter 启动顺序前必须加注释说明 offset 水位机制
  - 新增 adapter 需要先通过 `registerAdapterFactory()` 自注册，再在 `src/lib/bridge/adapters/index.ts` import
  - 调整 handleMessage 流程需要 unit test 验证"成功 → committed"和"失败 → rollback"两个路径
- Test coverage: `src/__tests__/unit/discord-bridge.test.ts` 覆盖部分适配器，但缺乏中国区 adapter（Telegram、微信、飞书）的完整集成测试

**Message Content JSON Serialization (High Risk)**
- Files: `src/lib/db.ts` (messages table, content stored as JSON), `src/lib/stream-session-manager.ts`, `src/app/api/chat/route.ts`
- Why fragile:
  - Messages 表的 `content` 字段为 JSON 数组，存储 block 对象（text、image、file 等）
  - 序列化过程中若 block 包含环形引用或不可序列化的对象（如 Blob、stream），JSON.stringify 会 throw
  - 某些 AI block 结构（如 artifact、tool_use）序列化后与反序列化不一致，可能导致渲染错误
- Safe modification:
  - 任何新增 Message block 类型前，在 `src/types/index.ts` 明确定义序列化边界
  - 在 persistence layer (`src/lib/db.ts`) 的 insertMessage() 前显式调用 sanitizeMessageContent() 验证可序列化性
  - 反序列化时使用 reviver 函数确保类型正确（ISO 日期还原为 Date，等）
- Test coverage: `src/__tests__/unit/message-persistence.test.ts` 有基础测试，但缺乏边界情况（深嵌套、大型 artifact）

**Context Assembler Dynamic Token Budgeting (Medium Risk)**
- Files: `src/lib/context-assembler.ts` (if exists; check actual file path)
- Why fragile:
  - 上下文组装逻辑需要计算消息 token 数，但 token 计数器（encoding）与实际模型计数差异 10-15%
  - 某些模型用不同的 tokenizer（如 Claude 3.5 vs 4）
  - 预留 output token 数量固定，但 max_tokens 参数由用户设置，可能导致预留空间溢出
- Safe modification:
  - 修改 token 预算算法前先用 token-counting library 基于真实 encoding 做单元测试
  - 给用户暴露 "estimated context usage" 指标，让其了解窗口大小
- Test coverage: Likely covered in integration tests, but unclear

**Feishu CardKit v2 Streaming (High Complexity)**
- Files: `src/lib/channels/feishu/card-controller.ts` (card.create/update/finalize state machine)
- Why fragile:
  - CardKit v2 流式卡片需要严格的状态转移：create → update* → finalize
  - 中间 update 失败或网络断开时，卡片状态与服务端不一致，后续 update 可能失败
  - 工具调用渲染涉及异步 tool execution，需要同步更新卡片进度，时序复杂
- Safe modification:
  - 修改状态转移前必须在飞书官方文档验证 CardKit 合约
  - 所有 create/update/finalize 调用需要加 try-catch 和重试机制（指数退避）
  - 新增 tool call 状态（pending/executing/done/error）需要测试所有转移路径
- Test coverage: 无 unit test；integration test 需要飞书沙箱账户

---

## Scaling Limits

**Message Storage (Medium Scale Risk)**
- Current capacity: SQLite WAL mode 支持并发读，但单个数据库文件 ~2GB 限制（理论上）
- Limit: 假设平均消息 5KB（含 blocks），100 万条消息 = 5GB，会溢出
- Scaling path: 
  1. 短期：实现消息归档机制，定期迁移 > 6 月的会话到冷存储
  2. 中期：引入 SQLite sharding（按 session_id 哈希分片到多个 db 文件）
  3. 长期：考虑迁移到 PostgreSQL，支持更大规模

**MCP Server Connections (Low Scale Risk)**
- Current capacity: 同时激活 ~10 个 MCP server，每个 stdio process 占 10-50MB 内存
- Limit: 内存约 500MB 时开始 GC 压力大，影响 Claude AI 推理性能
- Scaling path:
  1. MCP server 连接池复用，避免重复启动
  2. 按需延迟启动，只在聊天中使用时才初始化
  3. 设置 MCP 进程内存上限（如 100MB），超额自动重启

**Concurrent Bridge Sessions (High Complexity)**
- Current capacity: 单进程可处理 ~20 并发 Bridge 会话（Telegram/飞书/Discord）
- Limit: 每个会话需要独立 SDK conversation 和 SSE 流管理，CPU > 80% 时响应延迟明显
- Scaling path:
  1. 引入 BullMQ 消息队列将异步任务分离，减少主事件循环压力
  2. 多进程模式：主进程管理 UI，worker 进程处理 Bridge，IPC 通信
  3. 考虑 Rust 后端（如 Tauri）替代 Node.js，减少内存占用

---

## Scaling Limits (continued)

**Long Session Context Window Exhaustion (High Impact)**
- Current capacity: 最近 50 条消息 fallback，假设平均每条消息 500 token，≈ 25K token 上下文
- Limit: 大部分模型 200K token 窗口，但在长会话中接近上限时，新消息响应延迟增加（token 计算开销）
- Scaling path:
  1. 实现动态上下文窗口（per docs/exec-plans/active/context-storage-migration.md）
  2. 引入摘要机制：定期生成会话摘要替代早期详细消息
  3. 向量化存储，让用户基于语义相似性检索历史而非时间顺序

---

## Dependencies at Risk

**Claude Agent SDK Version Pinning (High Risk)**
- Risk: `package.json` 中 `@anthropic-ai/claude-agent-sdk` 固定在 `^0.2.62`，SDK 新增功能（如 thinking、effort level）需要升级
- Impact: 新功能落后，bug fix 不及时，安全补丁延迟
- Migration plan:
  1. 定期 (quarterly) 检查 SDK 变更日志，评估升级成本
  2. 对 SDK 升级创建 worktree 分支，运行完整的 smoke + e2e 测试
  3. 维护 SDK 版本兼容性文档，说明每个版本的破坏性变更

**better-sqlite3 平台兼容性 (Medium Risk)**
- Risk: `better-sqlite3@12.6.2` 需要在构建时编译 native 模块，Windows/macOS/Linux 上编译失败会导致安装失败
- Impact: 特定平台用户无法安装；`scripts/after-pack.js` 需要为 Electron ABI 重编译，复杂度高
- Migration plan:
  1. 考虑迁移到 `sql.js`（纯 JS SQLite），牺牲性能换取零依赖
  2. 或切换到 Prisma + SQLite，外包编译问题但增加 query 抽象层
  3. 改进 CI 流程，预编译多平台 binary 并存储在 artifact，加速本地构建

**Electron Builder 发版流程 (Medium Risk)**
- Risk: `electron-builder` 和 `electron-updater` 版本组合需要精确，版本不匹配导致自动更新失败
- Impact: 用户无法自动更新，需要手动下载新版本；已知旧版本存在 bug
- Migration plan:
  1. 锁定 electron-builder 和 electron-updater 的互兼容版本，在 package-lock.json 中反映
  2. 在 CI 中测试发版 + 更新流程（应用能否检测新版本、下载、安装）
  3. 考虑使用第三方更新服务（如 Squirrel、Sparkle），降低自维护成本

**Next.js 16 + Electron 40 不官方支持 (Low-Medium Risk)**
- Risk: Electron 40 仍是 beta，某些 Next.js 16 特性（如 Server Components、Streaming）与 Electron IPC 不完全兼容
- Impact: 难以追踪的行为差异，某些新特性不可用
- Migration plan:
  1. 避免过度使用尚不稳定的 Next.js 新特性，坚持 App Router 但慎用 Suspense/Streaming
  2. 定期（quarterly）检查 Electron 稳定版发布，计划升级
  3. 在发版前在多个 Electron 版本上测试

---

## Missing Critical Features

**会话权限审计日志 (Medium Priority)**
- Problem: 无法追踪谁在何时批准了哪些权限请求，缺乏安全审计线索
- Blocks: 合规性需求（如企业采用），安全事件追溯困难
- Implementation sketch: 新增 `permission_audit` 表记录每个权限决策（user_id, permission_type, action=allow/deny, timestamp），定期导出报告

**Gradient/渐进式上下文加载 (High Priority)**
- Problem: 恢复旧会话时一次性加载所有历史消息到内存，导致启动延迟 + 内存溢出
- Blocks: 超大会话（> 10K 条消息）无法恢复；Bridge 模式下新连接启动慢
- Implementation sketch: 实现 "lazy loading" 或 "windowed context"，初始只加载最近 100 条消息，用户滚动时按需加载早期消息

**多项目工作空间隔离 (High Priority)**
- Problem: 当前无法在同一 CodePilot 实例中管理多个独立项目的会话上下文，`canUpdateSdkCwd` 未实现
- Blocks: 用户必须在 codepilot 启动时手动选择项目，无法快速切换；上下文污染
- Implementation sketch: Phase 0 补完后，在 ChatView 增加项目选择器，切换项目时重置 context assembler 的项目根目录

---

## Test Coverage Gaps

**Bridge Adapter Integration (High Risk)**
- What's not tested: 中国区 adapter 的完整生命周期（连接、消息接收、回复、权限批准、错误恢复）
- Files: `src/lib/bridge/adapters/telegram-adapter.ts`, `src/lib/bridge/adapters/weixin-adapter.ts`、飞书适配器
- Risk: Adapter 在生产环境中才暴露的 bug，如消息去重失败、offset 回滚错误、权限请求丢失
- Test approach:
  1. Mock Telegram/飞书/微信 API responses，在 unit test 中模拟各种错误场景（timeout、malformed message、auth failure）
  2. 实现集成测试，连接到 test bot 账户，运行端到端流程
  3. 在每个版本发版前手动在真实 IM 上验证

**ComponentMessage JSON Serialization (Medium Risk)**
- What's not tested: 各种复杂 block 结构（nested artifact、large images、circular references）的序列化/反序列化
- Files: `src/lib/db.ts` (insertMessage), `src/__tests__/unit/message-persistence.test.ts`
- Risk: 某些边界情况导致消息丢失或渲染错误，用户数据损坏
- Test approach:
  1. 在 message-persistence.test.ts 增加 fuzz test，生成随机复杂 block 结构并验证往返一致性
  2. 压力测试：插入 1000+ 条含大型 artifact 的消息，验证数据库性能不劣化

**Provider Resolution Fallback (Medium Risk)**
- What's not tested: Provider resolver 在各种缺失配置下的 fallback 行为（无 API key、无 default provider、无 legacy 配置）
- Files: `src/lib/provider-resolver.ts`, `src/__tests__/unit/provider-resolver.test.ts` (1104 行，但覆盖率未知)
- Risk: 启动时 provider 选择异常，用户无法聊天
- Test approach: 扩充 provider-resolver.test.ts，添加各种配置缺失的场景（空 db、无 env var、legacy config corrupted）

**Streaming Message Timeout (Low-Medium Risk)**
- What's not tested: Stream 超时、部分响应（收到部分 token 后网络断开）、tool timeout auto-retry 的正确性
- Files: `src/lib/stream-session-manager.ts`, `src/hooks/useSSEStream.ts`
- Risk: 用户报告"消息卡住"，实际是流超时未正确处理
- Test approach: Mock SSE 端点实现各种超时和中断场景，验证组件正确处理

---

*Concerns audit: 2026-04-09*
