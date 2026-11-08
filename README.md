# DeepSeek Worktree 任务插件

`@5318vo/dsh-worktree` · v0.1.0 · 最后更新：2026-11-07

每个任务对应一个真实的 DSH 会话。发布任务时创建独立的 Git worktree 和任务分支，会话以 worktree 为工作目录出现在左侧工作区。任务对话、审批、追问、中止和继续均使用 DSH 原生能力，工作台负责发布、查看状态和验收。

## 文档

- [前端设计说明](docs/frontend-design.md)：布局、视觉系统、组件、交互、可访问性和验收清单。

## 功能概览

- **项目级任务看板**：按项目分组展示任务、运行状态、待审批事项和 Git 状态。
- **真实 worktree 隔离**：每个任务使用 `<repo>/.dsh-worktrees/<id8>`，不污染主仓库工作区。
- **Hash 任务分支**：自动生成 `<branchPrefix><id8>`，例如 `dsh-wt/b92e5f2a`，不把中文标题写进分支名。
- **会话一体化**：任务详情可直接打开已有会话，没有会话时可创建会话。
- **完整验收流程**：切到任务分支、切回原分支、合并、清理 worktree、删除任务记录。
- **验收查看改动**：任务处于「待验收 / 验收中」时，任务详情展示相对基线分支的改动文件列表与逐文件 diff，包含已提交、未提交和未跟踪文件。
- **安全的危险操作**：清理和合并会展示确认信息；删除分支、强制清理只在对应操作可用时出现。
- **响应式工作台**：宽屏双栏，窄屏单列查看详情，并提供返回项目列表按钮。
- **可访问表单**：字段标签关联、必填校验、加载/失败/重试状态、弹窗焦点圈定和 Escape 关闭。

## 使用流程

```text
新增项目
  └─ 选择 Git 仓库目录 → 读取分支 → 确认默认基线分支

发布任务
  └─ POST publish
       ├─ 创建任务分支 <branchPrefix><id8>
       ├─ 创建 worktree .dsh-worktrees/<id8>
       ├─ 写入 .git/info/exclude
       └─ 记录任务台账

绑定会话
  └─ remote.session.create({ cwd: worktree })
       └─ 左侧工作区出现同名会话

开发与验收
  └─ 原生对话 / 审批 / 追问
       ├─ 切到任务分支验收
       ├─ 切回原分支
       ├─ 合并回基线
       └─ 清理 worktree / 删除任务
```

## 新增项目

新增项目弹窗只包含必要内容：

- 目标目录
- 浏览目录
- 项目名称
- 默认基线分支

行为说明：

- 目录输入框下的历史目录列表已移除，不再在弹窗里显示 `recents`。
- 工作台启动时不再为新增项目弹窗请求历史目录；设置页仍保留「最近目录」。
- 目录选择器使用同步锁，避免重复点击触发多个系统对话框；鼠标按下即可触发，键盘仍可通过按钮操作。
- 切换目录会立即清空旧基线分支，避免把上一个仓库的分支带到新项目。
- 默认基线分支为必填项。分支加载期间或分支为空时，不允许提交。
- 分支加载失败会显示错误和重试入口，也可手动输入分支名。
- 分支加载完成后自动选择当前分支或仓库默认分支。

## 任务分支命名

自动生成：

```text
<branchPrefix><id8>
```

示例：

```text
dsh-wt/b92e5f2a
```

规则：

- 默认前缀为 `dsh-wt/`，可在全局配置或项目设置里修改。
- `id8` 为任务 UUID 去掉连字符后的前 8 位。
- 自动分支不使用任务标题，不会生成中文 slug。
- 自定义任务分支只允许英文、数字、点、下划线和斜杠。
- 中文或包含非法字符的分支名会返回 `400`，不会创建 worktree。
- 历史上已经存在的中文分支不会被自动重命名，避免破坏已有 worktree 和合并关系。

## 任务提示词

新建任务统一生成提示词，包含：

- worktree 与主仓库的读写边界，主仓库只读
- 开始前用 `git rev-parse --show-toplevel` / `git branch --show-current` 自检
- 分阶段 commit、禁止切换分支/rebase/push/fetch/pull
- 禁止主动同步基线；即使发现基线有新提交，也只写进总结
- 仅在用户明确要求时执行 `git merge <base>`，冲突先问用户，失败用 `git merge --abort` 恢复
- 完成后汇总改动、提交、验证、冲突处理与遗留风险

## 状态推导

状态以 Git 和会话绑定情况为准：

