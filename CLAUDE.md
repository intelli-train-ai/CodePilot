# CLAUDE.md

CodePilot — Claude Code 的桌面 GUI 客户端，基于 Electron + Next.js。

> 架构细节见 [ARCHITECTURE.md](./ARCHITECTURE.md)，本文件只包含规则和流程。

## 开发规则

**提交前必须详尽测试：**
- 每次提交代码前，必须在开发环境中充分测试所有改动的功能，确认无回归
- 涉及前端 UI 的改动需要实际启动应用验证（`npm run dev` 或 `npm run electron:dev`）
- 涉及构建/打包的改动需要完整执行一次打包流程验证产物可用
- 涉及多平台的改动需要考虑各平台的差异性

**UI 改动必须用 CDP 验证（chrome-devtools MCP）：**
- 修改组件、样式、布局后，必须通过 chrome-devtools MCP 实际验证效果
- 验证流程：`npm run dev` 启动应用 → 用 CDP 打开 `http://localhost:3000` 对应页面 → 截图确认渲染正确 → 检查 console 无报错
- 涉及交互的改动（按钮、表单、导航）需通过 CDP 模拟点击/输入并截图验证
- 修改响应式布局时，用 CDP 的 device emulation 分别验证桌面和移动端视口

**新增功能前必须详尽调研：**
- 新增功能前必须充分调研相关技术方案、API 兼容性、社区最佳实践
- 涉及 Electron API 需确认目标版本支持情况
- 涉及第三方库需确认与现有依赖的兼容性
- 涉及 Claude Code SDK 需确认 SDK 实际支持的功能和调用方式
- 对不确定的技术点先做 POC 验证，不要直接在主代码中试错

**Worktree 隔离规则：**
- 如果任务设置了 Worktree，所有代码改动只能在该 Worktree 内进行
- 严格禁止跨 Worktree 提交（不得在主目录提交 Worktree 的改动，反之亦然）
- 严格禁止 `git push`，除非用户主动提出
- 启动测试服务（`npm run dev` 等）只从当前 Worktree 启动，不得在其他目录启动
- 合并回主分支必须由用户主动发起，不得自动合并
- **端口隔离**：Worktree 启动 dev server 时使用非默认端口（如 `PORT=3001`），避免与主目录冲突
- **禁止跨目录编辑**：属于 Worktree 任务范围的文件，只在该 Worktree 内编辑，不得在主目录修改
- **合并前检查 untracked 文件**：合并回主分支前先 `git status` 确认无调试残留、临时文件等

**Commit 信息规范：**
- 标题行使用 conventional commits 格式（feat/fix/refactor/chore 等）
- body 中按文件或功能分组，说明改了什么、为什么改、影响范围
- 修复 bug 需说明根因；架构决策需简要说明理由

## 自检命令

**自检命令（pre-commit hook 会自动执行前三项）：**
- `npm run test` — typecheck + 单元测试（~4s，无需 dev server）
- `npm run test:smoke` — 冒烟测试（~15s，需要 dev server）
- `npm run test:e2e` — 完整 E2E（~60s+，需要 dev server）

修改代码后，commit 前至少确保 `npm run test` 通过。
涉及 UI 改动时额外运行 `npm run test:smoke`。

## 改动自查

完成代码修改后，在提交前确认：
1. 改动是否涉及 i18n — 是否需要同步 `src/i18n/en.ts` 和 `zh.ts`
2. 改动是否涉及数据库 — 是否需要在 `src/lib/db.ts` 更新 schema 迁移
3. 改动是否涉及类型 — 是否需要更新 `src/types/index.ts`
4. 改动是否涉及已有文档 — 是否需要更新 `docs/handover/` 中的交接文档
5. 改动是否构成新功能或大迭代 — 是否需要写文档（见下方"功能文档"）

## 功能文档

**新功能或大迭代完成后必须同时输出两份文档：**

