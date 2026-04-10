# 架构

**分析日期：** 2026-04-09

## 模式概述

**整体架构：** Electron + Next.js (App Router) + Claude Agent SDK 前后端一体化架构

**核心特点：**
- 前后端同一进程：Next.js API 路由处理所有业务逻辑，React 组件直接调用本地 HTTP 端点
- SSE 流驱动：Claude Agent SDK 返回服务端发送事件流（SSE），客户端实时订阅更新
- 本地数据持久化：better-sqlite3 数据库存储会话、消息、媒体、插件配置
- 会话管理分层：Electron 主进程 → Next.js API 层 → Claude Agent SDK → Claude 后端

## 分层架构

**Electron 主进程层 (`electron/main.ts`, `electron/preload.ts`)：**
- 目的：窗口生命周期、IPC 通信、系统集成、自动更新
- 位置：`electron/`
- 包含：
  - 主窗口创建与管理（BrowserWindow）
  - 原生对话框（文件选择、保存）
  - Utility Process 生成（运行 Claude Code CLI）
  - Terminal 进程管理
  - Updater 逻辑
- 依赖：Electron API、Node.js 进程管理、`better-sqlite3`
- 被调用：Next.js 服务端代码通过 `contextBridge` 暴露 IPC 接口

**Next.js API 层 (`src/app/api/`)：**
- 目的：REST API 端点，业务逻辑编排
- 位置：`src/app/api/` （16 个主路由，52+ REST 端点）
- 包含：
  - Chat API（消息、会话、流式响应）
  - Plugin/MCP 管理（状态查询、连接、重连）
  - File API（浏览、预览、上传）
  - Bridge API（IM 适配器、频道绑定）
  - Settings API（应用配置、Provider 设置）
  - Git API（状态、提交、分支、工作树）
  - CLI Tools API（目录、安装、描述）
  - Media API（图片生成、批量任务）
  - Health/Status API（诊断、更新检查）
- 依赖：`src/lib/` 业务逻辑层
- 被调用：前端 React 组件通过 `authFetch` 发送 HTTP 请求

**业务逻辑层 (`src/lib/`)：**
- 目的：核心算法、外部 SDK 集成、数据库访问
- 位置：`src/lib/` （60+ .ts 文件）
- 包含：
  - **AI 集成：** `claude-client.ts`（SDK 消息编排）、`agent-sdk-*`（能力管理）
  - **流管理：** `stream-session-manager.ts`（SSE 生命周期）、`conversation-registry.ts`（活跃会话全局注册）
  - **数据库：** `db.ts`（Schema + CRUD，12 张表）
  - **诊断：** `provider-doctor.ts`（Provider 自检）、`error-classifier.ts`（结构化错误分类，16 类）
  - **Bridge 子系统：** `bridge/`（IM 适配器、消息路由、权限代理）
  - **Channel Plugin 层：** `channels/`（飞书、Telegram 等渠道插件）
  - **Platform：** `platform.ts`（macOS/Windows/Linux 差异处理）
  - **Runtime：** `runtime-log.ts`（环形缓冲 console 日志，自动脱敏）
- 依赖：第三方 SDK（Claude Agent SDK、`@larksuiteoapi/node-sdk` 等）
- 被调用：API 层

**React 前端层 (`src/components/`, `src/app/{pages}`)：**
- 目的：UI 渲染、用户交互、客户端状态管理
- 位置：`src/components/` 和 `src/app/chat/`, `src/app/plugins/` 等
- 包含：
  - **布局组件：** `components/layout/` (AppShell, NavRail, ChatListPanel, Panels)
  - **聊天界面：** `components/chat/` (MessageList, CodeBlock, ImageThumbnail, MessageInput)
  - **AI 元素：** `components/ai-elements/` (Artifact, Reasoning, ToolUse, Task)
  - **插件管理：** `components/plugins/` (MCP 配置、CLI Tools)
  - **设置面板：** `components/settings/`, `components/bridge/`
  - **UI 组件库：** `components/ui/` (Radix 基础组件：Button, Dialog, Tabs 等，来自 `radix-ui` 包)
- 依赖：API 层（通过 Hooks 调用）
- 状态管理：
  - 服务端状态：通过 API 层持久化到 SQLite
  - 客户端状态：React Hooks（`useState`, `useCallback`, `useMemo`）+ 上下文（Provider）
  - 流订阅：`useSSEStream` Hook 订阅 SSE 事件

## 数据流

