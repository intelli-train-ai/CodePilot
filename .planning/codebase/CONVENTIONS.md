# 编码规范

**分析日期：** 2026-04-09

## 命名规范

**文件名：**
- React 组件（`.tsx`）：PascalCase，如 `CliToolCard.tsx`、`MessageInput.tsx`、`WidgetRenderer.tsx`
- 工具函数（`.ts`）：kebab-case，如 `message-input-logic.ts`、`claude-session-parser.ts`、`widget-sanitizer.ts`
- Hooks（`.ts`）：camelCase，以 `use` 前缀，如 `useTranslation.ts`、`useAutoSave.ts`、`usePanel.ts`
- 类型定义（`.ts`）：名称中可包含 `types`，如 `src/types/index.ts`

**函数名：**
- 普通函数：camelCase，如 `computeAgentScore`、`detectPopoverTrigger`、`parseClaudeSession`
- React 组件：PascalCase，如 `CliToolCard`、`StreamingMessage`、`MessageInput`
- 辅助函数（私有）：camelCase，如 `filterItems`、`cycleIndex`、`resolveItemSelection`
- 导出函数：使用 `export function` 声明，不使用匿名导出

**变量名：**
- 常量：SCREAMING_SNAKE_CASE，如 `MAX_FILE_SIZE`、`DB_PATH`、`TEST_DIR`
- 布尔值：`is` 或 `has` 前缀，如 `isZh`、`hasToolBlocks`、`showMethodPicker`
- 普通变量：camelCase，如 `availableMethods`、`displayLabel`、`partialKey`

**类型名：**
- 接口：PascalCase，以 `I` 前缀可选（通常省略），如 `CliToolCardProps`、`ParsedMessage`、`ClaudeSessionInfo`
- 泛型参数：单字母或 PascalCase，如 `T`、`TItem`、`ContentBlock`
- 类型别名：PascalCase，如 `PopoverMode`、`KeyAction`、`CommandBadge`

## 代码风格

**格式化工具：**
- 工具：ESLint 9（使用 flat config：`eslint.config.mjs`）
- 搭配 Next.js 核心规则（`eslint-config-next/core-web-vitals` 和 `eslint-config-next/typescript`）
- 所有 TypeScript 和 TSX 文件自动 lint 检查（`npm run lint`）

**关键 ESLint 规则：**
- 禁止在业务组件中使用原生 HTML 标签（`<button>`, `<input>` 等）— 改用 `@/components/ui` 中的组件
- 禁止在业务组件中直接导入 Lucide 图标 — 使用 `@/components/ui/icon` 统一导入
- 禁止在 `src/components/patterns/` 中导入 hooks 或数据逻辑 — pattern 组件必须是纯 UI
- 业务组件文件大小警告：最多 500 行（空白行和注释除外）
- 第三方 SDK（Feishu、插件、测试）中允许 `any` 类型（降级警告）

**颜色使用规范：**
- 禁止使用原始 Tailwind 颜色（如 `text-green-500`, `bg-red-600`）— 使用语义变量
- 通过 `npm run lint:colors` 检查原始颜色（基于 grep）
- 允许例外情况：加注释 `// lint-allow-raw-color`（如 diff 语法高亮）

**打开 TypeScript strict 模式：**
- 启用 `strict: true`，包含 `strictNullChecks`, `strictFunctionTypes` 等
- 所有导入必须明确类型：`import type { SomeType } from '@/types'`

## Import 组织

**顺序（遵循 ESLint 自动排序）：**
1. Node.js 内置模块（`fs`, `path`, `os`）
2. 第三方包（`react`, `next`, `axios`）
3. 本地路径别名（`@/`）
4. 相对路径（`./`, `../`）
5. 类型导入单独分组（`import type { ... }`）

**示例：**
```typescript
// Node built-ins
import fs from 'fs';
import path from 'path';

// Third-party
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Type imports
import type { Message, ChatSession } from '@/types';

// Aliases
import { getDb } from '@/lib/db';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';

// Relative
import { computeAgentScore } from './utils';
```

**路径别名：**
- 定义于 `tsconfig.json`：`@/*` → `./src/*`
- 所有导入使用 `@/` 前缀（除相对路径）
- 常见路径：
  - `@/lib/` — 工具函数、数据库、算法
  - `@/hooks/` — React Hooks
  - `@/components/` — React 组件
  - `@/types/` — TypeScript 类型定义
  - `@/i18n/` — 国际化

