# Phase 3: World Navigation & Progression - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 03-world-navigation-progression
**Areas discussed:** 导航布局

---

## Gray Area Selection

User selected 1 of 4 available areas to discuss:
- [x] 导航布局
- [ ] 进度与锁定视觉 → Claude's Discretion
- [ ] 关卡详情页 → Claude's Discretion
- [ ] 解锁与历史 → Claude's Discretion

---

## 导航布局

### Q1: 世界/关卡的导航结构怎么做？

| Option | Description | Selected |
|--------|-------------|----------|
| Arena 内双栏布局（推荐） | Arena 页面内左侧窄栏显示世界→关卡树（带进度标记），右侧主区域显示关卡详情/运行 | ✓ |
| 增强卡片列表 | 保留现有卡片网格布局，世界用可折叠手风琴分组，卡片上增加进度标记 | |
| 标签页切换 | 每个世界是一个标签页，切换标签显示该世界的关卡列表 | |

**User's choice:** Arena 内双栏布局
**Notes:** 类似邮件客户端的文件夹→内容布局

### Q2: 左侧世界树是常驻显示还是可收起？

| Option | Description | Selected |
|--------|-------------|----------|
| 常驻显示（推荐） | 左侧世界树始终可见，运行中也保持可见 | ✓ |
| 可收起 | 左侧栏可折叠收起，运行时自动收起 | |
| 自动响应 | 选关时显示，进入运行/详情时自动收起 | |

**User's choice:** 常驻显示

### Q3: 进入 Arena 时右侧主区域默认显示什么？

| Option | Description | Selected |
|--------|-------------|----------|
| 选中首个可用关卡的详情 | 自动选中第一个未通关且已解锁的关卡 | |
| 世界总览卡片 | 右侧显示所有世界的概览卡片 | |
| 空状态引导 | 显示欢迎信息 + "选择一个关卡开始挑战"提示 | ✓ |

**User's choice:** 空状态引导

---

## Claude's Discretion

Areas not selected for discussion — Claude has flexibility:
- 进度与锁定视觉（通关/未通关/锁定标记方式、锁定交互）
- 关卡详情页（信息展示布局、与 RunControls 整合）
- 解锁规则（通关定义、首关解锁、重复挑战）
- 运行历史（展示内容和位置）

## Deferred Ideas

None — discussion stayed within phase scope.