**聊天消息流（从用户输入到 Claude 响应）：**

```
1. MessageInput 组件（用户输入文本 + 文件附件）
   ↓
2. useChatCommands Hook（解析斜杠命令、@提及）
   ↓
3. sendMessage 回调 → POST /api/chat/messages
   ↓
4. claude-client.ts（创建 SDK conversation，编排 system prompt + 消息上下文）
   ↓
5. Claude Agent SDK query() → SSE 流（初始化、工具列表、思考、文本、工具调用、权限请求）
   ↓
6. stream-session-manager.ts（事件积累、快照管理、权限代理转发）
   ↓
7. useSSEStream Hook（订阅快照更新）
   ↓
8. ChatView / MessageList 组件（渲染消息列表）
   ↓
9. 消息内容通过 API 端点异步保存到 SQLite（db.ts）
```

**Bridge 数据流（外部 IM → CodePilot 会话）：**

```
Telegram/飞书 消息 
  ↓ 
Channel Adapter（轮询 / WebSocket）
  ↓
channel-router.ts（消息路由到 CodePilot session_id）
  ↓
conversation-engine.ts（调用 Claude Agent SDK，消费 SSE 流）
  ↓
delivery-layer.ts（分片、速率限制、格式转换）
  ↓
Channel Adapter 发送回 IM（Telegram HTML / 飞书卡片）
```

**状态管理流：**
- **全局会话注册：** `conversation-registry.ts` 在 `globalThis` 存储活跃 SDK conversation 引用，支持热更新后状态保留
- **流快照：** `stream-session-manager.ts` 在 `globalThis` 维护 SessionStreamSnapshot，React 组件 Hook 订阅
- **数据库：** `db.ts` 提供 CRUD 接口，API 层调用保存到本地 SQLite

## 数据库（SQLite，位置：`~/.codepilot/codepilot.db`）

Schema 定义在 `src/lib/db.ts`，使用 WAL 模式 + 外键约束：

| 表 | 用途 |
|----|------|
| `chat_sessions` | 聊天会话元数据（标题、创建时间、当前 model、working directory、SDK session ID） |
| `messages` | 消息列表（content 为 JSON 数组，role 为 user/assistant） |
| `settings` | 键值配置（theme_mode, theme_family, provider_id 等） |
| `tasks` | SDK TodoWrite 任务项 |
| `api_providers` | API 提供商配置（Anthropic, OpenAI, OpenRouter 等） |
| `media_generations` | 生成的图片/媒体记录 |
| `media_tags` | 媒体标签 |
| `media_jobs` | 批量图片生成任务 |
| `media_job_items` | 批量任务中的单个项 |
| `media_context_events` | 批量任务上下文同步事件 |
| `channel_bindings` | Bridge：IM 频道 → CodePilot 会话绑定 |
| `channel_offsets` | Bridge：轮询水位线（断点续传） |

迁移逻辑：`getDb()` 初始化时自动执行 schema 创建，支持从旧位置（`~/Library/Application Support/CodePilot/` 等）迁移。

## 关键抽象

**Session Stream 快照（`src/lib/stream-session-manager.ts`）：**
- 目的：管理单个会话的 SSE 流生命周期，与 React 组件生命周期解耦
- 实现：globalThis 单例 + 快照对象 array 维护
- 快照结构：
  ```typescript
  SessionStreamSnapshot {
    status: 'idle' | 'running' | 'done' | 'error' | 'stopped';
    text: string;                          // 累积文本输出
    toolUses: ToolUseInfo[];              // 工具调用列表
    toolResults: ToolResultInfo[];        // 工具结果列表
    toolOutput: string;                    // 当前工具输出
    tokenUsage: TokenUsage;                // token 使用统计
    permissionRequests: PermissionRequestEvent[]; // 待批准的权限请求
    error?: string;                        // 错误信息
    mode?: string;                         // SDK 当前模式（plan/code/ask）
  }
  ```
- 使用者：React Hook `useSSEStream` 订阅快照变化

**Conversation Registry（`src/lib/conversation-registry.ts`）：**
- 目的：全局维护活跃 SDK conversation 对象，支持跨组件会话恢复
- 实现：globalThis 单例 Map (sessionId → SDK conversation)
- 用途：在 React 组件卸载后仍可恢复流、避免中间件丢弃活跃请求

