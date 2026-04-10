# 代码库结构

**分析日期：** 2026-04-09

## 目录布局

```
/home/user_demo/Husky/arena/
├── src/                       # 主代码目录
│   ├── app/                   # Next.js App Router 路由树
│   │   ├── api/               # REST API 端点（52+ 路由）
│   │   ├── chat/              # 聊天页主路由
│   │   ├── plugins/           # 插件管理页面
│   │   ├── settings/          # 应用设置页面
│   │   ├── bridge/            # Bridge / IM 集成页面
│   │   ├── layout.tsx         # 根布局（主题、国际化、AppShell）
│   │   └── page.tsx           # 首页（重定向 → /chat）
│   ├── components/            # React 组件库（按功能分目录）
│   │   ├── ui/                # Radix 基础组件（Button, Dialog, Tabs 等）
│   │   ├── chat/              # 聊天界面组件（MessageList, CodeBlock 等）
│   │   ├── ai-elements/       # AI 响应渲染（Artifact, Reasoning, ToolUse）
│   │   ├── layout/            # 布局组件（AppShell, NavRail, Panels）
│   │   ├── plugins/           # 插件管理 UI
│   │   ├── settings/          # 设置面板
│   │   ├── bridge/            # Bridge 配置 UI
│   │   ├── cli-tools/         # CLI Tools 管理组件
│   │   ├── git/               # Git 集成 UI
│   │   ├── project/           # 项目文件树组件
│   │   ├── skills/            # 技能市场组件
│   │   ├── auth/              # 认证相关 UI
│   │   ├── setup/             # 初始化向导 UI
│   │   ├── patterns/          # 通用 UI 模式（Popover 等）
│   │   └── terminal/          # 终端模拟器组件
│   ├── lib/                   # 业务逻辑层（60+ 文件）
│   │   ├── db.ts              # SQLite 数据库（Schema、CRUD、迁移）
│   │   ├── claude-client.ts   # Claude Agent SDK 封装、消息编排
│   │   ├── stream-session-manager.ts  # SSE 流生命周期管理
│   │   ├── conversation-registry.ts   # 活跃 SDK 会话全局注册
│   │   ├── error-classifier.ts        # 结构化错误分类（16 类）
│   │   ├── provider-doctor.ts         # Provider 诊断引擎
│   │   ├── provider-resolver.ts       # Provider 配置解析
│   │   ├── provider-catalog.ts        # 预设 Provider 列表
│   │   ├── api-client.ts              # 前端 HTTP 客户端（authFetch）
│   │   ├── files.ts                   # 文件系统浏览、预览、上传
│   │   ├── platform.ts                # 平台检测（macOS/Windows/Linux）
│   │   ├── runtime-log.ts             # 环形缓冲 console 日志
│   │   ├── agent-sdk-capabilities.ts  # SDK 能力查询 + 缓存
│   │   ├── agent-sdk-agents.ts        # Agent 内置工具集
│   │   ├── permission-registry.ts     # 权限请求存储
│   │   ├── assistant-workspace.ts     # Workspace 助手（文件检索）
│   │   ├── workspace-indexer.ts       # 工作空间索引
│   │   ├── cli-tools-catalog.ts       # CLI Tools 目录
│   │   ├── cli-tools-detect.ts        # CLI 工具检测
│   │   ├── mcp-loader.ts              # MCP 插件加载
│   │   ├── theme/                     # 主题系统
│   │   │   ├── loader.ts              # 主题加载
│   │   │   └── render-css.ts          # 主题 CSS 生成
│   │   ├── bridge/                    # IM Bridge 子系统
│   │   │   ├── types.ts               # Bridge 共用类型
│   │   │   ├── channel-adapter.ts     # 渠道适配器抽象基类
│   │   │   ├── channel-router.ts      # 消息路由
│   │   │   ├── conversation-engine.ts # SDK 消费引擎
│   │   │   ├── permission-broker.ts   # 权限请求转 IM 按钮
│   │   │   ├── delivery-layer.ts      # 消息分片、速率限制
│   │   │   ├── bridge-manager.ts      # 生命周期编排
│   │   │   ├── markdown/              # Markdown → IM 格式转换
│   │   │   ├── security/              # Bridge 安全相关
│   │   │   └── adapters/              # 具体渠道适配器
│   │   │       ├── telegram-adapter.ts
│   │   │       ├── feishu-adapter.ts
│   │   │       └── weixin/            # 微信适配器（消息、媒体、权限）
│   │   ├── channels/                  # Channel Plugin 层
│   │   │   ├── types.ts               # ChannelPlugin 接口
│   │   │   ├── channel-plugin-adapter.ts # Plugin → Adapter 桥接
│   │   │   └── feishu/                # 飞书渠道插件（模块化）
│   │   │       ├── types.ts           # 飞书内部常量
│   │   │       ├── config.ts          # 结构化配置
│   │   │       ├── gateway.ts         # WebSocket 客户端
│   │   │       ├── inbound.ts         # 入站消息处理
│   │   │       ├── outbound.ts        # 出站消息渲染
│   │   │       ├── identity.ts        # Bot 身份识别
│   │   │       ├── policy.ts          # 访问控制
│   │   │       ├── card-controller.ts # 卡片流控制
│   │   │       └── index.ts           # 入口点
│   │   ├── remote/                    # Remote Core 层（骨架）
│   │   │   ├── types.ts               # RemoteHost/RemoteController 接口
│   │   │   ├── remote-manager.ts      # 轻量运行时
│   │   │   └── index.ts               # 导出
│   │   ├── constants/                 # 常量定义
│   │   └── utils.ts                   # 工具函数
│   ├── hooks/                         # React Hooks（30+ 个）
│   │   ├── useSSEStream.ts            # SSE 流订阅
│   │   ├── useTranslation.ts          # 国际化 Hook
│   │   ├── useChatCommands.ts         # 聊天命令解析
│   │   ├── useCliToolsFetch.ts        # CLI Tools 数据获取
│   │   ├── useAssistantTrigger.ts     # AI 助手触发
│   │   ├── useSettings.ts             # 应用设置
│   │   ├── useBridgeAdapter.ts        # Bridge 适配器状态
│   │   ├── useGitStatus.ts            # Git 状态查询
│   │   ├── useProviderModels.ts       # Provider 模型列表
│   │   ├── useAppTheme.ts             # 主题管理
│   │   └── ... (20+ 更多 Hooks)
│   ├── types/                         # TypeScript 类型定义
│   │   ├── index.ts                   # 所有业务类型（1195 行）
│   │   └── electron.d.ts              # Electron contextBridge 类型
│   ├── i18n/                          # 国际化
│   │   ├── en.ts                      # 英文翻译
│   │   └── zh.ts                      # 中文翻译
│   ├── instrumentation.ts             # OpenTelemetry 仪器（可选）
│   ├── globals.css                    # 全局 CSS
│   └── __tests__/                     # 单元测试
│       └── unit/                      # 单元测试用例（20+ .test.ts）
│           ├── claude-session-parser.test.ts
│           ├── db-shutdown.test.ts
│           ├── message-persistence.test.ts
│           └── ... (更多测试)
├── electron/                          # Electron 主进程
│   ├── main.ts                        # 主进程入口（窗口、IPC、Utility Process）
│   ├── preload.ts                     # contextBridge 暴露接口
│   ├── terminal-manager.ts            # 终端进程管理
│   ├── updater.ts                     # 自动更新逻辑
│   └── tsconfig.json
├── docs/                              # 项目文档
│   ├── handover/                      # 技术交接文档
│   │   ├── bridge-system.md           # Bridge 系统完整说明
│   │   ├── agent-tooling-todo-bridge.md
│   │   └── provider-error-doctor.md
│   ├── insights/                      # 产品思考文档
│   ├── exec-plans/                    # 执行计划
│   │   ├── active/                    # 活跃计划
│   │   ├── completed/                 # 已完成计划
│   │   ├── tech-debt-tracker.md       # 技术债务清单
│   │   └── README.md
│   └── research/                      # 调研文档
├── scripts/                           # 构建脚本
│   ├── build-electron.mjs             # Electron 构建脚本
│   └── after-pack.js                  # 打包后处理（重编译 better-sqlite3）
├── playwright.config.ts               # E2E 测试配置
├── tsconfig.json                      # TypeScript 编译配置
├── next.config.ts                     # Next.js 配置（standalone output）
├── package.json                       # 项目依赖（Electron 40, Next.js 16, React 19）
├── package-lock.json                  # 锁文件
├── ARCHITECTURE.md                    # 架构文档
├── CLAUDE.md                          # 项目规则和流程
└── README.md
```

