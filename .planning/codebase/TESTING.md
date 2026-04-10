# 测试规范

**分析日期：** 2026-04-09

## 测试框架

**运行器：**
- Node.js 内置 `node:test` 模块（无需额外依赖）
- 配置：直接运行，无配置文件
- 命令：`npx tsx --test src/__tests__/unit/*.test.ts`

**断言库：**
- Node.js 内置 `assert/strict`（提供 `deepStrictEqual`, `equal`, `ok` 等）
- 导入：`import assert from 'node:assert/strict'`

**E2E 测试框架：**
- Playwright 1.58+（`@playwright/test`）
- 配置：`playwright.config.ts`
- 命令：`npx playwright test`、`npx playwright test --grep @smoke`、`npx playwright test --grep @visual`

**运行命令：**
```bash
npm run test              # typecheck + 单元测试 (~4s，无需 dev server)
npm run test:smoke       # 冒烟测试 (~15s，需要 dev server)
npm run test:e2e         # 完整 E2E 测试 (~60s+，需要 dev server)
npm run test:visual      # 仅视觉回归测试
```

## 测试文件组织

**位置：**
- 单元测试：`src/__tests__/unit/*.test.ts`（位置：`src/__tests__/unit/`）
- E2E 测试：`src/__tests__/e2e/*.spec.ts`（位置：`src/__tests__/e2e/`）
- 测试助手：`src/__tests__/helpers.ts`

**命名：**
- 单元测试文件：`{module-name}.test.ts`，如 `claude-session-parser.test.ts`、`widget-system.test.ts`
- E2E 规格：`{feature}.spec.ts`，如 `project-panel.spec.ts`、`chat-enhanced.spec.ts`
- 按特性或模块分组，不按类型分组

**文件大小：**
- 单个测试文件通常 100-600 行
- 大型特性（如 widget-system）可达 600+ 行

## 测试结构

**单元测试套件结构（来自 `src/__tests__/unit/claude-session-parser.test.ts`）：**
```typescript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('module-under-test', () => {
  // Optional setup/teardown
  before(async () => {
    // Setup code (e.g., create test data)
  });

  after(() => {
    // Cleanup (e.g., remove temp files)
  });

  // Nested describe blocks for grouping
  describe('function-name', () => {
    it('should do X when given Y', () => {
      // Arrange
      const input = /* test data */;
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      assert.equal(result, expected);
    });

    it('should handle edge case Z', () => {
      // Single test case
      assert.ok(condition);
    });
  });

  describe('another-function', () => {
    it('should...', () => {
      // Implementation
    });
  });
});
```

**E2E 测试结构（来自 `src/__tests__/e2e/project-panel.spec.ts`）：**
```typescript
import { test, expect } from '@playwright/test';
import { goToChat, waitForPageReady, /* ... */ } from '../helpers';

test.describe('Feature Name', () => {
  test.describe('Scenario Group', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/chat/test-session');
      await waitForPageReady(page);
    });

    test('should display X when condition Y', async ({ page }) => {
      // Arrange & Act
      const element = page.locator('selector');
      
      // Assert
      await expect(element).toBeVisible();
    });

    test('should handle interaction Z', async ({ page }) => {
      // Implementation
    });
  });
});
```

**模式：**
- `describe()` 用于逻辑分组（功能、模块、场景）
- `it()` 或 `test()` 用于单个测试用例
- 嵌套 `describe()` 块深度通常 1-2 层
- 每个 `it()` 应该独立运行（不依赖执行顺序）

## 模拟（Mocking）

**框架：**
- Node.js 内置 `node:test` 的 mocking API（或不使用 mock）
- 单元测试倾向于使用真实依赖或手动 stub（如示例中的 `makeUserEntry` 工厂函数）
- E2E 测试不需要 mocking（测试真实应用）

**模拟模式（来自 `claude-session-parser.test.ts`）：**
```typescript
// Factory functions create test data
function makeUserEntry(opts: {
  sessionId: string;
  content: string;
  cwd?: string;
  // ...
}): UserEntry {
  return {
    type: 'user',
    sessionId: opts.sessionId,
    message: { role: 'user', content: opts.content },
    // ...
  };
}

// Use factories in tests
describe('listClaudeSessions', () => {
  it('should list sessions with messages', () => {
    const sessionId = 'test-session-001';
    const userEntry = makeUserEntry({
      sessionId,
      content: 'Hello, can you help me?',
    });
    createSessionFile('-home-user-myproject', sessionId, [userEntry]);
    
    const sessions = parser.listClaudeSessions();
    assert.ok(sessions.some(s => s.sessionId === sessionId));
  });
});
```

**什么应该 mock：**
- 文件系统操作（`fs` 模块）
- 网络请求（Playwright 中的 `page.route()`）
- 日期/时间（可选，通常避免）

**什么不应该 mock：**
- 核心业务逻辑函数（直接测试）
- 数据结构（使用真实数据）
- 标准库函数（除非出现性能问题）

## 测试数据（Fixtures 和 Factories）