## 错误处理

**模式：**
- 同步错误：`try-catch` 或条件判断，如 `if (err instanceof Error)`
- 异步错误：`try-catch` 或 `.catch()` 回调
- 类型防守：检查 `instanceof` 或使用类型谓词

**示例（来自 `src/lib/db.ts`）：**
```typescript
try {
  fs.unlinkSync(lockPath);
} catch (err: unknown) {
  if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
    // Handle specific error
  } else {
    throw err; // Re-throw unknown errors
  }
}

// Ignore specific errors
try {
  fs.unlinkSync(lockPath);
} catch { /* ignore */ }
```

**日志：**
- 使用 `console.log` 或 `console.warn`（无专门日志库）
- 前缀模块名便于调试：`console.log('[db] Migrated database from...')`

## 注释

**何时注释：**
- 函数块：每个导出函数前写 JSDoc 注释（说明参数、返回值、用途）
- 复杂逻辑：在关键步骤前用单行注释解释"为什么"而非"是什么"
- 常量：解释 why 不是 what，如 `const MAX_FILE_SIZE = 50 * 1024 * 1024; // Prevent memory issues`

**JSDoc 格式：**
```typescript
/**
 * Brief description of what the function does.
 *
 * Longer explanation if needed. Can span multiple lines.
 * @param arg1 - Description of arg1
 * @param arg2 - Description of arg2
 * @returns Description of return value
 */
export function myFunction(arg1: string, arg2: number): boolean {
  // ...
}
```

**示例（来自代码库）：**
```typescript
/** Compute agent compatibility score (0-5) from tool definition fields */
export function computeAgentScore(tool: { agentFriendly?: boolean; /* ... */ }): number {
  // Implementation
}

/**
 * Detects popover trigger from input text and cursor position.
 * Used by handleInputChange in useSlashCommands.
 */
export function detectPopoverTrigger(
  text: string,
  cursorPos: number,
): { mode: PopoverMode; filter: string; triggerPos: number } | null {
  // Implementation
}
```

## 函数设计

**大小限制：**
- 单个函数不超过 500 行代码（ESLint 警告）
- 更倾向于拆分成多个小函数而非单个大函数

**参数风格：**
- 3 个或更多参数：使用对象参数，如 `(opts: { sessionId: string; content: string; cwd?: string })`
- 函数式编程：使用 `map`, `filter`, `reduce` 等高阶函数
- 返回多个值：使用对象或数组，不使用输出参数

**示例（来自 `widget-system.test.ts`）：**
```typescript
function makeUserEntry(opts: {
  sessionId: string;
  content: string;
  parentUuid?: string | null;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  timestamp?: string;
}) {
  return {
    sessionId: opts.sessionId,
    content: opts.content,
    // ...
  };
}
```

## 模块设计

**导出风格：**
- 优先命名导出，不使用默认导出（除页面/布局组件）
- 单个文件通常导出多个相关函数或类型
- 公开 API 使用 `export function`，私有函数不加前缀

**Barrel 文件：**
- `src/components/ui/` 中有 barrel 文件（`src/components/ui/index.ts`）重新导出组件
- `src/types/index.ts` 集中导出所有类型定义
- 其他目录避免 barrel 文件，直接导入具体路径

**示例导出结构：**
```typescript
// src/lib/message-input-logic.ts
export interface InsertResult { /* ... */ }
export interface BadgeDispatchResult { /* ... */ }
export type KeyAction = /* ... */

export function detectPopoverTrigger(text: string, cursorPos: number): /* ... */ {
  // Public utility
}

export function filterItems(items: PopoverItem[], filter: string): /* ... */ {
  // Public utility
}

// Private helpers not exported
function privateHelper() { /* ... */ }
```

## 国际化（i18n）

**架构：**
- 翻译存储在 `src/i18n/` 中（`zh.ts` 和 `en.ts`）
- 使用 hook：`useTranslation()` 返回 `{ t: (key) => string }`
- 类型安全：翻译 key 使用 `type TranslationKey`

**使用方式：**
```typescript
import type { TranslationKey } from '@/i18n';
import { useTranslation } from '@/hooks/useTranslation';

export function MyComponent() {
  const { t } = useTranslation();
  return <div>{t('cliTools.category.build' as TranslationKey)}</div>;
}
```

---

*规范分析完成于 2026-04-09*
