# DeepSeek Worktree 任务插件

`@local/dsh-deepseek-worktree` · v0.1.0 · 最后更新：2026-11-07

每个任务对应一个真实的 DSH 会话。发布任务时创建独立的 Git worktree 和任务分支，会话以 worktree 为工作目录出现在左侧工作区。任务对话、审批、追问、中止和继续均使用 DSH 原生能力，工作台负责发布、查看状态和验收。

## 功能概览

- **项目级任务看板**：按项目分组展示任务、运行状态、待审批事项和 Git 状态。
- **真实 worktree 隔离**：每个任务使用 `<repo>/.dsh-worktrees/<id8>`，不污染主仓库工作区。
- **Hash 任务分支**：自动生成 `<branchPrefix><id8>`，例如 `dsh-wt/b92e5f2a`，不把中文标题写进分支名。
- **会话一体化**：任务详情可直接打开已有会话，没有会话时可创建会话。
- **完整验收流程**：切到任务分支、切回原分支、合并、清理 worktree、删除任务记录。
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

## 工作台与交互

- 左侧按项目展示任务树，项目行主体用于选中项目，折叠和新增任务为独立按钮。
- 任务行分为两层：任务标题和状态/提交/改动摘要。
- 任务详情优先展示任务描述、当前状态和主操作，再展示实时会话、Git 信息与危险操作。
- 已有会话显示「打开会话」，未创建会话显示「创建会话」。
- 任务详情和项目设置按 ID 重置状态，避免切换任务或项目后残留表单值、强制清理或删除分支选项。
- 表单字段必须具备可访问名称，必填项显示明确错误。
- 弹窗支持 `aria-modal`、Tab 焦点圈定、Escape 关闭和关闭后焦点恢复。
- 支持 `prefers-reduced-motion`。
- 窄屏下列表/详情切换为单栏，详情页提供「返回项目列表」。

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
POST task/cleanup
POST task/delete
```

- `publish`、`projects/*`、`tasks`、`bind`、`task/*` 需要 `x-dsh-worktree-token`。
- `session` 用于申请工作台 token；`config`、`recents`、`branches` 是本地查询接口。
- `cleanup` 可带 `force`、`deleteBranch`。
- `publish` 未传 `branchName` 时使用 Hash 命名规则。

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
      name: '@local/dsh-deepseek-worktree'
      config:
        dirName: .dsh-worktrees
        branchPrefix: dsh-wt/
        gitPath: git
```

项目级设置可以覆盖 `dirName` 和 `branchPrefix`。

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

在 DSH Web 中通过 Plugins → 安装外部 bundle，源为本地路径：

```text
C:\Users\liang\dsh-worktree
```

未开启 HMR 时，需要重启 DSH 或重新加载页面。

## 开发验证

本次版本已实际验证：

- `npm run typecheck`
- `npm run build`
- DSH Web 中加载 Worktree 工作台
- 宽屏双栏和窄屏单栏切换
- 新增项目弹窗：目录选择单次触发、分支必填、加载中禁止提交、历史目录已移除
- 分支 Hash 命名：中文标题创建任务实际得到 `dsh-wt/<id8>`
- 中文自定义分支名返回 `400`
- 弹窗焦点、必填校验和 Escape 关闭
- 临时任务创建、清理和记录删除

当前未包含自动化测试套件，以上验证以构建检查和真实浏览器交互测试为主。

## 设计要点

- 验收切换时，如果任务分支已被 worktree 检出，主仓库切换会失败，自动回退 `--ignore-other-worktrees`。
- `checkout`、`merge`、`back` 前使用 `status --porcelain` 拒绝脏工作区。
- `checkout` 会记录 `originalBranch`，供验收后切回。
- worktree 父目录为 `<repo>/.dsh-worktrees/<id8>`，并幂等写入 `.git/info/exclude` 的 `/.dsh-worktrees/`。
- 会话被删除后，host 通过 `session/disposed` 解绑，看板可重新创建会话，不会自动重启旧会话。
- 插件不接管会话内容，Agent 的审批、追问和中止继续均使用 DSH 原生能力。
