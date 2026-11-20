# 从 dsh-context 借鉴的做法

参考项目：[`bowenliang123/dsh-context`](https://github.com/bowenliang123/dsh-context)（DeepSeek Harness 的上下文洞察插件）。
重点研究了 `docs/host-client-principles.md`、`src/client/styles/base.css`、`styles/tailwind.css`、`nameColor.ts`、`styles/stackedBar.css`、`styles/stats.css` 以及 `src/client/components/*`。

## 已落地

### 1. 配色接入宿主设计令牌（`src/client/palette.ts`）
dsh-context 全程使用宿主的 `--dsw-alias-*` 令牌（`bg-layer-1/2`、`border-l1..l3`、`label-primary/secondary/dimmed`、`brand-primary`、`button-primary-fill`、`state-*-primary`、`shadow-lv*`），因此插件会跟随宿主明暗主题与品牌色。

本插件此前是自持的 hex 调色板（`--dshw-*`）。现在 `paletteVars()` 会为可映射的令牌输出：

```
--dshw-surface: var(--dsw-alias-bg-layer-1, #ffffff);
```

- 宿主提供令牌时优先使用宿主值（自动跟随主题/品牌）；
- 令牌缺失时回退到本插件原有 hex（独立运行/旧宿主仍正常）；
- `.dshw-dark` 探针已存在（`src/client/ui.ts` 用 `--dsw-alias-label-primary` 亮度判断），与令牌桥接互补。

### 2. 品牌派生的焦点环与阴影
`focusRing` / `brandShadow` 改为 `color-mix(in srgb, var(--dshw-brand) …%, transparent)`，焦点环与品牌色一致，换品牌色不再出现“蓝环配紫按钮”。

### 3. OKLCH 数据色板 + 项目配色哈希
- `palette.ts` 新增 `ACCENTS`（8 色 OKLCH，感知均匀）与 `accentVars()` → `--dshw-accent-1..8`。
- `styles.ts` 生成 `.dshw-folder-tile--c1..c8`，背景用 `color-mix(accent 16%, surface)`，明暗主题都清晰。
- `board-page.ts` 的 `projectColor()` 由 4 个固定色名改为按项目 id 哈希到 8 档（对应 dsh-context `nameColor.ts` 的 `nameColorOf` 思路）。

## 建议下一步借鉴（尚未实现）

| 做法 | dsh-context 出处 | 对本项目的价值 |
| --- | --- | --- |
| 有界 + TTL 缓存 | `boundedCache.ts`、principles「缓存必须有 ttl/上限」 | 现有 `Runtime.previewCache` 无上限、无 TTL（按 taskId 单条），任务多时清理更稳妥 |
| 按需/分页/滑动窗口加载 | `fetchOnMiss.tsx`、`invalidation.ts` | 会话时间线/上下文浏览器式的大列表可避免一次性加载 |
| 后端聚合、前端少算 | principles「尽可能后端化/预聚合」 | 统计类信息（任务计数、状态聚合）尽量在 `runtime` 由后端给出 |
| 骨架屏按最终尺寸占位 | `cardSkeletons.tsx` | 减少详情/列表加载后的布局跳动 |
| 面板级错误边界 | `components/errorBoundary.tsx` | 单个面板渲染异常不应拖垮整个 board |
| 静默预取 + 失效通知 | `prefetch.ts`、`invalidation.ts` | 切换任务时预取详情，操作后按事件失效而非纯轮询 |
| 细分割 API / 细粒度 model | principles「高内聚低耦合、细粒度 API」 | 继续拆分 `task/*` 路由，避免大 payload |
| 明暗两套细化样式 | `styles/base.css` 的 `body:not([data-ds-dark-theme])` | 浅色可用 0.5px 细线、分层阴影、稍大圆角；深色保持简洁 |

## 结论
这次优先落地了用户最关心的 **UI 配色**：宿主令牌桥接 + 品牌派生 + OKLCH 数据色板 + 项目哈希配色。其余为结构化/性能类改进，建议按上表逐项评估后再做。