## 目录用途

**API 端点目录（`src/app/api/`）：**
- 目的：RESTful API 路由，处理客户端请求
- 包含文件：`route.ts` 或子目录下的 `route.ts`（Next.js App Router 约定）
- 主要端点：
  - `/api/chat/` — 聊天消息、会话、流式响应
  - `/api/plugins/` — MCP 插件管理
  - `/api/files/` — 文件浏览、预览、上传
  - `/api/bridge/` — IM Bridge 管理
  - `/api/settings/` — 应用配置
  - `/api/providers/` — AI Provider 配置
  - `/api/git/` — Git 操作
  - `/api/cli-tools/` — CLI Tools 目录和安装
  - `/api/media/` — 图片生成和媒体管理
  - `/api/doctor/` — 诊断工具

**页面目录（`src/app/`）：**
- 目的：UI 路由，对应浏览器页面
- 文件名：`page.tsx` = 路由入口（Next.js 约定）
- 示例：
  - `src/app/chat/page.tsx` → `/chat` 路由
  - `src/app/plugins/page.tsx` → `/plugins` 路由
  - `src/app/settings/page.tsx` → `/settings` 路由
  - `src/app/layout.tsx` → 根布局（所有路由共用）

**Bridge 子系统（`src/lib/bridge/`）：**
- 目的：将外部 IM（Telegram、飞书、微信）连接到 CodePilot
- 关键文件：
  - `types.ts` — 共用类型定义
  - `channel-adapter.ts` — 渠道适配器抽象基类 + 工厂
  - `channel-router.ts` — 消息路由逻辑
  - `conversation-engine.ts` — SDK 消费和消息持久化
  - `permission-broker.ts` — 权限请求转 IM 内联按钮
  - `delivery-layer.ts` — 消息分片、速率限制、格式转换
  - `adapters/` — 具体渠道实现（Telegram、飞书、微信）