1. **技术交接文档** — 放 `docs/handover/`
   - 目录结构、数据流、DB schema、API 路由、关键设计决策
   - 涉及 MCP 工具的需列出工具名、参数、自动批准策略
   - 目标读者：接手的开发者，需要能仅靠文档理解模块全貌
2. **产品思考文档** — 放 `docs/insights/`
   - 功能解决了什么用户问题、为什么这样设计而不是其他方案
   - 用户反馈驱动的决策、参考的外部文章/竞品/趋势
   - 未来可能的方向和已知的局限性
   - 目标读者：产品决策者，需要能理解设计背后的"为什么"

**两份文档必须互相反向链接：**
- 交接文档开头：`> 产品思考见 [docs/insights/xxx.md](../insights/xxx.md)`
- 产品文档开头：`> 技术实现见 [docs/handover/xxx.md](../handover/xxx.md)`

**文件命名保持一致**（如 `cli-tools.md`），方便对照查找。

## 发版

**发版流程：** 更新 `RELEASE_NOTES.md` → 更新 package.json version → `npm install` 同步 lock → 提交推送 → `git tag v{版本号} && git push origin v{版本号}` → CI 自动构建发布并使用 `RELEASE_NOTES.md` 作为 Release 正文。不要手动创建 GitHub Release（CI 会自动创建并上传构建产物）。

**发版纪律：** 禁止自动发版。`git push` + `git tag` 必须等用户明确指示后才执行。commit 可以正常进行。

**构建：** macOS 产出 DMG（arm64 + x64），Windows 产出 NSIS 安装包。`scripts/after-pack.js` 重编译 better-sqlite3 为 Electron ABI。构建前清理 `rm -rf release/ .next/`。

**Release Notes 格式（必须严格遵循）：**

标题：`CodePilot v{版本号}`

正文结构：

```markdown
## CodePilot v{版本号}

> 一句话版本摘要，说明这个版本的核心主题或推荐升级理由。

### 新增功能
- 功能描述（面向用户的语言，不要写 commit hash）

### 修复问题
- 修复了 xxx 的问题

### 优化改进
- 优化了 xxx

## 下载地址

### macOS
- [Apple Silicon (M1/M2/M3/M4)](https://github.com/op7418/CodePilot/releases/download/v{版本号}/CodePilot-{版本号}-arm64.dmg)
- [Intel](https://github.com/op7418/CodePilot/releases/download/v{版本号}/CodePilot-{版本号}-x64.dmg)

### Windows
- [Windows 安装包](https://github.com/op7418/CodePilot/releases/download/v{版本号}/CodePilot-Setup-{版本号}.exe)

## 安装说明

**macOS**: 下载 DMG → 拖入 Applications → 首次启动如遇安全提示，在系统设置 > 隐私与安全中点击"仍要打开"
**Windows**: 下载 exe 安装包 → 双击安装

## 系统要求

- macOS 12.0+ / Windows 10+ / Linux (glibc 2.31+)
- 需要配置 API 服务商（Anthropic / OpenRouter 等）
- 推荐安装 Claude Code CLI 以获得完整功能
```

**Release Notes 写作规则：**
- 更新内容必须用用户能理解的语言，不要出现 commit hash、函数名、文件路径
- 每个条目说清楚"用户能感知到什么变化"
- 下载链接必须是完整的 GitHub release download URL，用户点击即可下载
- 如果某个分类没有内容（如没有修复），跳过该分类不要留空标题
- `git log --oneline` 的输出只用于自己梳理，不要原样复制到 Release Notes

## 执行计划

**中大型功能（跨 3+ 模块、涉及 schema 变更、需分阶段交付）必须先写执行计划再开工。**
- 活跃计划放 `docs/exec-plans/active/`，完成后移至 `completed/`
- 纯调研/可行性分析放 `docs/research/`
- 发现技术债务时记录到 `docs/exec-plans/tech-debt-tracker.md`
- 模板和规范见 `docs/exec-plans/README.md`