```text
cleaned
  → broken
  → merged       merge-base --is-ancestor
  → reviewing    主仓库当前检出任务分支
  → review       worktree 有领先提交或未提交改动
  → developing   已绑定会话
  → ready        已创建分支和 worktree，尚未绑定会话
```

界面状态色：

| 状态 | 颜色语义 |
| --- | --- |
| 待开始 / 已清理 | Neutral |
| 进行中 / 验收中 | Brand |
| 待验收 | Warning |
| 已合并 | Success |
| 待审批 / 待回答 | Warning |
| 异常 / 操作失败 | Error |

Git 状态与会话状态分开显示：`review` 只表示 worktree 有待验收的提交或改动；如果最近一轮 `turn/end` 的原因是 `interrupted` 或 `error`，任务行和详情会额外显示「会话中断」/「会话异常」提示，验收操作仍按 Git 状态决定。

## 工作台与交互

- 左侧按项目展示任务树，项目行主体用于选中项目，折叠和新增任务为独立按钮。
- 顶部搜索按项目名、任务标题、分支和待处理状态过滤；`/` 或 `Ctrl/Cmd+K` 聚焦搜索，`Esc` 清空。
- 任务行分为两层：任务标题和状态/提交/改动摘要；有会话的任务提供独立打开按钮。
- 项目详情提供任务总数、进行中、待验收、已合并统计，并把待审批任务汇总为可跳转提示。
- 任务详情按「任务摘要 → 实时会话 → 改动文件（待验收） → 会话信息 → 验收操作 → Worktree/主仓库 → 危险操作」排列。
- 「切到任务分支验收」仅在任务进入待验收（`review`）后可用；待开始、进行中（`developing`）时禁用并说明原因，避免在开发完成前进入验收。
- 实时会话读取会话历史，默认收起为每步一行，点击展开完整内容；思考显示持续时长，工具显示路径/命令、变更行数和完成状态，超出部分省略。
- 会话最近一轮中断或失败时，任务行和详情会显示「会话中断」/「会话异常」，并在详情提供打开会话入口。
- 合并、清理、删除任务、删除项目和清空最近目录均使用页面内确认弹窗，展示分支、路径和未提交改动。
- 基线有新提交时，任务详情会显示「基线已更新」；两边改到同一文件时提示重叠文件，`git merge-tree` 预检到真实冲突时提示「预计冲突」，但不改变任务状态。
- 合并确认弹窗会重新预检：只有文件重叠时允许合并并列出风险文件；预计冲突时禁用合并，并提供「让 Agent 同步基线」。
- 「让 Agent 同步基线」只在用户点击后向会话发送预设消息，插件不会自动向会话插入提醒；是否同步由用户决定。
- 自动合并失败时执行 `git merge --abort`，在弹窗中列出冲突文件和处理方式。
- 删除项目时默认勾选「同时删除 worktree 文件夹」：删除任务记录后会强制移除磁盘上的 worktree 目录；取消勾选则仅移除记录。仓库与分支本身不会被删除。
- 复制会话 ID、分支或路径后会给出 Toast 反馈；刷新状态有独立进行中状态。
- 任务详情和项目设置按 ID 重置状态，避免切换任务或项目后残留表单值、强制清理或删除分支选项。
- 勾选「创建后立即开始」的任务会在绑定会话后立即发送首条指令；历史遗留的空会话任务在详情显示「启动任务」，可补发首条指令。
- 表单字段必须具备可访问名称，必填项显示明确错误。
- 弹窗支持 `aria-modal`、Tab 焦点圈定、Escape 关闭和关闭后焦点恢复。
- 支持 `prefers-reduced-motion`。
- 窄屏下列表/详情切换为单栏，详情页提供「返回项目列表」。

## 配色

全部颜色集中在 `src/client/palette.ts` 的 `PALETTE.light` 和 `PALETTE.dark` 两个对象，构建时生成 `--dshw-*` CSS 变量。

- 更换配色只需修改这两个对象，其他样式不得写死颜色。
- 宿主明暗主题通过 `dshw-dark` 类自动切换对应色板。
- 状态色、终端面板、Toast、阴影和焦点环同样来自配色表。

## 代码结构

客户端按职责拆分，`src/client.ts` 只负责宿主模块注册和 slot 接线：