**Channel Plugin 层（`src/lib/channels/`）：**
- 目的：结构化渠道插件架构，支持第三方扩展
- 核心接口：`ChannelPlugin<Config>` 合约（probe, start, stop, receiveMessage, sendMessage）
- 飞书插件（`src/lib/channels/feishu/`）：
  - `config.ts` — 结构化配置验证
  - `gateway.ts` — WebSocket 连接管理
  - `inbound.ts` — 入站消息处理
  - `outbound.ts` — 出站 Card / Post 渲染
  - `identity.ts` — Bot 身份解析
  - `policy.ts` — 群/个人访问控制
  - `card-controller.ts` — CardStreamController 接口

**测试目录（`src/__tests__/`）：**
- 位置：`src/__tests__/unit/` （单元测试）
- 框架：vitest + tsx
- 命名：`*.test.ts` 或 `*.spec.ts`
- 运行：`npm run test:unit`

## 关键文件位置

**入口点：**
- `electron/main.ts` — Electron 应用启动
- `src/app/layout.tsx` — Next.js 根布局（主题、i18n 初始化）
- `src/app/page.tsx` — 首页重定向（→ `/chat`）

**配置：**
- `tsconfig.json` — 路径别名：`@/*` → `./src/*`
- `next.config.ts` — Next.js 配置（standalone output、serverExternalPackages）
- `playwright.config.ts` — E2E 测试配置
- `package.json` — 依赖和脚本命令

**核心逻辑：**
- `src/lib/db.ts` — SQLite 操作和 Schema
- `src/lib/claude-client.ts` — Claude Agent SDK 集成
- `src/lib/stream-session-manager.ts` — SSE 流管理
- `src/lib/provider-doctor.ts` — Provider 诊断

