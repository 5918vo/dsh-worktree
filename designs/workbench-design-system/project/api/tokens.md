# Tokens

Every token is a CSS custom property defined by `tokens.css`.

## Colors

Themes: `dark` (纸黑), `light` (暖纸).

| Token | 纸黑 | 暖纸 | Usage |
|---|---|---|---|
| `--bg-canvas` | `#0b0b0c` | `#f8f5ef` | 主工作区背景。 |
| `--bg-rail` | `#070708` | `#f1ede4` | 任务列表和辅助栏背景。 |
| `--bg-elevated` | `#131315` | `#fffdf8` | 输入、选中行和浮层表面。 |
| `--text-1` | `#f2f0ec` | `#17150f` | 标题与主要正文。 |
| `--text-2` | `#a9a59d` | `#4d4a42` | 辅助正文及未选控件。 |
| `--text-3` | `#807c74` | `#736f64` | 元数据、时间和占位符。 |
| `--line` | `#262524` | `#d8d2c6` | 分隔线与普通控件边框。 |
| `--line-strong` | `#4d4a42` | `#c6bfb2` | 输入边框与强调分隔线。 |
| `--accent` | `#e0a256` | `#9a5619` | 活动、选择与焦点，不用于所有状态。 |
| `--accent-soft` | `#1b1814` | `#f0e5d3` | 选中行和活动的低对比背景。 |
| `--cta-bg` | `#f2f0ec` | `#17150f` | 主操作按钮背景。 |
| `--cta-text` | `#0b0b0c` | `#f8f5ef` | 主操作按钮文字。 |
| `--ok` | `#8fbf94` | `#3f7a4a` | 已合并、干净和预检通过，必须附文字。 |
| `--warn` | `#d9a93f` | `#8a5a12` | 待验收、待审批和临近期限，必须附文字。 |
| `--err` | `#e0776f` | `#a83a34` | 异常、逾期和危险操作，必须附文字。 |

## Text styles

| Class | Family | Size / line height | Weight | Usage |
|---|---|---|---|---|
| `.task-title` | var(--font-sans) | 24px / 31px | 600 |  |
| `.body` | var(--font-sans) | 13px / 22px | 400 |  |
| `.section` | var(--font-sans) | 13px / 20px | 600 |  |
| `.auxiliary` | var(--font-sans) | 12px / 18px | 400 |  |
| `.task-row` | var(--font-sans) | 12.5px / 19px | 500 |  |
| `.git-meta` | var(--font-mono) | 11px / 17px | 400 |  |

## Font families

- `--font-sans`: Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif
- `--font-mono`: 'JetBrains Mono', 'Cascadia Code', ui-monospace, monospace

## Spacing

| Token | Value | Usage |
|---|---|---|
| `--space-xs` | `4px` | 图标和紧凑状态间距。 |
| `--space-sm` | `8px` | 控件间距。 |
| `--space-md` | `12px` | 任务行内边距。 |
| `--space-lg` | `16px` | 侧栏内边距。 |
| `--space-xl` | `24px` | 主区分区间距。 |
| `--space-2xl` | `32px` | 主区水平内边距。 |

## Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `4px` | 状态标签与小型控件。 |
| `--radius-md` | `6px` | 按钮、输入和任务行。 |
| `--radius-lg` | `8px` | 弹窗和大型工具表面。 |