## 文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 项目架构、目录结构、数据流、新功能触及点
- `docs/exec-plans/` — 执行计划（进度状态 + 决策日志 + 技术债务）
- `docs/handover/` — 技术交接文档（架构、数据流、设计决策）
- `docs/insights/` — 产品思考文档（用户问题、设计理由、趋势洞察）
- `docs/research/` — 调研文档（技术方案、可行性分析）

**检索前先读对应目录的 README.md；增删文件后更新索引。**

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Arena — Agent 闯关测试框架**

Arena 是 CodePilot 内嵌的通用 Agent 测试框架。用户通过配置关卡（场景、评分标准），让 AI Agent（Challenger）接受自动或人工提问（Gatekeeper），对话结束后由 Grader 按混合评分制（必须项 Pass/Fail + 表现项等级）判定通关。支持任意主题的 Agent 测试，如客服、健康管家、销售等。

**Core Value:** 让用户能系统化地评估 AI Agent 在不同场景下的表现，发现 prompt 设计的盲区和弱点。

### Constraints

- **Tech Stack**: 必须使用已有的 Vercel AI SDK + Provider 体系，不引入新 LLM 依赖
- **Database**: 使用已有的 better-sqlite3，新增 Arena 相关表
- **UI Framework**: 使用已有的 Radix UI + Tailwind CSS 组件体系
- **评分可靠性**: 不使用数值评分，仅用离散判断（Pass/Fail、A/B/C/D），提高 LLM 评分一致性
- **i18n**: 新增 UI 文本需同步中英文翻译
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5+ - All source code in `src/`, `electron/`, Electron preload/main, API routes
- JavaScript (ES2017) - Build scripts, configuration files, Next.js config
- YAML - Electron builder config (`electron-builder.yml`)
- JSON - Package manifests, TypeScript config, theme definitions
## Runtime
- Node.js (version managed via workspace)
- Electron 40.2.1 - Desktop application runtime for macOS/Windows/Linux
- npm (workspace-enabled)
- Lockfile: `package-lock.json` (present)
## Frameworks
- Next.js 16.2.1 - React SSR/static generation, API routes (`src/app/api/`)
- React 19.2.3 - UI component framework
- Electron 40.2.1 - Desktop wrapper, IPC bridge to Next.js
- Tailwind CSS 4 - Utility-first CSS framework (`@tailwindcss/postcss`)
- Radix UI 1.4.3 - Accessible component primitives
- React Markdown 10.1.0 - Markdown rendering with code highlighting
- Shiki 3.22.0 - Code syntax highlighting
- Recharts 3.7.0 - Data visualization charts
- Vercel AI SDK 6.0.73 - Unified LLM provider interface
- `@anthropic-ai/claude-agent-sdk` 0.2.62 - Claude Code MCP server, agent tools, permissions
- discord.js 14.25.1 - Discord Bot API (gateway + REST, lazy-loaded to avoid bundler issues)
- WebSocket (ws 8.19.0) - Real-time communication
- @larksuiteoapi/node-sdk 1.59.0 - Feishu/Lark IM integration
- Playwright 1.58.1 - E2E and smoke testing (`playwright.config.ts`)
- (No Jest/Vitest detected in test scripts - uses tsx for unit tests)
- electron-builder 26.8.1 - Package Electron apps for macOS/Windows/Linux
- ESLint 9 - Code linting (Next.js core rules + TypeScript)
- Next.js built-in build pipeline - SSR → standalone server
- esbuild 0.27.3 - Fast bundler for scripts
- better-sqlite3 12.6.2 - Synchronous SQLite for local data storage
- uuid 13.0.0 - Unique ID generation
- nanoid 5.1.6 - Compact ID generation
- crypto (Node.js built-in) - HMAC, hashing for auth
- zlib-sync 0.1.10 - Compression (external server package for Electron)
## Configuration
- API keys and secrets: Stored in SQLite `settings` table (encrypted via user's own secrets)
- Legacy env var fallback: `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_BASE`
- Data directory: `process.env.CLAUDE_GUI_DATA_DIR` or `~/.codepilot/`
- Access control: `process.env.CODEPILOT_ACCESS_TOKEN` for API authentication
- `next.config.ts` - Next.js configuration, external packages whitelist, version injection
- `tsconfig.json` - Strict TypeScript, path aliases (`@/*` → `./src/*`)
- `playwright.config.ts` - E2E test configuration, dev server orchestration
- `postcss.config.mjs` - Tailwind CSS processing
- `eslint.config.mjs` - ESLint flat config with Next.js presets, governance rules
## Platform Requirements
- Node.js (LTS recommended)
- macOS 12.0+ / Windows 10+ / Linux (glibc 2.31+) for dev environment
- Python build tools (for better-sqlite3 native compilation)
- macOS 12.0+ - Intel + Apple Silicon (arm64 + x64 DMG)
- Windows 10+ - NSIS installer (x64 + arm64)
- Linux - AppImage, deb, rpm packages
- Electron auto-updater: GitHub Releases provider (`electron-updater`)
## External Server Requirements
- `serverExternalPackages` in `next.config.ts`: `better-sqlite3`, `discord.js`, `@discordjs/ws`, `zlib-sync`
- These are NOT bundled; must be installed in production deployment
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## 命名规范
- React 组件（`.tsx`）：PascalCase，如 `CliToolCard.tsx`、`MessageInput.tsx`、`WidgetRenderer.tsx`
- 工具函数（`.ts`）：kebab-case，如 `message-input-logic.ts`、`claude-session-parser.ts`、`widget-sanitizer.ts`
- Hooks（`.ts`）：camelCase，以 `use` 前缀，如 `useTranslation.ts`、`useAutoSave.ts`、`usePanel.ts`
- 类型定义（`.ts`）：名称中可包含 `types`，如 `src/types/index.ts`
- 普通函数：camelCase，如 `computeAgentScore`、`detectPopoverTrigger`、`parseClaudeSession`
- React 组件：PascalCase，如 `CliToolCard`、`StreamingMessage`、`MessageInput`
- 辅助函数（私有）：camelCase，如 `filterItems`、`cycleIndex`、`resolveItemSelection`
- 导出函数：使用 `export function` 声明，不使用匿名导出
- 常量：SCREAMING_SNAKE_CASE，如 `MAX_FILE_SIZE`、`DB_PATH`、`TEST_DIR`
- 布尔值：`is` 或 `has` 前缀，如 `isZh`、`hasToolBlocks`、`showMethodPicker`
- 普通变量：camelCase，如 `availableMethods`、`displayLabel`、`partialKey`
- 接口：PascalCase，以 `I` 前缀可选（通常省略），如 `CliToolCardProps`、`ParsedMessage`、`ClaudeSessionInfo`
- 泛型参数：单字母或 PascalCase，如 `T`、`TItem`、`ContentBlock`
- 类型别名：PascalCase，如 `PopoverMode`、`KeyAction`、`CommandBadge`
## 代码风格
- 工具：ESLint 9（使用 flat config：`eslint.config.mjs`）
- 搭配 Next.js 核心规则（`eslint-config-next/core-web-vitals` 和 `eslint-config-next/typescript`）
- 所有 TypeScript 和 TSX 文件自动 lint 检查（`npm run lint`）
- 禁止在业务组件中使用原生 HTML 标签（`<button>`, `<input>` 等）— 改用 `@/components/ui` 中的组件
- 禁止在业务组件中直接导入 Lucide 图标 — 使用 `@/components/ui/icon` 统一导入
- 禁止在 `src/components/patterns/` 中导入 hooks 或数据逻辑 — pattern 组件必须是纯 UI
- 业务组件文件大小警告：最多 500 行（空白行和注释除外）
- 第三方 SDK（Feishu、插件、测试）中允许 `any` 类型（降级警告）
- 禁止使用原始 Tailwind 颜色（如 `text-green-500`, `bg-red-600`）— 使用语义变量
- 通过 `npm run lint:colors` 检查原始颜色（基于 grep）
- 允许例外情况：加注释 `// lint-allow-raw-color`（如 diff 语法高亮）
- 启用 `strict: true`，包含 `strictNullChecks`, `strictFunctionTypes` 等
- 所有导入必须明确类型：`import type { SomeType } from '@/types'`
## Import 组织
- 定义于 `tsconfig.json`：`@/*` → `./src/*`
- 所有导入使用 `@/` 前缀（除相对路径）
- 常见路径：
## 错误处理
- 同步错误：`try-catch` 或条件判断，如 `if (err instanceof Error)`
- 异步错误：`try-catch` 或 `.catch()` 回调
- 类型防守：检查 `instanceof` 或使用类型谓词
- 使用 `console.log` 或 `console.warn`（无专门日志库）
- 前缀模块名便于调试：`console.log('[db] Migrated database from...')`
## 注释
- 函数块：每个导出函数前写 JSDoc 注释（说明参数、返回值、用途）
- 复杂逻辑：在关键步骤前用单行注释解释"为什么"而非"是什么"
- 常量：解释 why 不是 what，如 `const MAX_FILE_SIZE = 50 * 1024 * 1024; // Prevent memory issues`
## 函数设计
- 单个函数不超过 500 行代码（ESLint 警告）
- 更倾向于拆分成多个小函数而非单个大函数
- 3 个或更多参数：使用对象参数，如 `(opts: { sessionId: string; content: string; cwd?: string })`
- 函数式编程：使用 `map`, `filter`, `reduce` 等高阶函数
- 返回多个值：使用对象或数组，不使用输出参数
## 模块设计
- 优先命名导出，不使用默认导出（除页面/布局组件）
- 单个文件通常导出多个相关函数或类型
- 公开 API 使用 `export function`，私有函数不加前缀
- `src/components/ui/` 中有 barrel 文件（`src/components/ui/index.ts`）重新导出组件
- `src/types/index.ts` 集中导出所有类型定义
- 其他目录避免 barrel 文件，直接导入具体路径
## 国际化（i18n）
- 翻译存储在 `src/i18n/` 中（`zh.ts` 和 `en.ts`）
- 使用 hook：`useTranslation()` 返回 `{ t: (key) => string }`
- 类型安全：翻译 key 使用 `type TranslationKey`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## 模式概述
- 前后端同一进程：Next.js API 路由处理所有业务逻辑，React 组件直接调用本地 HTTP 端点
- SSE 流驱动：Claude Agent SDK 返回服务端发送事件流（SSE），客户端实时订阅更新
- 本地数据持久化：better-sqlite3 数据库存储会话、消息、媒体、插件配置
- 会话管理分层：Electron 主进程 → Next.js API 层 → Claude Agent SDK → Claude 后端
## 分层架构
- 目的：窗口生命周期、IPC 通信、系统集成、自动更新
- 位置：`electron/`
- 包含：
- 依赖：Electron API、Node.js 进程管理、`better-sqlite3`
- 被调用：Next.js 服务端代码通过 `contextBridge` 暴露 IPC 接口
- 目的：REST API 端点，业务逻辑编排
- 位置：`src/app/api/` （16 个主路由，52+ REST 端点）
- 包含：
- 依赖：`src/lib/` 业务逻辑层
- 被调用：前端 React 组件通过 `authFetch` 发送 HTTP 请求
- 目的：核心算法、外部 SDK 集成、数据库访问
- 位置：`src/lib/` （60+ .ts 文件）
- 包含：
- 依赖：第三方 SDK（Claude Agent SDK、`@larksuiteoapi/node-sdk` 等）
- 被调用：API 层
- 目的：UI 渲染、用户交互、客户端状态管理
- 位置：`src/components/` 和 `src/app/chat/`, `src/app/plugins/` 等
- 包含：
- 依赖：API 层（通过 Hooks 调用）
- 状态管理：
## 数据流
```
```
```
```
- **全局会话注册：** `conversation-registry.ts` 在 `globalThis` 存储活跃 SDK conversation 引用，支持热更新后状态保留
- **流快照：** `stream-session-manager.ts` 在 `globalThis` 维护 SessionStreamSnapshot，React 组件 Hook 订阅
- **数据库：** `db.ts` 提供 CRUD 接口，API 层调用保存到本地 SQLite
## 数据库（SQLite，位置：`~/.codepilot/codepilot.db`）
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
## 关键抽象
- 目的：管理单个会话的 SSE 流生命周期，与 React 组件生命周期解耦
- 实现：globalThis 单例 + 快照对象 array 维护
- 快照结构：
- 使用者：React Hook `useSSEStream` 订阅快照变化
- 目的：全局维护活跃 SDK conversation 对象，支持跨组件会话恢复
- 实现：globalThis 单例 Map (sessionId → SDK conversation)
- 用途：在 React 组件卸载后仍可恢复流、避免中间件丢弃活跃请求
- 目的：结构化错误分类与用户友好的错误提示
- 类别：16 类（CLI_NOT_FOUND, NO_CREDENTIALS, RATE_LIMITED, CONTEXT_TOO_LONG 等）
- 输出：
- 目的：定义 IM 渠道插件接口，支持可插拔扩展
- 核心接口：
## 入口点
- 位置：`electron/main.ts`
- 触发：用户启动 CodePilot 应用
- 责任：
- 位置：`src/app/layout.tsx` → `src/app/page.tsx` → 重定向到 `/chat`
- 渲染：`src/app/chat/page.tsx`（ChatView 容器）
- 责任：
- 位置：`src/app/api/health/route.ts`
- 责任：健康检查、初始化检测、Doctor 诊断
## 错误处理
- API 层 (`src/app/api/*/route.ts`)：
- 业务逻辑层 (`src/lib/claude-client.ts`)：
- React 层：通过 Hook 捕获，显示 Toast 或 ErrorBoundary
- CLI 层：`CLI_NOT_FOUND`, `CLI_VERSION_TOO_OLD`, `MISSING_GIT_BASH`
- 认证：`NO_CREDENTIALS`, `AUTH_REJECTED`, `AUTH_FORBIDDEN`, `PROVIDER_NOT_APPLIED`
- 网络：`NETWORK_UNREACHABLE`, `RATE_LIMITED`
- 模型：`MODEL_NOT_AVAILABLE`, `CONTEXT_TOO_LONG`, `UNSUPPORTED_FEATURE`
- 进程：`PROCESS_CRASH`, `SESSION_STATE_ERROR`, `RESUME_FAILED`
- 未知：`UNKNOWN`
## 跨切关注点
- 前端：`console.*` 调用
- 后端：`src/lib/runtime-log.ts`（环形缓冲 200 条日志，自动脱敏 API key）
- 导出：`/api/doctor/export` 端点打包诊断信息
- 认证：`requireAuth(request)` 验证 X-Auth-Token（Electron contextBridge 自动注入）
- 文件访问：`src/lib/files.ts` 限制文件浏览范围（white list /src 等）
- Bridge 权限：`permission-broker.ts` 将权限请求转为 IM 内联按钮，需用户显式确认
- 实现：`src/i18n/en.ts` + `zh.ts`
- 使用：`useTranslation()` Hook → 返回 `t(key)` 函数
- 类型安全：`TranslationKey` 联合类型限制翻译键范围
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
