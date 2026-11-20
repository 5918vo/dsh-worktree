# DSH Worktree 工作台冒烟测试记录

- 日期：2026-11-07（21:40 复测更新）
- 版本：`@5318vo/dsh-worktree` 0.1.0，工作区未提交构建（21:31 重新构建并重启，含 `autoBind` 修复）
- 环境：`dsh web --port 3081` + ZCode 内置浏览器（Browser Use / MCP），Windows 11
- 隔离仓库：`C:\Users\liang\dsh-smoke\repo`（main + feature-base）
- 结论：**核心链路可用**；本轮列出的 P0/P1/P2/P3 已全部修复（P0 已实测回归，P2-3 焦点恢复已实测；其余为代码级验证 + 构建通过）。IAB 到 localhost 的连接会间歇失效，导致部分 UI 复测无法连续完成。

## 一、通过项

| # | 场景 | 结果 |
|---|---|---|
| 1 | 新增项目：目录 → 自动加载分支 → 自动选中当前分支（main ●） | 通过 |
| 2 | 新增项目：项目名留空时用目录名 `repo` 自动命名 | 通过 |
| 3 | 新增项目：必填校验、分支加载中禁止提交 | 通过 |
| 4 | 发布任务：标题/描述必填校验（字段级 `role=alert`，聚焦首个错误） | 通过 |
| 5 | 发布任务：中文自定义分支名被拒并给出行内错误 | 通过 |
| 6 | 发布任务：Hash 分支 `dsh-wt/<id8>`，worktree `.dsh-worktrees/<id8>` | 通过 |
| 7 | 发布任务：`.git/info/exclude` 追加 `/.dsh-worktrees/` | 通过 |
| 8 | 项目级 `branchPrefix` 覆盖全局（改为 `dsh-smoke/` 后新任务生效） | 通过 |
| 9 | 发布（不勾选「创建后立即开始」）：待开始、无会话、`创建会话` 入口 | 通过 |
| 10 | 任务详情：摘要、状态、领先提交、实时会话、上下文占用、验收禁用原因 | 通过 |
| 11 | 打开会话：跳转到左侧工作区对应会话 | 通过 |
| 12 | 创建会话：生成会话并绑定（0 轮空会话正确显示） | 通过（侧边栏标题见 P2-2，未确认） |
| 13 | 切到任务分支验收：主仓库真正切到 `dsh-wt/<id8>`，按钮切换为「切回原分支」 | 通过 |
| 14 | 切回原分支：主仓库回到 `main` | 通过 |
| 15 | 合并回基线：确认弹窗展示分支/基线/提交数/脏状态；合并后 main 出现 merge commit | 通过 |
| 16 | 清理 worktree：确认弹窗、脏工作区才可勾「强制」、可同时删分支 | 通过 |
| 17 | 删除任务记录：确认弹窗；记录移除，仓库与提交保留 | 通过 |
| 18 | 删除项目：确认弹窗；项目移除，磁盘仓库保留 | 通过 |
| 19 | 搜索：过滤任务/分支、无结果空状态、`/` 聚焦、`Esc` 清空 | 通过 |
| 20 | 窄屏（容器 420px）：单栏、隐藏列表、显示「返回项目列表」 | 通过 |
| 21 | 暗色主题：`dshw-dark` 下背景 `#0b0e14`、前景 `#edf1f7` | 通过 |

## 二、问题清单

修复状态（2026-11-07 22:0x 全部落地，`npm run typecheck` / `npm run build` 通过）：

| 问题 | 状态 | 修复位置 |
|---|---|---|
| P0-1 重复会话 | 已修复，已实测 | `src/http.ts`（HTTP publish 传 `autoBind:false`）、`src/runtime.ts`、`src/client.ts` 自动绑定 effect |
| P1-1 非 Git 目录静默失败 | 已修复，API 已验证 400 | `Runtime.branches()` 增加 `isRepo` 校验；`useBranchInfo()` 把空分支列表视为加载失败 |
| P1-2 切回原分支禁用态 | 已修复 | 详情页 `backDisabled` 增加 `merged` 与「已回到 originalBranch」判断 |
| P2-1 pending 覆盖生命周期 | 已修复 | `statusMeta()` 终态保留生命周期标签，pending 作为第二个 chip |
| P2-2 侧边栏「新会话」 | 非缺陷，待宿主复核 | 会话标题落盘正确 |
| P2-3 弹窗焦点丢失 | 已修复，已实测 | `Modal` 在 render 阶段记录 opener + 关闭后延迟恢复焦点 |
| P2-4 发布无超时 | 已修复 | `withTimeout()` 包裹 publish（30s）/ bind（60s），超时刷新看板并提示 |
| P3-1 删除确认信息陈旧 | 已修复 | 已清理任务隐藏 worktree 路径，状态显示生命周期 |
| P3-2 打开会话入口重复 | 已修复 | 待处理/异常横幅按钮改为「去处理」 |
| P3-3 无会话任务最近活动 | 已修复 | 仅绑定会话的任务显示 `lastActivity` |