```text
src/client.ts                 # factory、locale 注册、slots
src/client/
├─ ui.ts                      # 宿主 React 代理、h、useStyles
├─ context.ts                 # appCtx、token、请求、bindSession
├─ palette.ts                 # 明暗色板（唯一颜色来源）
├─ styles.ts                  # 全部 CSS
├─ i18n.ts                    # 直接引用 locale/*.json
├─ icons.ts
├─ format.ts                  # 时间、路径、文本、diff、复制
├─ timeline.ts                # 会话时间线与稳定 key
├─ status.ts                  # 状态到 tone / 文案的映射
├─ primitives.ts              # Btn / Card / Chip / Modal / Field / Toast 等
├─ hooks.ts                   # useBranchInfo、useToast
├─ modals.ts                  # 新增项目、发布任务
├─ task-detail.ts             # LiveCard、TaskDetail
├─ project-detail.ts
├─ settings-page.ts
└─ board-page.ts              # BoardPage、BoardIcon
```

约定：

- 宿主通过 `factory(require)` 注入 React，组件不要直接 `import React from 'react'`，统一从 `src/client/ui.ts` 读取代理。
- 新颜色只改 `src/client/palette.ts`；新样式只改 `src/client/styles.ts`。
- 新文案同时加入 `locale/en.json` 和 `locale/zh.json`，`src/client/i18n.ts` 不再维护第二份字典。
- 新请求统一走 `src/client/context.ts` 的 `getJson` / `post`，它们带 token 刷新和 12s 超时。
- 操作结果统一使用 `useToast` + `Toast`，不再在页面里复制计时器。

## HTTP API

前缀：`/dsh-worktree/api`，同源请求。

```text
POST session
GET  config
GET  recents
POST recents/clear
GET  branches?path=
POST publish
GET  projects
POST projects/add
POST projects/update
POST projects/delete
GET  tasks
POST bind
POST task/checkout
POST task/back
POST task/merge
POST task/merge-preview
POST task/cleanup
POST task/delete
```

- `publish`、`projects/*`、`tasks`、`bind`、`task/*` 需要 `x-dsh-worktree-token`。
- `session` 用于申请工作台 token；`config`、`recents`、`branches` 是本地查询接口。
- `cleanup` 可带 `force`、`deleteBranch`。
- `publish` 未传 `branchName` 时使用 Hash 命名规则。
- `task/merge-preview` 使用 `git merge-tree --write-tree` 做无工作区副作用的合并预检，返回 `baseAhead`、`overlapFiles`、`conflictFiles`；Git 低于 2.38 时返回 `supported: false`，只提示文件重叠。

## 模型工具

```text
worktree_publish { repository, base_branch?, title, task, branch_name?, start? }
worktree_tasks   {}
worktree_act     { id, action, force?, delete_branch? }
```

`worktree_act.action` 取值：

```text
checkout | back | merge | cleanup | delete
```

## 配置

Host 配置位于 `cordis.patch.yml`：

```yaml
- insert:
    - id: deepseek-worktree
      name: '@5318vo/dsh-worktree'
      config:
        dirName: .dsh-worktrees
        branchPrefix: dsh-wt/
        gitPath: git
```

项目级设置可以覆盖 `dirName` 和 `branchPrefix`。

项目、任务和最近目录统一保存在：

```text
~/.dsh/worktree-tasks
```

该目录与 DSH profile、`dsh web` 端口无关。同一台机器上的多个 DSH 实例会读取同一份任务台账，并通过 `.store.lock` 做读改写，避免一个端口看不到另一个端口新建的项目或任务。

首次加载新版本时会迁移旧的 profile 目录和 `DSH_WORKTREE_STATE_DIR` 目录，迁移完成后写入 `.migrated-v2` 标记；旧目录保留，不再重复导入。相同 `repoPath` 的重复项目会自动合并到任务历史最多的那个项目。

发布任务使用同步提交锁；UI 发布由客户端绑定会话，HTTP 发布不会触发工作台自动绑定，避免重复创建同一任务的会话。

## 构建与安装

```bash
npm install
npm run typecheck
npm run build
```

产物：

```text
dist/index.js    Host 插件
dist/client.js   Web 客户端
```

客户端源码在 `src/client/`，构建时由 esbuild 统一打包进 `dist/client.js`；`locale/*.json` 同时供客户端与宿主使用。

在 DSH Web 中通过 Plugins → 安装外部 bundle，源可以是 npm 包名或本地路径：

```text
@5318vo/dsh-worktree
```

或本地开发路径：

```text
C:\Users\liang\dsh-worktree
```

未开启 HMR 时，需要重启 DSH 或重新加载页面。

## 发布

公共 npm 包名为 `@5318vo/dsh-worktree`，`publishConfig.access` 已设为 `public`。

