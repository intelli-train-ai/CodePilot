# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**LLM Providers:**
- Anthropic (Claude API) - Primary chat/reasoning provider
  - SDK: `@ai-sdk/anthropic`
  - Auth: `ANTHROPIC_API_KEY` (api_key style) or `ANTHROPIC_AUTH_TOKEN` (auth_token style, enterprise)
  - Protocol: Native Anthropic API or compatible
  - Base URL: Configurable, defaults to https://api.anthropic.com
- OpenAI (ChatGPT, GPT-4) - Alternative LLM provider
  - SDK: `@ai-sdk/openai`
  - Auth: `OPENAI_API_KEY`
  - Protocol: OpenAI-compatible REST
- Google Generative AI (Gemini) - Text & image generation
  - SDK: `@ai-sdk/google`, `@google/genai` 1.43.0
  - Auth: `GOOGLE_API_KEY`
  - Protocol: Google REST API
- AWS Bedrock - Claude access via AWS
  - SDK: `@ai-sdk/amazon-bedrock`
  - Auth: AWS credentials (environment-based, no API key)
  - Env var: `CLAUDE_CODE_USE_BEDROCK`
- Google Vertex AI - Claude via Google Cloud
  - SDK: `@ai-sdk/google-vertex`
  - Auth: Google Cloud credentials (environment-based)
  - Env var: `CLAUDE_CODE_USE_VERTEX`
- OpenRouter - Multi-model proxy
  - Protocol: OpenAI-compatible
  - Auth: OpenRouter API key header

**Provider Resolution:**
- Central resolver: `src/lib/provider-resolver.ts` (unified for all consumers)
- Catalog: `src/lib/provider-catalog.ts` (vendor presets, protocols, model mappings)
- Uses unified resolution chain: explicit request → session → global default → environment vars

## Data Storage

**Databases:**
- SQLite (better-sqlite3)
  - Storage: `~/.codepilot/codepilot.db` (or `CLAUDE_GUI_DATA_DIR` override)
  - WAL journal mode enabled
  - Schema migrations: `src/lib/db.ts` (hardcoded schema with migration tracking)
  - Tables: chat_sessions, messages, settings, api_providers, tasks, media_jobs, audit_logs, custom_cli_tools, media_contexts, checkin_responses

**File Storage:**
- Local filesystem only (no cloud storage)
- Media library: `~/.codepilot/.codepilot-media/` (indexed in DB)
- Uploads: `.codepilot-uploads/` per working directory
- Electron resources: bundled in ASAR archive (`electron-builder.yml`)

**Caching:**
- In-memory caches (globalThis): MCP server configs, cached capabilities
- Session locks: File-based locking (`DB_PATH + .migration-lock`) for concurrent builds

## Authentication & Identity

**Auth Provider:**
- Custom/Built-in
  - Implementation: Environment variable token (`CODEPILOT_ACCESS_TOKEN`)
  - Enforcement: `src/lib/auth.ts` (requireAuth middleware for API routes)
  - Scope: API routes only (no UI authentication)

**Claude Code SDK Authentication:**
- Permissions: `@anthropic-ai/claude-agent-sdk` permission system
  - Managed via: `src/lib/permission-registry.ts`, `src/app/api/chat/permission/route.ts`
  - Persistent storage: SQLite permissions table
- Mode/Group Policy: `src/app/api/chat/mode/route.ts` (permission group policies)

## Monitoring & Observability

**Error Tracking:**
- None detected (errors logged to stdout/stderr)
- Error classification: `src/lib/error-classifier.ts` (categorizes SDK/system errors)

**Logs:**
- Console-based logging (stdout/stderr in dev and production)
- Telegram notifications: Optional task/error notifications (bridge mode)
- Audit logs: SQLite audit_log table for bridge events, permission requests

## CI/CD & Deployment

**Hosting:**
- Desktop: macOS, Windows, Linux (via Electron)
- Optional: Next.js standalone server (for future web deployment)