**React 层：**
- `src/components/layout/AppShell.tsx` — 主容器组件
- `src/components/chat/ChatView.tsx` — 聊天页面容器
- `src/hooks/useSSEStream.ts` — SSE 流订阅 Hook

## 新增代码指南

**新功能（特性）：**
- 类型定义：`src/types/index.ts` 中新增 interface/type
- 数据库：`src/lib/db.ts` 中新增表或字段（含迁移逻辑）
- API 路由：`src/app/api/{功能名}/route.ts` 中新增 POST/GET/PUT 端点
- 页面：`src/app/{功能名}/page.tsx` 中新建页面组件
- UI 组件：`src/components/{功能名}/` 下新增 .tsx 文件
- 业务逻辑：`src/lib/{功能名}.ts` 中新增核心算法
- Hooks：`src/hooks/use{功能名}.ts` 中新增 Hook
- 国际化：同时更新 `src/i18n/en.ts` 和 `zh.ts`（追加翻译键）
- 测试：`src/__tests__/unit/{功能名}.test.ts` 中新增测试用例

**新 IM 渠道集成：**
1. 实现 `ChannelPlugin<Config>` 接口（`src/lib/channels/{渠道名}/index.ts`）
2. 在 `src/lib/channels/{渠道名}/config.ts` 定义配置结构
3. 在 `src/lib/channels/{渠道名}/outbound.ts` 实现消息渲染（IM 特定格式）
4. 在 `src/lib/bridge/adapters/{渠道名}-adapter.ts` 注册适配器
5. 在 `src/types/index.ts` 新增 `{渠道名}Config` 类型
6. 在 `src/app/api/settings/{渠道名}/route.ts` 中暴露配置 API

**新工具集成：**
- CLI Tools：`src/lib/cli-tools-catalog.ts` 中追加工具定义
- Agent Skills：`src/lib/agent-sdk-agents.ts` 中追加 skill
- MCP 插件：`src/lib/mcp-loader.ts` 中处理加载逻辑

## 文件命名规范

**React 组件（.tsx）：**
- 文件名：`PascalCase.tsx`（如 `ChatView.tsx`、`MessageList.tsx`）
- 导出：默认导出同名 React 组件或命名导出 utility 函数
- 示例：`src/components/chat/ChatView.tsx` 导出 `ChatView` 组件

**TypeScript 逻辑（.ts）：**
- 文件名：`camelCase.ts`（如 `claude-client.ts`、`stream-session-manager.ts`）
- 导出：命名导出函数/类（如 `export function query()`, `export class Manager {}`)

**Hook（.ts）：**
- 文件名：`use{FunctionName}.ts`（如 `useSSEStream.ts`）
- 导出：`export function use{FunctionName}() { ... }`

**测试（.test.ts）：**
- 文件名：`{被测文件名}.test.ts`（如 `claude-session-parser.test.ts`）
- 位置：`src/__tests__/unit/`

**类型定义（.ts）：**
- 文件名：通常 `types.ts` 或 `{module}.d.ts`
- 主文件：`src/types/index.ts` 包含所有业务类型

## 特殊目录

**`src/__tests__/`：**
- 目的：单元测试和 E2E 测试
- 生成：未提交到 git（`.gitignore`）
- 命令：
  - `npm run test` — 类型检查 + 单元测试（~4s）
  - `npm run test:smoke` — 冒烟测试（~15s，需要 dev server）
  - `npm run test:e2e` — 完整 E2E（~60s+，需要 dev server）

**`.next/`：**
- 目的：Next.js 构建产物
- 生成：`npm run build` 或 `npm run dev`
- 提交：未提交到 git

**`release/` 和 `dist-electron/`：**
- 目的：Electron 打包产物（DMG、NSIS）
- 生成：`npm run electron:pack`
- 提交：未提交到 git

**`docs/`：**
- 技术交接：`docs/handover/` 中的 .md 文件（给接手开发者）
- 产品思考：`docs/insights/` 中的 .md 文件（给产品决策者）
- 执行计划：`docs/exec-plans/` 中的 .md 文件（进度 + 决策日志）
- 调研文档：`docs/research/` 中的 .md 文件（方案比较、可行性分析）

---

*结构分析：2026-04-09*
