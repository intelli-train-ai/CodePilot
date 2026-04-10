# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- TypeScript 5+ - All source code in `src/`, `electron/`, Electron preload/main, API routes
- JavaScript (ES2017) - Build scripts, configuration files, Next.js config

**Secondary:**
- YAML - Electron builder config (`electron-builder.yml`)
- JSON - Package manifests, TypeScript config, theme definitions

## Runtime

**Environment:**
- Node.js (version managed via workspace)
- Electron 40.2.1 - Desktop application runtime for macOS/Windows/Linux

**Package Manager:**
- npm (workspace-enabled)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.2.1 - React SSR/static generation, API routes (`src/app/api/`)
- React 19.2.3 - UI component framework
- Electron 40.2.1 - Desktop wrapper, IPC bridge to Next.js

**UI & Styling:**
- Tailwind CSS 4 - Utility-first CSS framework (`@tailwindcss/postcss`)
- Radix UI 1.4.3 - Accessible component primitives
- React Markdown 10.1.0 - Markdown rendering with code highlighting
- Shiki 3.22.0 - Code syntax highlighting
- Recharts 3.7.0 - Data visualization charts

**AI/LLM Integration:**
- Vercel AI SDK 6.0.73 - Unified LLM provider interface
  - `@ai-sdk/anthropic` 3.0.47 - Claude API client
  - `@ai-sdk/openai` 3.0.34 - OpenAI API compatibility
  - `@ai-sdk/google` 3.0.31 - Google Generative AI (Gemini)
  - `@ai-sdk/amazon-bedrock` 4.0.77 - AWS Bedrock access
  - `@ai-sdk/google-vertex` 4.0.80 - Google Vertex AI
- `@anthropic-ai/claude-agent-sdk` 0.2.62 - Claude Code MCP server, agent tools, permissions

**Communication & Integrations:**
- discord.js 14.25.1 - Discord Bot API (gateway + REST, lazy-loaded to avoid bundler issues)
- WebSocket (ws 8.19.0) - Real-time communication
- @larksuiteoapi/node-sdk 1.59.0 - Feishu/Lark IM integration

**Testing:**
- Playwright 1.58.1 - E2E and smoke testing (`playwright.config.ts`)
  - E2E tests: `src/__tests__/e2e/*.spec.ts`
  - Smoke tests: tests tagged with `@smoke`
  - Visual regression: tests tagged with `@visual`
- (No Jest/Vitest detected in test scripts - uses tsx for unit tests)

**Build & Dev:**
- electron-builder 26.8.1 - Package Electron apps for macOS/Windows/Linux
- ESLint 9 - Code linting (Next.js core rules + TypeScript)
- Next.js built-in build pipeline - SSR → standalone server
- esbuild 0.27.3 - Fast bundler for scripts

**Database:**
- better-sqlite3 12.6.2 - Synchronous SQLite for local data storage
  - Database path: `~/.codepilot/codepilot.db` (or `CLAUDE_GUI_DATA_DIR` override)
  - Server packages: declared in `serverExternalPackages` in `next.config.ts`

**Utilities:**
- uuid 13.0.0 - Unique ID generation
- nanoid 5.1.6 - Compact ID generation
- crypto (Node.js built-in) - HMAC, hashing for auth
- zlib-sync 0.1.10 - Compression (external server package for Electron)

## Configuration

**Environment:**
- API keys and secrets: Stored in SQLite `settings` table (encrypted via user's own secrets)
- Legacy env var fallback: `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_BASE`
- Data directory: `process.env.CLAUDE_GUI_DATA_DIR` or `~/.codepilot/`
- Access control: `process.env.CODEPILOT_ACCESS_TOKEN` for API authentication

**Build:**
- `next.config.ts` - Next.js configuration, external packages whitelist, version injection
- `tsconfig.json` - Strict TypeScript, path aliases (`@/*` → `./src/*`)
- `playwright.config.ts` - E2E test configuration, dev server orchestration
- `postcss.config.mjs` - Tailwind CSS processing
- `eslint.config.mjs` - ESLint flat config with Next.js presets, governance rules

## Platform Requirements

**Development:**
- Node.js (LTS recommended)
- macOS 12.0+ / Windows 10+ / Linux (glibc 2.31+) for dev environment
- Python build tools (for better-sqlite3 native compilation)

**Production/Packaging:**
- macOS 12.0+ - Intel + Apple Silicon (arm64 + x64 DMG)
- Windows 10+ - NSIS installer (x64 + arm64)
- Linux - AppImage, deb, rpm packages
- Electron auto-updater: GitHub Releases provider (`electron-updater`)

## External Server Requirements

**Next.js Standalone Output:**
- `serverExternalPackages` in `next.config.ts`: `better-sqlite3`, `discord.js`, `@discordjs/ws`, `zlib-sync`
- These are NOT bundled; must be installed in production deployment

---

*Stack analysis: 2026-04-09*