**Error Classifier（`src/lib/error-classifier.ts`）：**
- 目的：结构化错误分类与用户友好的错误提示
- 类别：16 类（CLI_NOT_FOUND, NO_CREDENTIALS, RATE_LIMITED, CONTEXT_TOO_LONG 等）
- 输出：
  ```typescript
  ClassifiedError {
    category: ClaudeErrorCategory;
    userMessage: string;      // 用户可理解的消息
    actionHint: string;       // 修复建议
    retryable: boolean;       // 是否可重试
  }
  ```

**Channel Plugin 合约（`src/lib/channels/types.ts`）：**
- 目的：定义 IM 渠道插件接口，支持可插拔扩展
- 核心接口：
  ```typescript
  ChannelPlugin<Config> {
    probe(): Promise<ProbeResult>;           // 连接检测
    start(): Promise<void>;                  // 启动
    stop(): Promise<void>;                   // 停止
    receiveMessage(): AsyncIterableIterator; // 消息接收器
    sendMessage(msg: OutboundMessage): Promise<void>;
    getCapabilities(): ChannelCapabilities;
  }
  ```

## 入口点

**应用启动：**
- 位置：`electron/main.ts`
- 触发：用户启动 CodePilot 应用
- 责任：
  1. 创建 Electron BrowserWindow
  2. 启动 Next.js 服务器（`next start` 或开发模式下 `next dev`）
  3. 等待服务器就绪后加载 `http://localhost:3000`
  4. 设置 IPC 通道、快捷键、菜单

**前端首屏：**
- 位置：`src/app/layout.tsx` → `src/app/page.tsx` → 重定向到 `/chat`
- 渲染：`src/app/chat/page.tsx`（ChatView 容器）
- 责任：
  1. 从 SQLite 读取会话列表（ChatListPanel）
  2. 加载当前活跃会话消息
  3. 订阅 SSE 流更新

**API 初始化：**
- 位置：`src/app/api/health/route.ts`
- 责任：健康检查、初始化检测、Doctor 诊断

## 错误处理

**策略：** 分层捕获 + 结构化分类 + 用户友好提示

**模式：**
- API 层 (`src/app/api/*/route.ts`)：
  ```typescript
  export async function POST(req) {
    const authError = requireAuth(req);
    if (authError) return authError;
    
    try {
      const result = await business_logic();
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      const classified = classifyError(error, context);
      return NextResponse.json(
        { error: classified.userMessage, hint: classified.actionHint },
        { status: getStatusCode(classified.category) }
      );
    }
  }
  ```

- 业务逻辑层 (`src/lib/claude-client.ts`)：
  ```typescript
  try {
    const stream = await sdk.query(...);
    // 处理流事件
  } catch (error) {
    const classified = classifyError(error, {
      stderr: childProcess.stderr,
      providerName: provider.name,
      hasImages: fileAttachments.some(...),
    });
    throw classified; // API 层进一步处理
  }
  ```

- React 层：通过 Hook 捕获，显示 Toast 或 ErrorBoundary

**错误分类（16 类）：**
- CLI 层：`CLI_NOT_FOUND`, `CLI_VERSION_TOO_OLD`, `MISSING_GIT_BASH`
- 认证：`NO_CREDENTIALS`, `AUTH_REJECTED`, `AUTH_FORBIDDEN`, `PROVIDER_NOT_APPLIED`
- 网络：`NETWORK_UNREACHABLE`, `RATE_LIMITED`
- 模型：`MODEL_NOT_AVAILABLE`, `CONTEXT_TOO_LONG`, `UNSUPPORTED_FEATURE`
- 进程：`PROCESS_CRASH`, `SESSION_STATE_ERROR`, `RESUME_FAILED`
- 未知：`UNKNOWN`

## 跨切关注点

**日志：** 
- 前端：`console.*` 调用
- 后端：`src/lib/runtime-log.ts`（环形缓冲 200 条日志，自动脱敏 API key）
- 导出：`/api/doctor/export` 端点打包诊断信息

**验证：**
- 认证：`requireAuth(request)` 验证 X-Auth-Token（Electron contextBridge 自动注入）
- 文件访问：`src/lib/files.ts` 限制文件浏览范围（white list /src 等）
- Bridge 权限：`permission-broker.ts` 将权限请求转为 IM 内联按钮，需用户显式确认

**国际化（i18n）：**
- 实现：`src/i18n/en.ts` + `zh.ts`
- 使用：`useTranslation()` Hook → 返回 `t(key)` 函数
- 类型安全：`TranslationKey` 联合类型限制翻译键范围

---

*架构分析：2026-04-09*