**测试数据模式：**
```typescript
// Factory function (most common)
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
    parentUuid: opts.parentUuid ?? null,
    isSidechain: false,
    userType: 'external',
    cwd: opts.cwd || '/home/user/myproject',
    sessionId: opts.sessionId,
    version: opts.version || '2.1.34',
    gitBranch: opts.gitBranch || 'main',
    type: 'user',
    message: {
      role: 'user',
      content: opts.content,
    },
    uuid: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: opts.timestamp || '2026-01-15T10:00:01.000Z',
    permissionMode: 'default',
  };
}

// Usage in test
const userMsg = makeUserEntry({
  sessionId: 'test-001',
  content: 'What is TypeScript?',
  cwd: '/home/user/tsproject',
});
```

**位置：**
- 通常在测试文件中定义（行注释：`// Test data factories`）
- 大型共享 fixture：`src/__tests__/fixtures/` 目录（如需）
- 当前代码库中，大多数测试数据内联定义

## 覆盖率

**要求：**
- 无强制覆盖率目标
- 倾向于测试关键路径（不追求 100% 覆盖）

**查看覆盖率：**
```bash
# 无专门命令，通过运行 npm run test 后查看输出
npm run test
```

## 测试类型

**单元测试（`src/__tests__/unit/`）：**
- 作用域：单个函数或类
- 范围：纯函数（无副作用）、算法、数据转换
- 示例：
  - `claude-session-parser.test.ts` — 测试 JSONL 解析逻辑
  - `message-input-interactions.test.ts` — 测试输入交互算法
  - `widget-system.test.ts` — 测试 widget 渲染和安全性
- 特点：快速运行，可并行执行

**集成测试（单元测试的一部分）：**
- 部分单元测试测试多个模块的交互
- 示例：`message-persistence.test.ts` — 测试消息持久化和读取
- 通常涉及数据库或文件系统

**冒烟测试（E2E 的子集）：**
- 作用域：关键用户路径
- 标记：`@smoke` tag
- 运行：`npm run test:smoke`
- 快速验证核心功能（~15s）

**E2E 测试（`src/__tests__/e2e/`）：**
- 作用域：完整用户场景
- 包含：导航、交互、断言
- 示例：
  - `project-panel.spec.ts` — 测试文件树面板打开/关闭
  - `chat-enhanced.spec.ts` — 测试聊天消息流
  - `skills.spec.ts` — 测试技能/命令系统
- 特点：较慢，可靠性高，捕捉回归

**视觉回归测试：**
- 作用域：UI 外观一致性
- 标记：`@visual` tag
- 运行：`npm run test:visual`
- 配置（`playwright.config.ts`）：
  ```typescript
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,  // 1% 差异阈值
    },
  }
  ```

## 常见测试模式

**异步测试：**
```typescript
describe('async function', () => {
  it('should resolve with result', async () => {
    const result = await asyncFunction();
    assert.equal(result, expected);
  });

  it('should reject on error', async () => {
    try {
      await asyncFunction();
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof Error);
    }
  });
});
```

**错误测试：**
```typescript
describe('error handling', () => {
  it('should throw TypeError on invalid input', () => {
    assert.throws(
      () => functionThatThrows(invalidInput),
      TypeError,
    );
  });

  it('should handle errors gracefully', () => {
    const result = safeFunction(badInput);
    assert.equal(result, null); // or default value
  });
});
```

**Playwright 交互测试：**
```typescript
test('should submit form on Enter', async ({ page }) => {
  // Type input
  await page.fill('input[name="message"]', 'Hello');
  
  // Simulate key press
  await page.press('input[name="message"]', 'Enter');
  
  // Wait for response
  await page.waitForURL('/chat/*');
  
  // Assert
  await expect(page.locator('text=Hello')).toBeVisible();
});
```

**Playwright 页面导航助手（来自 `helpers.ts`）：**
```typescript
// Navigation
await goToChat(page);
await goToConversation(page, 'session-id');
await goToSettings(page);

// Wait for ready
await waitForPageReady(page);
await waitForStreamingStart(page);
await waitForStreamingEnd(page);

// Common locators
const input = chatInput(page);
const sendBtn = sendButton(page);
const sidebar = sidebar(page);

// Actions
await sendMessage(page, 'My message');
const roles = await getMessageRoles(page);
```

## 自检命令

**提交前必须运行：**
```bash
npm run test                # ~4s - typecheck + unit tests
npm run test:smoke          # ~15s - 冒烟测试（需要 dev server）
npm run test:e2e            # ~60s+ - 完整 E2E
```

**开发时建议：**
- 新增单元测试时：运行 `npm run test` 快速反馈
- 修改 UI 时：运行 `npm run test:smoke` 验证无回归
- 提交前：依次运行三个命令确保全部通过

## Pre-commit Hook

**自动运行（由 husky 触发）：**
- `npm run typecheck && npm run test:unit`
- 如果失败，commit 被阻止

**跳过（仅在必要时，不推荐）：**
```bash
git commit --no-verify
```

---

*测试规范分析完成于 2026-04-09*