### P0-1 一次「创建后立即开始」的发布产生两个会话，并并发操作同一 worktree（已修复并复测通过）

- 原现象：发布 Alpha（勾选立即开始）后，`~/.dsh/sessions/--C-Users-liang-dsh-smoke-repo--/` 下出现两个会话（`session-0c5237c4…` 与任务绑定的 `session-a3f27179…`），左侧工作区出现两条同名「冒烟测试任务 Alpha」；两个会话在 `dsh-wt/724b2233` 中交替提交，20:38:04–20:38:14 之间产生 4 个作者交替的提交。
- 原定位：发布弹窗 `bindSession` 与看板「Auto-bind tasks published from tools」effect 竞争；任务在 `publish` 返回后、`bind` 完成前已出现在轮询列表中，自动绑定逻辑再次建会话。
- 修复（已在工作区）：`src/http.ts` 对 UI 发布强制传 `autoBind: false`；`src/runtime.ts` 以 `startOnBind = start !== false && autoBind !== false` 落库；`src/client.ts` 自动绑定 effect 增加 `if (publishFor) return` 且依赖含 `publishFor`。
- 复测结果（21:35）：
  - API：`POST publish {start:true, autoBind:false}` → `startOnBind:false`、`sessionId:null`。
  - UI：通过工作台发布 Gamma（勾选立即开始），仓库会话目录只新增 **1 个**会话（`session-1544be94…`），任务 `sessionId` 已绑定，`startOnBind:false`；未再出现重复会话。
  - 磁盘上各会话标题均正确（Alpha ×2、Beta、Gamma），不再有孤儿会话。
- 备注：本次复测时旧测试实例仍在跑 20:28 的旧 `dist/index.js`，重启后才加载到 `autoBind` 修复；以后改 Host 端代码需重启 `dsh web`，仅 `client.ts` 可用 HMR。

### P1-1 非 Git 目录加载分支静默失败，无错误提示与重试（已修复）

- 复现：新增项目 → 目标目录填 `C:\Windows`（非 Git 仓库）。
- 现象：分支下拉只剩占位「基线分支」，提交按钮禁用；**没有错误文案，也没有重试入口**。README 承诺「分支加载失败会显示错误和重试入口」。
- 证据：`GET /dsh-worktree/api/branches?path=C:\Windows` 返回 `200 {"branches":[],"current":null,"default":null}`；客户端 `useBranchInfo` 视作 success，`branches.status === 'error'` 分支永远不触发。
- 定位：`src/client.ts:1870 fetchBranches` / `1874 useBranchInfo` / `2004 branchControl`；服务端 `branches` 路由对非仓库目录返回空成功。
- 复测（21:35，新构建）：服务端对 `C:\Windows` 仍返回 `200 {"branches":[]}`；客户端的 `branches.status === 'error'` 只在 fetch 抛错时出现（新构建已能展示「分支加载失败，可以手动输入分支或重试。」），**空成功仍不会提示**。`branchSelect()`（`src/client.ts:2051`）在空列表时只渲染一个禁用占位项，因此用户只看到空下拉。
- 修复：`Runtime.branches()`（`src/runtime.ts`）先用 `gitx.isRepo` 校验，非仓库目录抛 `TaskError`，HTTP 路由返回 `400 {"error":"目录不是 git 仓库工作区：…"}`；`useBranchInfo()` 同时把「成功但分支为空」视为失败。复测：`GET /branches?path=C:\Windows` → 400，UI 显示错误 + 重试。
- 建议：服务端对非 Git 目录返回 4xx（如 `not-a-git-repo`）；或在客户端把「success 且 branches 为空」视为错误并展示 `loadBranchesFailed` + 重试。

### P1-2 「切回原分支」在已回到基线后仍可点击（已修复）

