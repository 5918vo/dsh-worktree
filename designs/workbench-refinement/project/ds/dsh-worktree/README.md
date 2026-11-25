# DSH Worktree 仪表台

面向嵌入式 Git 任务工作台的克制定制系统。沿用 `src/client/styles/workbench.ts` 的纸黑／暖纸与铜色语言，不以通用后台模板替换产品视觉。

## 原则

- **下一步先于技术细节。** 标题、状态和当前行动优先；分支、路径、会话标识保留在详情。
- **状态必须可读。** 圆点或颜色旁总有文字；会话状态与 Git 状态分开表达。
- **边框建立层级。** 发丝线、对齐和留白分区，不使用卡片投影或装饰渐变。
- **铜色保持稀缺。** 活动、选中和焦点使用 `accent`，常规主按钮使用 `cta-bg`。
- **密度可调。** 4/8/12/16/24/32 间距，控件高 28/32/36，任务行 12.5px，正文 13px。

## 使用

在 Design canvas 中加载 `tokens.css`，以 `var(--bg-canvas)`、`var(--text-1)`、`var(--accent)` 等语义变量编写界面。没有可复用 React 组件 bundle；不要把画板示意当作生产组件导入。

## 任务行

保留标题和分支的双轴。默认显示任务状态与一个最紧急的提醒，完整标签、估算、计时、依赖和截止信息放在任务详情。异常、逾期和待验收不得被一般标签淹没。

## 响应式与可访问性

宽屏 272px / 自适应 / 284px；≤980px 右栏为抽屉；≤720px 单列。所有操作使用原生按钮或链接，键盘焦点为 2px accent，正文对比度至少 4.5:1，状态不单独靠颜色表达，支持减少动态效果。

<!-- open-artifact:usage (generated, do not edit) -->
## Consuming this system (generated — do not edit)

Load the compiled tokens; every token is a CSS custom property and every text style a class:

```html
<link rel="stylesheet" href="tokens.css">
```

Themes: `dark`, `light`. The first applies by default; set `data-theme="<id>"` on any element to switch its subtree.

For example `var(--bg-canvas)`, `var(--space-xs)`, `var(--radius-sm)`.

Text styles are classes: `<h1 class="task-title">`.


## Index (generated — do not edit)

- `api/tokens.md` — Tokens
- `api/README.md` — DSH Worktree 仪表台 — agent reference
<!-- /open-artifact:usage -->