```bash
npm login
npm run typecheck
npm run pack:check   # 预览 tarball 内容
npm run publish:dry  # 发布 dry-run
npm publish
```

- `prepublishOnly` 会在发布前执行 `typecheck` 和 `build`。
- 发布内容由 `files` 白名单控制：`dist`、`cordis.patch.yml`、`locale`、`icon.svg`、`README.md`、`LICENSE`。
- 包名变更时需同步 `cordis.patch.yml` 和 `src/client.ts` 的 `MODULE_ID`。

## 自动化测试

仓库内置一套基于 Node 内置测试运行器（`node --test`）的自动化测试，用于在每次改动后回归主流程，避免「新建任务后无法执行」或出现未捕获异常。

```bash
npm install
npm test            # 构建测试产物并运行全部用例
npm run typecheck   # 源码类型检查
npm run build       # 生产构建
```

- 测试源码位于 `test/**/*.test.ts`，由 `scripts/test.mjs` 用 esbuild（与生产构建同一工具）打包到 `.test-dist/` 后执行，无需额外的测试依赖。
- 用例分层：
  - 纯逻辑单元测试：`config`、`store`、状态推导 `statusOf`，以及客户端 `format` / `timeline` / `status`。
  - 客户端主流程：`bindSession` 创建会话、发送首条指令并绑定任务；首条指令或会话创建失败时**不落库绑定**，保证任务仍可重新启动。
  - Git 生命周期集成测试（真实临时仓库）：发布（worktree + hash 分支）、绑定、状态推导、验收切换/切回、合并、清理与分支删除。
  - HTTP 端到端：启动真实 host 插件并捕获路由，用带 token 的请求走完 发布 → 绑定 → 提交 → 合并 → 清理 全链路，同时覆盖 403 / 400 / 404 等错误分支。
  - 冒烟测试：`apply()` 能注册全部模型工具和 HTTP 路由，客户端 `factory().apply()` 能注册全部 slot，加载不抛异常。
- 建议在 CI 或提交前执行 `npm test`；新增功能时补充对应用例，尤其覆盖任务发布与执行链路。

## 开发验证

本次版本已实际验证：

- `npm run typecheck`
- `npm run build`
- the agent harness Web 中加载 Worktree 工作台
- 宽屏双栏和窄屏单栏切换
- 工作台搜索过滤、无结果空状态和清除搜索
- 项目概览统计与待处理提示
- 新增项目弹窗：目录选择单次触发、分支必填、加载中禁止提交、历史目录已移除
- 任务详情：任务摘要、实时会话时间线（思考 / 工具调用 / 工具结果 / 助手输出）、验收禁用原因、Worktree/主仓库信息
- 清理 worktree、删除任务记录及确认弹窗
- 分支 Hash 命名：中文标题创建任务实际得到 `dsh-wt/<id8>`
- 中文自定义分支名返回 `400`
- 弹窗焦点、必填校验和 Escape 关闭
- 临时任务创建、清理、分支删除和记录删除

当前已包含自动化测试套件（见上文「自动化测试」），浏览器交互测试用于补充视觉与可访问性验收。

本次结构重构后额外验证：

- `npm run typecheck`
- `npm run build`
- React SSR 渲染冒烟：任务详情、项目详情、设置页、新增项目弹窗、发布任务弹窗、看板页和侧栏图标均通过
- 时间线稳定 key 检查：追加新事件后旧行 ID 不变
- 构建产物 slot 注册检查：`settings.section`、`sidebar.panellist`、`main`
- `dsh web` + 浏览器验证：勾选「创建后立即开始」的发布实际执行首条指令并产生提交；空会话任务显示「启动任务」


## 设计要点

- 验收切换时，如果任务分支已被 worktree 检出，主仓库切换会失败，自动回退 `--ignore-other-worktrees`。
- `checkout`、`merge`、`back` 前拒绝主仓库中已跟踪文件的未提交改动；未跟踪文件不再阻止操作，真实冲突仍由 `git` 拒绝。清理 worktree 时仍统计未跟踪文件。
- `checkout` 会记录 `originalBranch`，供验收后切回。
- worktree 父目录为 `<repo>/.dsh-worktrees/<id8>`，并幂等写入 `.git/info/exclude` 的 `/.dsh-worktrees/`。
- 会话被删除后，host 通过 `session/disposed` 解绑，看板可重新创建会话，不会自动重启旧会话。
- 插件不接管会话内容，Agent 的审批、追问和中止继续均使用 DSH 原生能力。