- 复现：切到任务分支验收 → 切回原分支（成功）→ 再次查看，按钮仍为 enabled；再次点击返回成功、无任何实际变化。
- 影响：误导用户，且重复执行无意义操作；已合并/已清理后该按钮同样可点。
- 定位：`src/client.ts:2513`：`const backDisabled = !task.originalBranch || cleaned`，未判断「当前主仓库是否仍在任务分支」。
- 复测（21:35）：新构建中该表达式仍为 `src/client.ts:2743` 同逻辑。服务端 `Runtime.back()` 本身是幂等的（已在原分支时直接返回），因此这是纯 UI 禁用态问题。
- 修复：`backDisabled` 增加 `merged` 与 `snap.repo.currentBranch === task.originalBranch` 判断，回到基线或已合并后按钮禁用；处于第三个分支时仍可切回。
- 建议：改为 `!task.originalBranch || cleaned || !checkedOut`（或按 `snapshot.repo.currentBranch === task.originalBranch` 判断）。

### P2-1 待回答/待审批覆盖生命周期状态（已修复）

- 现象：任务合并后（main 已有 merge commit、worktree 显示「已合并进基线」），任务行、详情 chip、删除确认仍显示「待回答」；清理后同样被「待回答」覆盖，用户看不到「已合并 / 已清理」。
- 定位：`src/client.ts:1172 statusMeta()`：`if (pendingKind) return { label: pendingLabel(...), tone:'warn', pending:true }` 直接替换生命周期状态。
- 复测（21:35）：新构建中逻辑仍在（`src/client.ts:1228`）。
- 修复：`statusMeta()` 对 `merged`/`cleaned` 保留生命周期标签，并把 pending 以第二个 chip 展示（任务行、详情 hero、删除确认同步生效）；点色也随生命周期恢复。
- 建议：pending 与 lifecycle 并存，例如主 chip 显示「已合并」+ 副 badge「待回答」，或 pending 仅在非终态（merged/cleaned）时覆盖。

### P2-2 侧边栏「新会话」标题疑为宿主草稿/缓存（未确认，待复核）

- 复现：发布 Beta（不立即开始）→ 详情点「创建会话」→ 左侧工作区新增条目显示为「新会话」。
- 复测（21:40）：直接解码 4 个会话的 `session.v4.jsonl.zstd`，`session/title` 事件均为正确任务名（`冒烟测试任务 Alpha` ×2、`Beta 无会话任务`、`Gamma 并发回归`）。说明 `session.rename` 实际成功，侧边栏里的「新会话」更可能是宿主草稿条目或列表刷新滞后，**不作为插件缺陷**，后续用真实宿主刷新再确认。

### P2-3 弹窗 Esc 关闭后焦点落到 BODY（已修复，已实测）

- 复现：新增项目弹窗 → 在「目标目录」按 Esc → 弹窗关闭，`document.activeElement` 为 `BODY`，未回到「新增项目」按钮。
- 定位：`src/client.ts:1753 Modal` 的 cleanup 有 `previous.focus()` 恢复逻辑；实测未生效，原因是 `previous` 在 effect 阶段才读取，此时 `autoFocus` 已把焦点移进弹窗，`previous` 变成了弹窗内输入框。
- 修复：Modal 在 render 阶段用 `useRef` 记录 opener；另外用捕获阶段 `pointerdown` 记录最近一个弹窗外控件；关闭后 `requestAnimationFrame + setTimeout(60ms)` 恢复。实测 Esc 关闭新增项目弹窗后 `document.activeElement` 为「新增项目」按钮。

### P2-4 发布请求无超时，响应丢失时弹窗永久卡在「发布中…」（已修复）

- 现象：21:35 复测时页面到 `127.0.0.1` 的连接出现挂起，`POST publish` 实际已在服务端成功（任务已创建、会话已绑定、只产生 1 个会话），但客户端没收到响应；弹窗一直显示「发布中…」，取消/关闭均因 `busy` 被禁用，只能刷新页面恢复。
- 建议：给 `publish` / `bind` 请求加超时与幂等补偿（超时后按任务列表查询结果），`busy` 状态提供超时退出或可取消。
- 修复：新增 `withTimeout()`；`publish` 30s、`bindSession` 60s。publish 超时会关闭弹窗、刷新看板并提示「发布请求超时，请刷新看板确认任务是否已创建」；bind 超时走发布成功 + 警告路径，任务记录保留可再次打开/创建会话。

### P3-1 删除记录确认弹窗信息陈旧（已修复）

- 现象：worktree 已清理后，确认弹窗仍显示 worktree 路径，并把状态标为「待回答」（应为「已清理」）。
- 建议：终态任务不再展示 worktree 路径，或标注「已清理」。
- 修复：`cleaned` 时隐藏 Worktree 行；状态 chip 使用生命周期标签（已清理/已合并），pending 作为第二个 chip。

### P3-2 「打开会话」入口重复（已修复）