**CI Pipeline:**
- GitHub Actions (auto-triggered on releases)
- Platforms: macOS (x64 + arm64), Windows (x64 + arm64), Linux (x64 + arm64)
- Artifacts: DMG (macOS), NSIS installer (Windows), AppImage/deb/rpm (Linux)

**Packaging:**
- electron-builder config: `electron-builder.yml`
- After-pack hook: `scripts/after-pack.js` (rebuilds native modules for Electron ABI)
- Notarization: macOS only (configured in config, notarize: false)

## Environment Configuration

**Required env vars:**
- API Provider credentials (vendor-specific, stored in DB typically):
  - `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`
  - `OPENAI_API_KEY`, `GOOGLE_API_KEY`, etc. (or in DB as API provider records)
- Access control:
  - `CODEPILOT_ACCESS_TOKEN` (optional, enables API auth)
- Data directory:
  - `CLAUDE_GUI_DATA_DIR` (optional, defaults to `~/.codepilot`)
- Git/Shell:
  - `CLAUDE_CODE_GIT_BASH_PATH` (Windows, Git Bash path detection)
- Bedrock/Vertex (when used):
  - `AWS_*` credentials (AWS SDK picks up automatically)
  - Google Cloud credentials (GOOGLE_APPLICATION_CREDENTIALS)

**Secrets location:**
- SQLite `api_providers.api_key` (encrypted by design — user manages via UI)
- `.env` (local development only, never committed)
- Environment variables passed via parent shell

## Webhooks & Callbacks

**Incoming:**
- Discord Bot: Gateway intents + message events (receive messages in Discord channels/DMs)
- Telegram Bot: Long polling (`src/lib/telegram-bot.ts`) or bridge adapter (webhook-style via MCP)
- Chat API: POST `/api/chat` (SSE streaming response)

**Outgoing:**
- Claude Code Agent SDK: Tool results, permission updates via structured protocol
- Discord: Message send, typing indicators, embeds via REST API
- Telegram: Message send, notification push via Bot API
- Feishu (Lark): Message send via IM API (adapter in bridge, not yet implemented)

## MCP Server Integration

**Inbound MCP Servers:**
- CLI Tools MCP: `src/lib/cli-tools-mcp.ts` (stdio-based, spawns as subprocess)
- Dashboard MCP: `src/lib/dashboard-mcp.ts` (custom tools for settings/data export)
- Media Generation MCP: `src/lib/image-gen-mcp.ts`, `src/lib/media-import-mcp.ts` (image generation, media import)
- Widget Guidelines MCP: `src/lib/widget-guidelines.ts` (UI design reference)
- CodePilot MCP Loader: `src/lib/mcp-loader.ts` (dynamically loads user-configured MCP servers)

**SDK Agent Servers:**
- Created via `@anthropic-ai/claude-agent-sdk` `createSdkMcpServer()` + `tool()`
- Served over HTTP/SSE or stdio (configurable in UI)

## Discord Bridge

**Configuration:**
- Settings keys: `bridge_discord_*` (enable, token, allowed users/channels/guilds, policies, streaming, attachment size)
- Implementation: `src/lib/bridge/adapters/discord-adapter.ts`
- Runtime: discord.js v14 Client (lazy-loaded via dynamic import)
- Features: Message receive (gateway intents), send, typing, embeds, attachments

## Telegram Bridge

**Configuration:**
- Settings keys: `telegram_*` (bot token, chat ID, enable, notify filters)
- Implementation: `src/lib/bridge/adapters/telegram-adapter.ts`
- Runtime: Long polling (fallback) or bridge adapter (async message queue)
- Features: Message send, notification push, inline keyboard, media attachments

## Feishu/Lark Bridge

**Configuration:**
- SDK: `@larksuiteoapi/node-sdk`
- Not yet fully integrated (adapter interface exists, awaiting implementation)

---

*Integration audit: 2026-04-09*
