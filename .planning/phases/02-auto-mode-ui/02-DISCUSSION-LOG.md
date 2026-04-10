# Phase 2: Auto Mode UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 02-auto-mode-ui
**Areas discussed:** 对话展示布局, Arena 页面结构

---

## 对话展示布局

### 对话布局方式

| Option | Description | Selected |
|--------|-------------|----------|
| 气泡对话 | 类似聊天应用，Gatekeeper 左侧、Challenger 右侧，与 CodePilot 现有聊天 UI 风格一致 | ✓ |
| 左右分栏 | Gatekeeper 固定左侧、Challenger 固定右侧，各自有独立滚动区域 | |
| 时间线列表 | 消息按时间顺序垂直排列，用角色标识和颜色区分 | |

**User's choice:** 气泡对话
**Notes:** 用户确认 Gatekeeper 在左侧、Challenger 在右侧

### Challenger 流式输出

| Option | Description | Selected |
|--------|-------------|----------|
| 逐字流入 | token 逐个追加到气泡中，类似 ChatGPT/Claude 打字效果 | ✓ |
| 整条淘入 | 完整回复后才显示消息，出现时带淡入动画 | |
| 流式 + 轮次标记 | 逐字流入，同时每条消息带轮次编号 | |

**User's choice:** 逐字流入

### 状态信息栏

| Option | Description | Selected |
|--------|-------------|----------|
| 顶部状态栏 | 对话区顶部固定一行状态栏，显示当前轮次、运行状态、token 用量 | ✓ |
| 嵌入对话流 | 状态信息作为特殊类型消息插入对话流中 | |
| 你决定 | Claude 自行决定 | |

**User's choice:** 顶部状态栏

### 角色标识

| Option | Description | Selected |
|--------|-------------|----------|
| 颜色 + 图标 | 不同角色用不同背景色和角标图标区分 | ✓ |
| 仅颜色区分 | 气泡背景色不同即可 | |
| 你决定 | Claude 自行决定 | |

**User's choice:** 颜色 + 图标

### 自动滚动

| Option | Description | Selected |
|--------|-------------|----------|
| 自动滚动 | 新消息自动滚动到底部，手动上滑时暂停 | ✓ |
| 始终锁定底部 | 始终显示最新消息，不允许上滑 | |

**User's choice:** 自动滚动，手动上滑暂停

---

## Arena 页面结构

### NavRail 位置

| Option | Description | Selected |
|--------|-------------|----------|
| Skills 后面 | Chats → Skills → Arena，与 AI 功能类归组 | ✓ |
| Chats 后面 | Arena 也是对话类功能，紧跟聊天入口 | |
| 最后（Bridge 后） | 放在导航最下方，作为附加功能 | |

**User's choice:** Skills 后面

### 页面结构

| Option | Description | Selected |
|--------|-------------|----------|
| 单页切换 | 一个页面内通过状态切换：关卡列表 → 运行对话 → 评分报告 | ✓ |
| 多页路由 | /arena 列表页、/arena/run/:id 运行页、/arena/report/:id 报告页 | |
| 你决定 | Claude 自行决定 | |

**User's choice:** 单页切换

### 关卡列表展示

| Option | Description | Selected |
|--------|-------------|----------|
| 卡片列表 | 每个关卡一张卡片，显示名称、简述、开始按钮 | ✓ |
| 简单列表 | 纯文字列表，每行一个关卡 | |
| 你决定 | Claude 自行决定 | |

**User's choice:** 卡片列表

### 评分报告位置

| Option | Description | Selected |
|--------|-------------|----------|
| 对话下方展开 | 运行结束后评分报告直接在对话流下方展开 | ✓ |
| 覆盖对话区 | 评分报告替换对话区域，提供"返回对话"按钮 | |
| 你决定 | Claude 自行决定 | |

**User's choice:** 对话下方展开

---

## Claude's Discretion

- 评分报告的具体视觉设计
- 运行启动页布局和交互
- 高级选项（provider/model 选择）的 UI 形式
- 运行中断机制
- 角色的具体图标和配色
- Arena SSE hook 实现方式
- 关卡卡片视觉设计

## Deferred Ideas

None — discussion stayed within phase scope.