- 现象：任务详情页头与「实时会话」块各有一个「打开会话」按钮，行为相同。
- 建议：保留页头主操作，实时块改为文字链或去掉。
- 修复：保留页头「打开会话」主操作；待处理/异常横幅的上下文按钮改为「去处理」，避免同名重复。

### P3-3 无会话任务的「最近活动」（已修复）

- 现象：Beta 任务从未创建会话，详情仍显示「最近活动 · 1 分钟前」（实为任务 `updatedAt`）。
- 建议：无会话时不显示最近活动，或改名为「创建于」。
- 修复：仅当 `task.sessionId` 存在时渲染「最近活动」。

## 三、测试过程中的环境干扰（非产品问题）

1. **并发编辑/HMR**：测试期间另一个会话持续修改 `src/client.ts`/重建 `dist`，每次构建都会重置工作台面板回聊天首页。已按用户要求先暂停；期间仍有 20:53 一次重建。
2. **Host 端代码需重启**：20:28 启动的实例一直跑旧 `dist/index.js`，21:31 重启后才加载 `autoBind` 修复。仅 `client.ts` 可由 HMR 热更，`index.js`/`http.ts`/`runtime.ts` 改动必须重启 `dsh web`。
3. **IAB 到 localhost 的连接会间歇挂起**：页面加载后约 1 分钟内，`fetch` 开始出现 `Failed to fetch` 或 30s 挂起（`curl` 同时正常，200/ms 级）；重载页面可短期恢复。表现为分支加载失败、发布卡「发布中…」。判断为内置浏览器标签页/宿主 keep-alive 环境问题，非插件逻辑；自动化冒烟建议改用真实 Chrome/CDP，或每次操作前重新导航。
4. **Playwright 点击间歇超时**：IAB 中 `locator.click()` 偶发 3s 超时（`count/isVisible` 正常），改用页面内 `element.click()`/坐标点击后通过；非产品缺陷。
5. **`fill("")` 对受控输入无效**：IAB 下 `fill("")` 不触发 React 状态变更，键盘退格正常；测试改用键盘/脚本清空。非产品缺陷。
6. **HMR 期间抓取到中间态**：如首屏「待开始」后变为「待验收」、清理后状态刷新延迟，属刷新时序，不计为缺陷。
7. **测试隔离钩子**：新构建支持 `DSH_WORKTREE_STATE_DIR` 指定任务状态目录，后续冒烟可用独立状态目录启动实例，避免污染 `~/.dsh/worktree-tasks`。

## 四、回归冒烟清单（建议固化为脚本/清单）

前置：隔离 Git 仓库（main + 至少一个其他分支），`dsh web` 实例与工作台插件已加载。

1. 新增项目：空表单禁止提交；非法目录应出现错误 + 重试；合法目录自动选中当前分支；留空名称用目录名。
2. 发布任务（关闭立即开始）：空标题/描述报错；中文分支名行内报错；留空分支得到 `<prefix><id8>`。
3. 发布任务（打开立即开始）：**只产生一个会话**，左侧只有一条同名会话；任务状态随提交变为待验收。
4. 会话：打开会话、从详情创建会话、创建后标题正确。
5. 验收：checkout → 主仓库分支正确；back → 回基线且按钮禁用；merge → 确认弹窗信息完整、main 有 merge commit；cleanup → 脏时可勾强制、干净时禁用、可删分支；删除记录/项目后仓库不受影响。
6. 状态：待开始 / 进行中 / 待验收 / 已合并 / 已清理 / 待回答 的 chip 与提示一致，终态不被 pending 覆盖。
7. 交互：`/` 聚焦搜索、`Esc` 清空、无结果空状态；窄屏单栏 + 返回；暗色主题色板切换；弹窗 Esc 关闭且焦点回到触发按钮。

## 五、测试数据

- 项目：`repo`（`C:\Users\liang\dsh-smoke\repo`），测试后已删除项目记录，仓库保留。
- Alpha：`dsh-wt/724b2233`，5 个提交，合并为 `34dcef1 Merge branch 'dsh-wt/724b2233'`，worktree 与分支已清理。
- Beta：`dsh-smoke/7a5f4df4`，无提交，worktree 与分支已清理。
- Gamma（P0 复测）：`dsh-wt/b0102996…`，发布后只新增会话 `session-1544be94…`，已清理 worktree、分支和任务记录。
- API 复测任务：`3ad42cd9…`（旧 Host 实例，`startOnBind:true`，已清理）、`dc70fee8…`（新 Host 实例，`startOnBind:false`，已清理）。
- 当前状态：工作区任务列表为空，测试仓库只剩 `main`（已含 Alpha 的合并提交）和 `feature-base`，无残留 worktree。
