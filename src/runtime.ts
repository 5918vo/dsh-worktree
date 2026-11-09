/**
 * Task lifecycle: publish (worktree + branch + record), git snapshot
 * aggregation, acceptance actions. Session creation stays on the client
 * (remote.session.create); the host only records the binding.
 */

import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import * as gitx from './gitx.js'
import { DiffFile, MergeBlocker, MergeBlockingFile, MergeConflictInfo, MergePreflight, MergePreview, ModelSelection, PendingStash, Project, ProjectStats, ProjectView, TaskDiff, TaskSnapshot, TaskStatus, TaskView, WorktreeConfig, WorktreeTask } from './models.js'
import { Store } from './store.js'
import { normalizeCriteria } from './criteria.js'

export interface PublishInput {
  projectId?: string
  repoPath?: string
  baseBranch?: string
  title: string
  description: string
  branchName?: string
  start?: boolean
  /** Continue from an already-merged task; the new task records this as its parent. */
  parentId?: string
  /** When continuing: explicitly migrate commits added to the old branch after its merge. */
  carryLeftover?: boolean
  /** Client publishes bind their own session; tools rely on the board retry. */
  autoBind?: boolean
  /** Preferred model for the task session (applied when the session is created). */
  model?: ModelSelection
  /** Optional acceptance criteria, one trimmed line per item. */
  acceptanceCriteria?: string[]
}

export interface AddProjectInput {
  repoPath: string
  name?: string
  baseBranch?: string
  dirName?: string
  branchPrefix?: string
}

/** Options for a workbench merge. */
export interface MergeOptions {
  switchToBase?: boolean
  /** Compatibility alias for restoreAfter. */
  restoreTo?: boolean
  restoreAfter?: boolean
  expectedTip?: string
  expectedBase?: string
  /** How to handle repo changes that block switching: refuse (default) or stash. */
  dirtyStrategy?: 'refuse' | 'stash'
  /** Override the git merge timeout (tests inject a short one). */
  timeoutMs?: number
}

export class TaskError extends Error {
  readonly status: number
  /** Machine-readable reason (e.g. stale/conflict/repoBusy/timeout) for 409 handling. */
  readonly code?: string
  constructor(message: string, status = 400, code?: string) {
    super(message)
    this.name = 'TaskError'
    this.status = status
    if (code) this.code = code
  }
}

/** Files named by git's conflict output, deduplicated. */
function conflictFiles(text: string): string[] {
  const files = new Set<string>()
  for (const match of text.matchAll(/Merge conflict in ([^\r\n]+)/g)) files.add(match[1].trim())
  for (const match of text.matchAll(/CONFLICT \([^)]*\):\s*(.+?)\s+(?:deleted|modified) in/gi)) files.add(match[1].trim())
  return [...files]
}

function id8(id: string): string {
  return id.replace(/-/g, '').slice(0, 8)
}

// Diff payloads travel through the board's JSON API; keep them bounded so a
// task touching a huge generated file cannot stall the review screen.
const DIFF_MAX_FILES = 300
const DIFF_MAX_FILE_CHARS = 60_000
const DIFF_MAX_TOTAL_CHARS = 300_000
const UNTRACKED_READ_BYTES = 256 * 1024

/** Render an untracked file as a synthetic "new file" unified diff. */
async function readUntrackedDiff(dir: string, rel: string): Promise<DiffFile | null> {
  const abs = join(dir, rel)
  let stat
  try {
    stat = await fs.stat(abs)
  } catch {
    return null
  }
  if (!stat.isFile()) return null
  let buf: Buffer
  let truncated = false
  try {
    const len = Math.min(stat.size, UNTRACKED_READ_BYTES)
    truncated = stat.size > len
    const handle = await fs.open(abs, 'r')
    try {
      const out = Buffer.alloc(len)
      await handle.read(out, 0, len, 0)
      buf = out
    } finally {
      await handle.close()
    }
  } catch {
    return null
  }
  const binary = buf.subarray(0, 8000).includes(0)
  if (binary) {
    return {
      path: rel,
      status: 'untracked',
      additions: 0,
      deletions: 0,
      binary: true,
      patch: `diff --git a/${rel} b/${rel}\nnew file mode 100644\nBinary files /dev/null and b/${rel} differ`,
    }
  }
  const text = buf.toString('utf8').replace(/\r\n/g, '\n')
  const lines = text.length ? text.replace(/\n$/, '').split('\n') : []
  const header = `diff --git a/${rel} b/${rel}\nnew file mode 100644\n--- /dev/null\n+++ b/${rel}\n@@ -0,0 +1,${lines.length} @@`
  const body = lines.map((line) => '+' + line).join('\n')
  return {
    path: rel,
    status: 'untracked',
    additions: lines.length,
    deletions: 0,
    binary: false,
    patch: header + (body ? '\n' + body : '') + (truncated ? '\n… (truncated)' : ''),
  }
}

function assertTaskBranchName(name: string): void {
  const valid = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(name)
  if (!valid || name.includes('..') || name.includes('@{') || name.endsWith('/') || name.endsWith('.') || name.endsWith('.lock')) {
    throw new TaskError('任务分支只能使用英文、数字、点、下划线和斜杠')
  }
}

/** Facts about the preceding merged task, folded into a follow-up task's first prompt. */
export interface ParentPromptInfo {
  id: string
  title: string
  branch: string
  mergedCommits: gitx.CommitLine[]
  mergedFiles: string[]
  /** Commits added on the predecessor branch after it was merged (not yet in base). */
  leftoverCommits: gitx.CommitLine[]
  /** `<mergeBase>..<parentBranch>` range for cherry-picking the leftovers, when known. */
  leftoverRange?: string
}

function parentPromptLines(parent: ParentPromptInfo, baseBranch: string): string[] {
  const lines: string[] = []
  lines.push(`前序任务（已合并到 ${baseBranch}）：`)
  lines.push(`- 标题：${parent.title}`)
  lines.push(`- 分支：${parent.branch}`)
  if (parent.mergedCommits.length) {
    lines.push('- 已合并的提交：')
    for (const commit of parent.mergedCommits) lines.push(`  - ${commit.hash} ${commit.subject}`)
  } else {
    lines.push('- 已合并的提交：—')
  }
  lines.push(`- 改动文件：${parent.mergedFiles.length ? parent.mergedFiles.join('、') : '—'}`)
  lines.push('')
  lines.push(`当前 worktree 基于 ${baseBranch} 创建，已包含上述已合并改动。`)
  lines.push('请先阅读相关文件，了解现有实现，再在此基础上完成本次任务；不要重复实现或回退前序改动。')
  if (parent.leftoverCommits.length && parent.leftoverRange) {
    lines.push('')
    lines.push(`注意：前序分支在合并后又有 ${parent.leftoverCommits.length} 个未合并提交，当前 worktree 尚未包含它们：`)
    for (const commit of parent.leftoverCommits) lines.push(`  - ${commit.hash} ${commit.subject}`)
    lines.push('开始开发前，请先把这些提交带入当前分支（在 worktree 内执行）：')
    lines.push(`  git cherry-pick ${parent.leftoverRange}`)
    lines.push('遇到冲突逐个解决；涉及业务取舍时先问我。')
  }
  return lines
}

export function buildFirstPrompt(task: WorktreeTask, parent?: ParentPromptInfo): string {
  const lines = [
    '这是一个 git worktree 任务。',
    '',
    `任务：${task.title}`,
    `描述：${task.description.trim()}`,
    '',
  ]
  if (parent) {
    lines.push(...parentPromptLines(parent, task.baseBranch))
    lines.push('')
  }
  if (task.acceptanceCriteria && task.acceptanceCriteria.length) {
    lines.push('验收标准：')
    for (const item of task.acceptanceCriteria) lines.push(`- ${item}`)
    lines.push('结束前逐条说明是否满足，未满足的说明原因。')
    lines.push('')
  }
  lines.push(
    '环境：',
    `- worktree：${task.worktreePath}`,
    `  分支 ${task.branch}，基于 ${task.baseBranch} ← 所有开发都在这里进行`,
    `- 主仓库：${task.repoPath}（只读，不要修改其中任何文件）`,
    '',
    '开始前：',
    '1. 如果当前目录不是上面的 worktree，用 working_directory 工具切换过去。',
    '2. 运行 git rev-parse --show-toplevel 和 git branch --show-current，',
    '   确认路径和分支正确；不一致时停下并告诉我。',
    '',
    '开发要求：',
    '- 文件读写优先使用 worktree 内的绝对路径。',
    '- 按阶段 commit，提交信息写清楚改了什么、为什么改。',
    '- 不要切换分支、rebase、push、fetch/pull，不要删除 worktree；',
    `  验收和合并回 ${task.baseBranch} 由工作台完成。`,
    `- 不要主动同步基线。即使发现 ${task.baseBranch} 有新提交，也只在总结里说明。`,
    '- 遇到需求不明确或需要取舍时，直接问我。',
    '',
    '同步基线（仅在我明确要求时执行）：',
    `- 在 worktree 内执行 git merge ${task.baseBranch}（使用本地分支，不 rebase）。`,
    '- 有冲突时逐个解决；如果涉及业务取舍，先列出冲突并问我。',
    '- 解决后运行验证（例如 npm run typecheck / npm run build），通过后再提交合并。',
    '- 如果无法完成，执行 git merge --abort 恢复原状，并说明原因。',
    '',
    '完成后总结：',
    '- 改动的文件和要点',
    '- 提交列表',
    '- 运行过的验证及结果',
    '- 如果同步过基线：同步到的基线提交、冲突文件及解决方式',
    '- 没验证的部分和遗留风险',
  )
  return lines.join('\n')
}

export interface SwitchObstacle {
  path: string
  kind: 'tracked' | 'untracked'
}

/** Result of pre-checking whether the main repo can switch to a target commit. */
export interface SwitchPreflight {
  currentRef: string | null
  currentSha: string | null
  targetRef: string
  targetSha: string | null
  dirty: boolean
  safe: boolean
  obstacles: SwitchObstacle[]
}

export type SwitchStrategy = 'abort' | 'stash' | 'discard'

export class Runtime {
  private readonly store: Store
  private readonly config: WorktreeConfig
  readonly gitPath: string
  /** One in-flight git action per main repo, shared by chat/board/tool callers. */
  private readonly gitOps = new Map<string, string>()
  /** Transient (non-persisted) warnings for the next action response, e.g. restore-failed. */
  private readonly opWarnings = new Map<string, string>()
  /** Transient partial-success markers (200 but not fully done), e.g. restore-failed. */
  private readonly partials = new Map<string, { restoreFailed: boolean; reason: string }>()
  /** Reuse a merge preview while both tips are unchanged (and skip while the repo is locked). */
  private readonly previewCache = new Map<string, { tip: string | null; base: string | null; at: number; result: MergePreview }>()
  private envInfo: { gitVersion: string | null; mergeTreeSupported: boolean; longPaths: boolean | null } | null = null
  /** Probe a task session's run state ('idle' when no session concept exists). */
  private readonly sessionState: (sessionId: string) => 'running' | 'idle' | 'unknown'

  constructor(deps: { store: Store; config: WorktreeConfig; sessionState?: (sessionId: string) => 'running' | 'idle' | 'unknown' }) {
    this.store = deps.store
    this.config = deps.config
    this.gitPath = deps.config.gitPath
    this.sessionState = deps.sessionState || (() => 'idle')
  }

  /** Cached Git capability info for a startup banner (merge-tree support, long paths). */
  async environment(): Promise<{ gitVersion: string | null; mergeTreeSupported: boolean; longPaths: boolean | null }> {
    if (!this.envInfo) {
      const v = await gitx.gitVersion(this.gitPath)
      let longPaths: boolean | null = true
      if (process.platform === 'win32') {
        try {
          const values = await gitx.gitConfigGetAll(this.gitPath, process.cwd(), 'core.longpaths')
          longPaths = values.length ? values.some((x) => x.toLowerCase() === 'true') : null
        } catch {
          longPaths = null
        }
      }
      this.envInfo = v
        ? { gitVersion: v.version, mergeTreeSupported: v.mergeTreeSupported, longPaths }
        : { gitVersion: null, mergeTreeSupported: true, longPaths }
    }
    return this.envInfo
  }

  /** Read and clear the one-shot warning left by the last mutating action. */
  takeWarning(id: string): string | undefined {
    const warning = this.opWarnings.get(id)
    if (warning) this.opWarnings.delete(id)
    return warning
  }

  /** Read and clear the one-shot partial-success marker for the last merge. */
  takePartial(id: string): { restoreFailed: boolean; reason: string } | undefined {
    const partial = this.partials.get(id)
    if (partial) this.partials.delete(id)
    return partial
  }

  private abs(p: string): string {
    const expanded = p.startsWith('~') ? join(process.env.USERPROFILE || process.env.HOME || '.', p.slice(1)) : p
    return isAbsolute(expanded) ? expanded : resolve(expanded)
  }

  async repoInfo(dir: string): Promise<{ current: string | null; default: string | null }> {
    if (!(await gitx.isRepo(this.gitPath, dir))) {
      throw new TaskError(`目录不是 git 仓库工作区：${dir}`)
    }
    const { current, default: def } = await gitx.listBranches(this.gitPath, dir)
    return { current, default: def }
  }

  async branches(dir: string): Promise<{ branches: Array<{ name: string; current: boolean }>; current: string | null; default: string | null }> {
    const d = this.abs(dir)
    if (!(await gitx.isRepo(this.gitPath, d))) {
      throw new TaskError(`目录不是 git 仓库工作区：${d}`)
    }
    return gitx.listBranches(this.gitPath, d)
  }

  /** Effective per-project worktree knobs (project override > global config). */
  effective(project: Project | undefined) {
    return {
      dirName: project?.dirName?.trim() || this.config.dirName,
      branchPrefix: project?.branchPrefix?.trim() || this.config.branchPrefix,
    }
  }

  // ---- projects ----

  async addProject(input: AddProjectInput): Promise<Project> {
    const repoPath = this.abs(input.repoPath)
    if (!(await gitx.isRepo(this.gitPath, repoPath))) {
      throw new TaskError(`目标目录不是 git 仓库工作区：${repoPath}`)
    }
    const existing = this.store.findProjectByRepo(repoPath)
    if (existing) return existing
    const { current, default: defaultBranch } = await gitx.listBranches(this.gitPath, repoPath)
    const base = (input.baseBranch || current || defaultBranch || '').trim()
    const project: Project = {
      id: randomUUID(),
      name: (input.name || basename(repoPath) || 'project').trim(),
      repoPath,
      baseBranch: base,
      ...(input.dirName?.trim() ? { dirName: input.dirName.trim() } : {}),
      ...(input.branchPrefix?.trim() ? { branchPrefix: input.branchPrefix.trim() } : {}),
      createdAt: Date.now(),
    }
    this.store.putProject(project)
    this.store.addRecent(repoPath)
    return project
  }

  updateProject(id: string, patch: { name?: string; baseBranch?: string; dirName?: string; branchPrefix?: string }): Project {
    const project = this.store.getProject(id)
    if (!project) throw new TaskError(`项目不存在：${id}`, 404)
    if (typeof patch.name === 'string' && patch.name.trim()) project.name = patch.name.trim()
    if (typeof patch.baseBranch === 'string' && patch.baseBranch.trim()) {
      const b = patch.baseBranch.trim()
      if (!gitx.branchExists(this.gitPath, project.repoPath, b)) throw new TaskError(`基线分支不存在：${b}`)
      project.baseBranch = b
    }
    if (typeof patch.dirName === 'string') project.dirName = patch.dirName.trim() || undefined
    if (typeof patch.branchPrefix === 'string') project.branchPrefix = patch.branchPrefix.trim() || undefined
    this.store.putProject(project)
    return project
  }

  /** Global, reusable acceptance-criteria library. */
  listAcceptanceCriteria(): string[] {
    return this.store.listCriteria()
  }

  addAcceptanceCriteria(values: string[]): string[] {
    return this.store.addCriteria(normalizeCriteria(values))
  }

  removeAcceptanceCriterion(text: string): string[] {
    return this.store.removeCriterion(String(text || '').trim())
  }

  setAcceptanceCriteria(values: string[]): string[] {
    return this.store.setCriteria(normalizeCriteria(values))
  }

  /**
   * Remove one task's worktree directory from disk. Returns true when something
   * was actually removed. Missing paths are skipped; when git refuses (stale
   * registration, missing main repo) fall back to a plain directory removal and
   * prune the leftover administrative metadata.
   */
  private async removeWorktreeDir(task: WorktreeTask): Promise<boolean> {
    const exists = await fs.stat(task.worktreePath).then((s) => s.isDirectory()).catch(() => false)
    if (!exists) return false
    try {
      await gitx.worktreeRemove(this.gitPath, task.repoPath, task.worktreePath, true)
      return true
    } catch {
      /* fall through to a direct filesystem removal */
    }
    await fs.rm(task.worktreePath, { recursive: true, force: true })
    await gitx.worktreePrune(this.gitPath, task.repoPath)
    return true
  }

  async deleteProject(id: string, opts: { withTasks?: boolean; withWorktrees?: boolean }): Promise<{ deletedTasks: number; deletedWorktrees: number }> {
    const project = this.store.getProject(id)
    if (!project) throw new TaskError(`项目不存在：${id}`, 404)
    const tasks = this.store.listTasksOfProject(id)
    if (tasks.length > 0 && !opts.withTasks) {
      throw new TaskError(`项目下还有 ${tasks.length} 个任务；勾选「连同任务删除」后重试`)
    }
    let deletedWorktrees = 0
    for (const t of tasks) {
      if ((await this.snapshot(t)).status === 'reviewing') {
        throw new TaskError(`任务「${t.title}」正在验收中，请先切回原分支再删除项目`, 409)
      }
      if ((t.pendingStashes || []).length) {
        throw new TaskError(`任务「${t.title}」还有未处理的暂存，请先恢复或丢弃再删除项目`, 409, 'pending-stash')
      }
    }
    if (opts.withWorktrees) {
      for (const t of tasks) {
        if (await this.removeWorktreeDir(t)) deletedWorktrees += 1
      }
      // Best-effort: drop the (now empty) shared worktree container so the
      // project's folder does not linger on disk.
      for (const parent of new Set(tasks.map((t) => dirname(t.worktreePath)))) {
        try {
          if ((await fs.readdir(parent)).length === 0) await fs.rmdir(parent)
        } catch {
          /* missing or non-empty: leave it alone */
        }
      }
    }
    for (const t of tasks) this.store.deleteTask(t.id)
    this.store.deleteProject(id)
    return { deletedTasks: tasks.length, deletedWorktrees }
  }

  /** Resolve the owning project for a publish: explicit id, repo match, or create. */
  private async ensureProject(input: PublishInput): Promise<Project> {
    if (input.projectId) {
      const project = this.store.getProject(input.projectId)
      if (!project) throw new TaskError(`项目不存在：${input.projectId}`, 404)
      return project
    }
    const repoPath = this.abs(input.repoPath || '')
    if (!input.repoPath) throw new TaskError('缺少 projectId 或 repoPath')
    const found = this.store.findProjectByRepo(repoPath)
    if (found) return found
    return this.addProject({ repoPath })
  }

  /**
   * Aggregate the board's left column: every project with its task views.
   * Archived tasks are filtered out by default; pass `includeArchived` for the
   * board's "show archived" toggle.
   */
  async projectViews(opts: { includeArchived?: boolean } = {}): Promise<ProjectView[]> {
    const views = await this.views({ includeArchived: opts.includeArchived })
    const byId = new Map<string, ProjectView>()
    const orphans: TaskView[] = []
    for (const p of this.store.listProjects()) {
      byId.set(p.id, { project: p, stats: { tasks: 0, byStatus: {}, running: 0 }, tasks: [] })
    }
    for (const v of views) {
      let bucket = v.task.projectId ? byId.get(v.task.projectId) : undefined
      if (bucket) bucket.tasks.push(v)
      else orphans.push(v)
    }
    // Legacy tasks without a project: group them under a synthetic row per repo.
    for (const v of orphans) {
      const key = 'repo:' + v.task.repoPath.toLowerCase()
      let bucket = byId.get(key)
      if (!bucket) {
        const synth: Project = {
          id: key,
          name: basename(v.task.repoPath) || v.task.repoPath,
          repoPath: v.task.repoPath,
          baseBranch: v.task.baseBranch,
          createdAt: v.task.createdAt,
        }
        bucket = { project: synth, stats: { tasks: 0, byStatus: {}, running: 0 }, tasks: [] }
        byId.set(key, bucket)
      }
      bucket.tasks.push(v)
    }
    const out = [...byId.values()]
    for (const b of out) {
      b.tasks.sort((x, y) => y.task.createdAt - x.task.createdAt)
      b.stats.tasks = b.tasks.length
      for (const v of b.tasks) {
        const s = v.snapshot.status
        b.stats.byStatus[s] = (b.stats.byStatus[s] || 0) + 1
      }
      b.stats.running = b.tasks.filter((v) => v.snapshot.status === 'developing').length
    }
    return out.sort((a, b) => a.project.name.localeCompare(b.project.name))
  }

  /**
   * Validate that a predecessor task's merged changes really are in `base`.
   * Returns the resolved parent plus the facts the follow-up prompt needs.
   */
  private async loadContinuableParent(parentId: string, repoPath: string, base: string): Promise<{ parent: WorktreeTask; info: ParentPromptInfo }> {
    const parent = this.store.getTask(parentId)
    if (!parent) throw new TaskError(`前序任务不存在：${parentId}`, 404)
    const norm = (p: string) => p.replace(/[\\/]+$/, '').toLowerCase()
    if (norm(parent.repoPath) !== norm(repoPath)) {
      throw new TaskError('前序任务属于其他仓库，不能作为续作发布')
    }
    if (!parent.mergedAt) {
      throw new TaskError('前序任务尚未合并，无法作为续作发布；请先合并前序任务')
    }
    // Prefer the branch tip that was actually merged: it stays an ancestor of base
    // even after newer commits land on the old branch.
    const ref = parent.mergedBranchTip || parent.branch
    if (!(await gitx.isAncestor(this.gitPath, repoPath, ref, base))) {
      throw new TaskError(`所选基线 ${base} 未包含前序任务已合并的成果。请改选原合并目标 ${parent.baseBranch}，或改为普通任务发布。`)
    }
    return { parent, info: await this.parentPromptInfo(parent, base) }
  }

  /** Best-effort facts about a merged task: what it merged, and what came after. */
  private async parentPromptInfo(parent: WorktreeTask, base: string): Promise<ParentPromptInfo> {
    const repo = parent.repoPath
    let mergedCommits: gitx.CommitLine[] = []
    let mergedFiles: string[] = []
    if (parent.mergedCommit && parent.mergedBranchTip) {
      mergedCommits = await gitx.logOneline(this.gitPath, repo, `${parent.mergedCommit}^1..${parent.mergedBranchTip}`, 30)
      mergedFiles = await gitx.diffNameOnly(this.gitPath, repo, `${parent.mergedCommit}^1`, parent.mergedBranchTip)
    } else if (await gitx.branchExists(this.gitPath, repo, parent.branch)) {
      mergedCommits = await gitx.logOneline(this.gitPath, repo, parent.branch, 20)
      mergedFiles = await gitx.diffNameOnly(this.gitPath, repo, base, parent.branch)
    }
    let leftoverCommits: gitx.CommitLine[] = []
    let leftoverRange: string | undefined
    if (await gitx.branchExists(this.gitPath, repo, parent.branch)) {
      const mb = await gitx.mergeBase(this.gitPath, repo, base, parent.branch)
      if (mb) {
        leftoverCommits = await gitx.logOneline(this.gitPath, repo, `${mb}..${parent.branch}`, 20)
        if (leftoverCommits.length) leftoverRange = `${mb}..${parent.branch}`
      }
    }
    return { id: parent.id, title: parent.title, branch: parent.branch, mergedCommits, mergedFiles, leftoverCommits, leftoverRange }
  }

  async publish(input: PublishInput): Promise<WorktreeTask> {
    if (!input.title?.trim()) throw new TaskError('任务标题不能为空')
    if (!input.description?.trim()) throw new TaskError('任务描述不能为空')
    const model = input.model === undefined ? undefined : normalizeModelSelection(input.model)
    if (input.model !== undefined && model === undefined) throw new TaskError('模型选择无效')
    const acceptanceCriteria = normalizeCriteria(input.acceptanceCriteria || [])

    const project = await this.ensureProject(input)
    const repoPath = project.repoPath
    if (!(await gitx.isRepo(this.gitPath, repoPath))) {
      throw new TaskError(`目标目录不是 git 仓库工作区：${repoPath}`)
    }

    const { current, default: defaultBranch } = await gitx.listBranches(this.gitPath, repoPath)
    // When continuing, the baseline defaults to the predecessor's actual merge
    // target (never the current project default, which may have moved on).
    const parentRecord = input.parentId ? this.store.getTask(input.parentId) : undefined
    if (input.parentId && !parentRecord) throw new TaskError(`前序任务不存在：${input.parentId}`, 404)
    const base = (input.baseBranch || (parentRecord && parentRecord.baseBranch) || project.baseBranch || current || defaultBranch || '').trim()
    if (!base || !(await gitx.branchExists(this.gitPath, repoPath, base))) {
      throw new TaskError(`基线分支不存在：${base || '(未指定)'}`)
    }

    let parentInfo: ParentPromptInfo | undefined
    let parentId: string | undefined
    if (input.parentId) {
      const loaded = await this.loadContinuableParent(input.parentId, repoPath, base)
      parentInfo = loaded.info
      parentId = loaded.parent.id
      if (!input.carryLeftover) {
        // Default: continue from what was merged; do not silently migrate newer commits.
        parentInfo.leftoverCommits = []
        parentInfo.leftoverRange = undefined
      }
    }

    const eff = this.effective(project)
    const id = randomUUID()
    const short = id8(id)
    const wanted = (input.branchName?.trim() || `${eff.branchPrefix}${short}`).trim()
    assertTaskBranchName(wanted)
    const branch = await gitx.uniqueBranchName(this.gitPath, repoPath, wanted)
    const worktreePath = join(repoPath, eff.dirName, short)

    await gitx.worktreeAdd(this.gitPath, repoPath, worktreePath, branch, base)
    await gitx.ensureExclude(this.gitPath, repoPath, eff.dirName)

    const now = Date.now()
    const task: WorktreeTask = {
      id,
      projectId: project.id,
      title: input.title.trim(),
      description: input.description,
      repoPath,
      baseBranch: base,
      branch,
      worktreePath,
      sessionId: null,
      firstPrompt: '',
      startOnBind: input.start !== false && input.autoBind !== false,
      ...(model ? { model } : {}),
      ...(acceptanceCriteria.length ? { acceptanceCriteria } : {}),
      ...(parentId ? { parentId } : {}),
      createdAt: now,
      updatedAt: now,
    }
    task.firstPrompt = buildFirstPrompt(task, parentInfo)
    this.store.putTask(task)
    this.store.addRecent(repoPath)
    return task
  }

  async snapshot(task: WorktreeTask): Promise<TaskSnapshot> {
    const snap: TaskSnapshot = {
      worktree: { exists: false, branch: null, dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
      repo: { exists: false, currentBranch: null, dirtyCount: 0 },
      branchExists: false,
      merged: false,
      status: 'broken',
    }
    try {
      const [repoIsRepo, wtStat] = await Promise.all([
        gitx.isRepo(this.gitPath, task.repoPath),
        fs.stat(task.worktreePath).then((s) => s.isDirectory()).catch(() => false),
      ])
      snap.repo.exists = repoIsRepo
      snap.worktree.exists = wtStat
      snap.branchExists = repoIsRepo ? await gitx.branchExists(this.gitPath, task.repoPath, task.branch) : false
      // Reviewing an older commit than the branch tip: surface how far behind.
      if (task.reviewSha && snap.branchExists) {
        const branchTip = await gitx.revParse(this.gitPath, task.repoPath, task.branch)
        if (branchTip && branchTip !== task.reviewSha) {
          snap.reviewBehind = await gitx.countCommits(this.gitPath, task.repoPath, `${task.reviewSha}..${task.branch}`)
        }
      }

      if (repoIsRepo) {
        const [cur, headSha, dirty] = await Promise.all([
          gitx.currentBranch(this.gitPath, task.repoPath),
          gitx.revParse(this.gitPath, task.repoPath, 'HEAD'),
          // Untracked files in the main repo do not belong to the task branch and
          // must not block checkout or merge. Tracked edits still do.
          gitx.isDirty(this.gitPath, task.repoPath, false),
        ])
        snap.repo.currentBranch = cur
        snap.repo.headSha = headSha
        snap.repo.dirtyCount = dirty
        snap.repo.inProgress = await gitx.inProgress(this.gitPath, task.repoPath)
        if (task.originalBranch) {
          snap.repo.originalBranchExists = await gitx.branchExists(this.gitPath, task.repoPath, task.originalBranch)
        }
        if (cur && snap.branchExists) {
          // Merged means the branch tip is an ancestor of base AND the branch
          // actually diverged (a freshly created branch points at base itself).
          const [anc, same] = await Promise.all([
            gitx.isAncestor(this.gitPath, task.repoPath, task.branch, task.baseBranch),
            gitx.sameCommit(this.gitPath, task.repoPath, task.branch, task.baseBranch),
          ])
          if (anc && !same) {
            if (task.mergedAt) {
              snap.merged = true
            } else {
              // A branch that only points at an older base commit is behind,
              // not merged. A merged branch has a task commit newer than the
              // task record.
              const tipTime = await gitx.commitTime(this.gitPath, task.repoPath, task.branch)
              snap.merged = tipTime !== null && tipTime * 1000 > (task.createdAt || 0)
            }
          } else if (!anc && task.mergedAt) {
            // Merged through the workbench, but newer commits landed on the old
            // branch afterwards. Keep the task `merged` and count those patches.
            const aheadOfBase = await gitx.countCommits(this.gitPath, task.repoPath, `${task.baseBranch}..${task.branch}`)
            if (aheadOfBase > 0) {
              snap.merged = true
              snap.postMergeAhead = aheadOfBase
            }
          }
        }
      }

      if (wtStat) {
        const [wtBranch, wtDirty, ahead, commits, lastAt] = await Promise.all([
          gitx.currentBranch(this.gitPath, task.worktreePath),
          gitx.isDirty(this.gitPath, task.worktreePath),
          gitx.countCommits(this.gitPath, task.worktreePath, `${task.baseBranch}..HEAD`),
          gitx.logOneline(this.gitPath, task.worktreePath, `${task.baseBranch}..HEAD`, 20),
          gitx.lastCommitTime(this.gitPath, task.worktreePath),
        ])
        snap.worktree.branch = wtBranch
        snap.worktree.dirtyCount = wtDirty
        snap.worktree.ahead = ahead
        snap.worktree.commits = commits
        snap.worktree.lastCommitAt = lastAt
      }

      snap.status = this.statusOf(task, snap)
    } catch (error) {
      snap.status = 'broken'
      snap.error = error instanceof Error ? error.message : String(error)
    }
    return snap
  }

  /**
   * Git state is the source of truth; the record only carries metadata.
   * Precedence: cleaned → broken → merged → reviewing → developing/review/ready.
   */
  statusOf(task: WorktreeTask, snap: TaskSnapshot): TaskStatus {
    if (task.cleanedAt) return 'cleaned'
    if (snap.error) return 'broken'
    if (snap.merged) return 'merged'
    // Detached acceptance: HEAD equals the recorded review sha. The legacy
    // branch check keeps old task rows (pre reviewSha) working.
    if (task.reviewSha && snap.repo.headSha === task.reviewSha) return 'reviewing'
    if (snap.repo.currentBranch && snap.repo.currentBranch === task.branch) return 'reviewing'
    if (snap.worktree.exists && (snap.worktree.ahead > 0 || snap.worktree.dirtyCount > 0)) return 'review'
    if (task.sessionId) return 'developing'
    return 'ready'
  }

  async view(task: WorktreeTask): Promise<TaskView> {
    return { task, snapshot: await this.snapshot(task) }
  }

  /**
   * Every task as a view. Archived tasks are hidden by default so tools and the
   * board stay focused; the board requests them explicitly to offer "show
   * archived" and to keep an already-selected archived task resolvable.
   */
  async views(opts: { includeArchived?: boolean } = {}): Promise<TaskView[]> {
    const tasks = this.store.listTasks().filter((t) => opts.includeArchived || !t.archivedAt)
    return Promise.all(tasks.map((t) => this.view(t)))
  }

  /**
   * The task's changes against its base branch, as per-file unified diffs.
   * Reads the worktree when it still exists so uncommitted and untracked files
   * show up; falls back to the recorded branch (committed changes only) after
   * the worktree is gone.
   */
  async diff(id: string): Promise<TaskDiff> {
    const task = this.needTask(id)
    const result: TaskDiff = { base: task.baseBranch, mergeBase: null, files: [], totalAdditions: 0, totalDeletions: 0, truncated: false }
    try {
      const wtExists = await fs.stat(task.worktreePath).then((s) => s.isDirectory()).catch(() => false)
      let dir: string
      let toRef: string | undefined
      let includeUntracked = false
      if (wtExists) {
        dir = task.worktreePath
        includeUntracked = true
      } else if (await gitx.branchExists(this.gitPath, task.repoPath, task.branch)) {
        dir = task.repoPath
        toRef = task.branch
      } else {
        result.reason = 'worktree-missing'
        return result
      }

      const mb = await gitx.mergeBase(this.gitPath, dir, task.baseBranch, toRef ?? 'HEAD')
      if (!mb) {
        result.reason = 'no-merge-base'
        return result
      }
      result.mergeBase = mb

      const raw = await gitx.diffFiles(this.gitPath, dir, mb, toRef)
      let files: DiffFile[] = raw.map((file) => ({ ...file }))
      if (includeUntracked) {
        for (const rel of await gitx.listUntracked(this.gitPath, dir)) {
          const file = await readUntrackedDiff(dir, rel)
          if (file) files.push(file)
        }
      }
      files.sort((a, b) => a.path.localeCompare(b.path))

      if (files.length > DIFF_MAX_FILES) {
        files = files.slice(0, DIFF_MAX_FILES)
        result.truncated = true
      }
      let budget = DIFF_MAX_TOTAL_CHARS
      for (const file of files) {
        let patch = file.patch
        if (patch.length > DIFF_MAX_FILE_CHARS) {
          patch = patch.slice(0, DIFF_MAX_FILE_CHARS)
          result.truncated = true
        }
        if (patch.length > budget) {
          patch = patch.slice(0, budget)
          result.truncated = true
        }
        if (patch.length < file.patch.length) patch = patch + '\n… (truncated)'
        file.patch = patch
        budget = Math.max(0, budget - patch.length)
        result.totalAdditions += file.additions
        result.totalDeletions += file.deletions
      }
      result.files = files
    } catch (error) {
      result.reason = 'error'
      result.error = error instanceof Error ? error.message : String(error)
    }
    return result
  }

  private needTask(id: string): WorktreeTask {
    const task = this.store.getTask(id)
    if (!task) throw new TaskError(`任务不存在：${id}`, 404)
    return task
  }

  /** Changed-file count plus a short, human-readable sample. */
  private async dirtySummary(dir: string, includeUntracked = true): Promise<{ count: number; shown: string }> {
    const files = await gitx.dirtyFiles(this.gitPath, dir, includeUntracked)
    return { count: files.length, shown: files.slice(0, 5).join('、') + (files.length > 5 ? '…' : '') }
  }

  private async refuseDirty(dir: string, what: string, includeUntracked = true): Promise<void> {
    const { count, shown } = await this.dirtySummary(dir, includeUntracked)
    if (count > 0) throw new TaskError(`${what}有 ${count} 处未提交改动（${shown}），请先处理后再操作`)
  }

  /** Another task of the same repo currently occupying the main repo (branch or detached review). */
  private otherReviewingTask(task: WorktreeTask, cur: string | null, headSha?: string | null): WorktreeTask | null {
    const norm = (p: string) => p.replace(/[\\/]+$/, '').toLowerCase()
    return (
      this.store
        .listTasks()
        .find(
          (t) =>
            t.id !== task.id &&
            !t.cleanedAt &&
            norm(t.repoPath) === norm(task.repoPath) &&
            ((!!cur && t.branch === cur) || (!!headSha && !!t.reviewSha && t.reviewSha === headSha)),
        ) || null
    )
  }

  private async assertRepoClean(repoPath: string): Promise<void> {
    const { count, shown } = await this.dirtySummary(repoPath, false)
    if (count > 0) throw new TaskError(`主仓库有 ${count} 处未提交改动（${shown}），请先处理后再操作`)
  }

  private async assertNoInProgress(repoPath: string): Promise<void> {
    const state = await gitx.inProgress(this.gitPath, repoPath)
    if (state) throw new TaskError(`主仓库有未完成的 ${state} 操作，请先处理后再继续`)
  }

  /**
   * Refuse a mutating action while the task's agent session is running; an
   * unknown state also refuses (never mutate what we cannot observe).
   */
  private assertAgentIdle(task: WorktreeTask): void {
    if (!task.sessionId) return
    const state = this.sessionState(task.sessionId)
    if (state === 'running') throw new TaskError('Agent 正在运行，请等待其完成后再操作', 409, 'agent-running')
    if (state === 'unknown') throw new TaskError('无法确认 Agent 运行状态，已阻止该操作；请稍后重试', 409, 'agent-unknown')
  }

  private repoKey(repoPath: string): string {
    return repoPath.replace(/[\\/]+$/, '').toLowerCase()
  }

  /** Stable identity of a repo (git common dir realpath) used to prove journal ownership. */
  private async repoIdentity(repoPath: string): Promise<string> {
    const common = await gitx.gitCommonDir(this.gitPath, repoPath).catch(() => null)
    const base = common || repoPath
    try {
      return (await fs.realpath(base)).replace(/[\\/]+$/, '').toLowerCase()
    } catch {
      return base.replace(/[\\/]+$/, '').toLowerCase()
    }
  }

  /** Append a recorded stash to the task (caller persists). */
  private addPendingStash(task: WorktreeTask, entry: { sha: string; source: 'review' | 'merge'; ref: string; createdAt: number; files: string[]; unverified?: boolean }): void {
    const list = Array.isArray(task.pendingStashes) ? task.pendingStashes : []
    list.push(entry)
    task.pendingStashes = list
  }

  /**
   * Serialize git-mutating actions per main repo. A slow hook (e.g. eslint in a
   * pre-merge-commit hook) can keep `merge` running for minutes; without this a
   * second click would start a concurrent merge on the same repo and corrupt the
   * working tree. Keyed by the main repo, so worktrees of one project stay serial.
   */
  private async withRepoLock<T>(repoPath: string, label: string, fn: () => Promise<T>): Promise<T> {
    const key = this.repoKey(repoPath)
    const active = this.gitOps.get(key)
    if (active) throw new TaskError(`主仓库正在执行「${active}」，请等待完成后再操作`, 409, 'repo-busy')
    this.gitOps.set(key, label)
    try {
      return await fn()
    } finally {
      if (this.gitOps.get(key) === label) this.gitOps.delete(key)
    }
  }

  /**
   * Which working-tree files would block `git checkout <targetSha>`?
   * Refreshes the index first so CRLF/mtime-only noise does not count as dirty.
   */
  private async buildSwitchPreflight(repoPath: string, targetSha: string | null): Promise<SwitchPreflight> {
    await gitx.updateIndexRefresh(this.gitPath, repoPath)
    const [currentRef, currentSha] = await Promise.all([
      gitx.currentBranch(this.gitPath, repoPath),
      gitx.revParse(this.gitPath, repoPath, 'HEAD'),
    ])
    const entries = await gitx.statusEntries(this.gitPath, repoPath, true)
    const changed = targetSha && currentSha ? new Set(await gitx.diffNameOnlyZ(this.gitPath, repoPath, currentSha, targetSha)) : new Set<string>()
    const targetTree = targetSha ? await gitx.lsTreePaths(this.gitPath, repoPath, targetSha) : new Set<string>()
    const obstacles: SwitchObstacle[] = []
    for (const entry of entries) {
      if (entry.untracked) {
        if (targetTree.has(entry.path)) obstacles.push({ path: entry.path, kind: 'untracked' })
      } else if (changed.has(entry.path)) {
        obstacles.push({ path: entry.path, kind: 'tracked' })
      }
    }
    return {
      currentRef,
      currentSha,
      targetRef: '',
      targetSha,
      dirty: entries.length > 0,
      safe: obstacles.length === 0,
      obstacles,
    }
  }

  /** Apply the user's choice when switching with dirty files; returns a stash message when stashed. */
  private async applySwitchStrategy(task: WorktreeTask, repoPath: string, pre: SwitchPreflight, strategy?: SwitchStrategy): Promise<{ sha: string; ref: string } | undefined> {
    if (pre.safe) return undefined
    const list = pre.obstacles.map((o) => o.path).slice(0, 12).join('、')
    if (!strategy || strategy === 'abort') {
      throw new TaskError(`主仓库有 ${pre.obstacles.length} 个改动会阻止切换：${list}。请选择「暂存后切换」或「放弃改动后切换」`, 409)
    }
    if (strategy === 'stash') {
      const ref = `dsh-wt:${id8(task.id)}:review:${Date.now()}`
      const sha = await gitx.stashPushSha(this.gitPath, repoPath, ref)
      return { sha, ref }
    }
    // discard
    const tracked = pre.obstacles.filter((o) => o.kind === 'tracked').map((o) => o.path)
    if (tracked.length) await gitx.restorePaths(this.gitPath, repoPath, tracked)
    for (const item of pre.obstacles.filter((o) => o.kind === 'untracked')) {
      await fs.rm(join(repoPath, item.path), { recursive: true, force: true })
    }
    return undefined
  }

  /** Resolve where `back` should return to: original ref → original sha → base. */
  private async resolveBackTarget(task: WorktreeTask): Promise<{ ref?: string; sha?: string }> {
    if (task.reviewOriginalRef && (await gitx.branchExists(this.gitPath, task.repoPath, task.reviewOriginalRef))) {
      return { ref: task.reviewOriginalRef }
    }
    if (task.reviewOriginalSha && (await gitx.revParse(this.gitPath, task.repoPath, task.reviewOriginalSha))) {
      return { sha: task.reviewOriginalSha }
    }
    if (task.originalBranch && (await gitx.branchExists(this.gitPath, task.repoPath, task.originalBranch))) {
      return { ref: task.originalBranch }
    }
    if (await gitx.branchExists(this.gitPath, task.repoPath, task.baseBranch)) return { ref: task.baseBranch }
    return {}
  }

  async checkoutPreflight(id: string): Promise<SwitchPreflight> {
    const task = this.needTask(id)
    if (task.cleanedAt) throw new TaskError('worktree 已清理，无法验收切换')
    if (!(await gitx.branchExists(this.gitPath, task.repoPath, task.branch))) throw new TaskError(`任务分支不存在：${task.branch}`)
    const targetSha = await gitx.revParse(this.gitPath, task.repoPath, task.branch)
    if (!targetSha) throw new TaskError(`无法解析任务分支：${task.branch}`)
    const pre = await this.buildSwitchPreflight(task.repoPath, targetSha)
    pre.targetRef = task.branch
    return pre
  }

  async backPreflight(id: string): Promise<SwitchPreflight> {
    const task = this.needTask(id)
    const target = await this.resolveBackTarget(task)
    const targetSha = target.ref ? await gitx.revParse(this.gitPath, task.repoPath, target.ref) : target.sha || null
    const pre = await this.buildSwitchPreflight(task.repoPath, targetSha)
    pre.targetRef = target.ref || target.sha || ''
    return pre
  }

  async checkout(id: string, opts: { strategy?: SwitchStrategy; expectedSha?: string } = {}): Promise<WorktreeTask> {
    const task = this.needTask(id)
    return this.withRepoLock(task.repoPath, '验收切换', () => this.checkoutLocked(task, opts))
  }

  private async checkoutLocked(task: WorktreeTask, opts: { strategy?: SwitchStrategy; expectedSha?: string } = {}): Promise<WorktreeTask> {
    if (task.cleanedAt) throw new TaskError('worktree 已清理，无法验收切换')
    this.assertAgentIdle(task)
    const repoPath = task.repoPath
    await this.assertNoInProgress(repoPath)
    if (!(await gitx.branchExists(this.gitPath, repoPath, task.branch))) {
      throw new TaskError(`任务分支不存在：${task.branch}`)
    }
    const headSha = await gitx.revParse(this.gitPath, repoPath, 'HEAD')
    if (task.reviewSha && headSha === task.reviewSha) return task
    // Acceptance reviews committed work; uncommitted worktree edits would not be visible.
    const ahead = await gitx.countCommits(this.gitPath, repoPath, `${task.baseBranch}..${task.branch}`)
    if (ahead === 0) {
      const dirty = await this.dirtySummary(task.worktreePath)
      if (dirty.count > 0) throw new TaskError(`worktree 有 ${dirty.count} 处未提交改动（${dirty.shown}），请先让 Agent 提交后再验收`)
      throw new TaskError('还没有可验收的提交')
    }
    const wtDirty = await this.dirtySummary(task.worktreePath)
    if (wtDirty.count > 0) throw new TaskError(`worktree 有 ${wtDirty.count} 处未提交改动（${wtDirty.shown}），请先让 Agent 提交后再验收`)
    const reviewSha = await gitx.revParse(this.gitPath, repoPath, task.branch)
    if (!reviewSha) throw new TaskError(`无法解析任务分支：${task.branch}`)
    if (opts.expectedSha && opts.expectedSha !== reviewSha) throw new TaskError('任务分支已变化，请重新预检', 409)
    const originalRef = await gitx.currentBranch(this.gitPath, repoPath)
    const other = this.otherReviewingTask(task, originalRef, headSha)
    if (other) throw new TaskError(`任务「${other.title}」正在验收，请先切回原分支`, 409)
    const pre = await this.buildSwitchPreflight(repoPath, reviewSha)
    pre.targetRef = task.branch
    const stash = await this.applySwitchStrategy(task, repoPath, pre, opts.strategy)
    try {
      // Detached checkout: the task branch stays owned by the worktree only.
      await gitx.checkoutDetach(this.gitPath, repoPath, reviewSha)
    } catch (error) {
      // Git may have replaced some files before failing (Windows file locks).
      // Trust the real HEAD: reaching the target counts as success.
      const now = await gitx.revParse(this.gitPath, repoPath, 'HEAD')
      if (now !== reviewSha) throw new TaskError(`切换到验收提交失败：${error instanceof Error ? error.message : String(error)}`, 409)
    }
    task.reviewSha = reviewSha
    task.reviewOriginalRef = originalRef || undefined
    task.reviewOriginalSha = headSha || undefined
    if (originalRef) task.originalBranch = originalRef
    if (stash) {
      task.reviewStash = stash.ref
      this.addPendingStash(task, {
        sha: stash.sha,
        source: 'review',
        ref: stash.ref,
        createdAt: Date.now(),
        files: await gitx.stashFiles(this.gitPath, repoPath, stash.sha),
      })
    }
    this.store.putTask(task)
    return task
  }

  async back(id: string, opts: { strategy?: SwitchStrategy; expectedSha?: string } = {}): Promise<WorktreeTask> {
    const task = this.needTask(id)
    return this.withRepoLock(task.repoPath, '切回原分支', () => this.backLocked(task, opts))
  }

  private async backLocked(task: WorktreeTask, opts: { strategy?: SwitchStrategy; expectedSha?: string } = {}): Promise<WorktreeTask> {
    const repoPath = task.repoPath
    this.assertAgentIdle(task)
    await this.assertNoInProgress(repoPath)
    const headSha = await gitx.revParse(this.gitPath, repoPath, 'HEAD')
    const currentRef = await gitx.currentBranch(this.gitPath, repoPath)
    // The user moved the main repo away during review: only clear the record,
    // never force a switch over their own checkout. A branch at the same sha
    // still counts as moved (review keeps the repo detached).
    if (task.reviewSha && (headSha !== task.reviewSha || currentRef !== null)) {
      task.reviewSha = undefined
      task.reviewOriginalRef = undefined
      task.reviewOriginalSha = undefined
      this.store.putTask(task)
      return task
    }
    const target = await this.resolveBackTarget(task)
    const targetSha = target.ref ? await gitx.revParse(this.gitPath, repoPath, target.ref) : target.sha || null
    if (!targetSha) throw new TaskError('原分支与基线分支都不存在，无法切回')
    if (opts.expectedSha && opts.expectedSha !== targetSha) throw new TaskError('目标分支已变化，请重新预检', 409)
    const pre = await this.buildSwitchPreflight(repoPath, targetSha)
    pre.targetRef = target.ref || target.sha || ''
    const stash = await this.applySwitchStrategy(task, repoPath, pre, opts.strategy)
    try {
      if (target.ref) await gitx.switchBranch(this.gitPath, repoPath, target.ref)
      else await gitx.checkoutDetach(this.gitPath, repoPath, targetSha)
    } catch (error) {
      const nowSha = await gitx.revParse(this.gitPath, repoPath, 'HEAD')
      const nowRef = await gitx.currentBranch(this.gitPath, repoPath)
      const reached = target.ref ? nowRef === target.ref : nowSha === targetSha
      if (!reached) {
        throw new TaskError(`切回原分支失败：${error instanceof Error ? error.message : String(error)}（当前 ${nowRef || nowSha || '未知'}）`, 409)
      }
    }
    task.reviewSha = undefined
    task.reviewOriginalRef = undefined
    task.reviewOriginalSha = undefined
    if (stash) {
      task.reviewStash = stash.ref
      this.addPendingStash(task, {
        sha: stash.sha,
        source: 'review',
        ref: stash.ref,
        createdAt: Date.now(),
        files: await gitx.stashFiles(this.gitPath, repoPath, stash.sha),
      })
    }
    if (!task.originalBranch && target.ref) task.originalBranch = target.ref
    this.store.putTask(task)
    return task
  }

  /** Choose a recorded stash (by sha when given, else the oldest). */
  private pickStash(task: WorktreeTask, sha?: string): PendingStash | undefined {
    const list = Array.isArray(task.pendingStashes) ? task.pendingStashes : []
    if (!list.length) return undefined
    if (sha) return list.find((s) => s.sha === sha)
    return list[0]
  }

  /**
   * Migrate a legacy `reviewStash` (message only) into `pendingStashes`. When the
   * message does not map to exactly one stash entry the record is kept but marked
   * `unverified` (never guessed or dropped).
   */
  async migrateLegacyStashes(): Promise<number> {
    let migrated = 0
    for (const task of this.store.listTasks()) {
      if (!task.reviewStash) continue
      const list = Array.isArray(task.pendingStashes) ? task.pendingStashes : []
      if (!list.some((s) => s.source === 'review' && s.ref === task.reviewStash)) {
        const match = await gitx
          .stashEntryForMessage(this.gitPath, task.repoPath, task.reviewStash)
          .catch(() => ({ entry: null, unique: false }))
        const sha = match.unique && match.entry ? match.entry.sha : ''
        this.addPendingStash(task, {
          sha,
          source: 'review',
          ref: task.reviewStash,
          createdAt: task.updatedAt || Date.now(),
          files: sha ? await gitx.stashFiles(this.gitPath, task.repoPath, sha).catch(() => []) : [],
          unverified: !sha,
        })
      }
      task.reviewStash = undefined
      this.store.putTask(task)
      migrated += 1
    }
    return migrated
  }

  /** Apply a recorded stash (never drops it; the user must drop explicitly). */
  async applyStash(id: string, sha?: string): Promise<WorktreeTask> {
    const task = this.needTask(id)
    const entry = this.pickStash(task, sha)
    if (!entry) throw new TaskError('没有可恢复的暂存', 404, 'stash-missing')
    if (!entry.sha) throw new TaskError('暂存记录无法唯一匹配到 stash，无法自动恢复；请手动处理', 409, 'stash-unverified')
    try {
      await gitx.stashApplyBySha(this.gitPath, task.repoPath, entry.sha)
    } catch (error) {
      const text = (error as any)?.stderr || (error instanceof Error ? error.message : String(error))
      const files = conflictFiles(String(text))
      const detail = files.length ? files.join('、') : '未知文件'
      throw new TaskError(`恢复暂存产生冲突：${detail}。暂存记录已保留，请解决冲突后再恢复或丢弃。`, 409, 'stash-apply-conflict')
    }
    // Apply succeeded; keep the record (only an explicit drop removes it).
    return task
  }

  /** Read-only unified patch of a recorded stash. */
  async stashDiff(id: string, sha?: string): Promise<{ patch: string }> {
    const task = this.needTask(id)
    const entry = this.pickStash(task, sha)
    if (!entry || !entry.sha) return { patch: '' }
    const patch = await gitx.stashShowBySha(this.gitPath, task.repoPath, entry.sha)
    return { patch }
  }

  /** Drop a recorded stash (explicit user action; removes the record). */
  async dropStash(id: string, sha?: string): Promise<WorktreeTask> {
    const task = this.needTask(id)
    const entry = this.pickStash(task, sha)
    if (!entry) return task
    if (entry.sha) await gitx.stashDropBySha(this.gitPath, task.repoPath, entry.sha)
    task.pendingStashes = (task.pendingStashes || []).filter((s) => s !== entry)
    if (task.reviewStash === entry.ref) task.reviewStash = undefined
    this.store.putTask(task)
    return task
  }

  async mergePreflight(id: string, opts: { switchToBase?: boolean; restoreAfter?: boolean } = {}): Promise<MergePreflight> {
    const task = this.needTask(id)
    return this.buildMergePreflight(task, opts)
  }

  /**
   * Collect everything that decides whether (and how) a merge can run. Read-only
   * except for an index refresh; never mutates branches or the worktree. This is
   * the single source of truth used by the dialog, the merge endpoint and tools.
   */
  private async buildMergePreflight(task: WorktreeTask, opts: { switchToBase?: boolean; restoreAfter?: boolean; internal?: boolean }): Promise<MergePreflight> {
    const repoPath = task.repoPath
    const blockers: MergeBlocker[] = []
    const blockingFiles: MergeBlockingFile[] = []
    const seen = new Set<string>()
    const push = (code: string, message: string): void => {
      if (seen.has(code)) return
      seen.add(code)
      blockers.push({ code, message })
    }
    const curBranch = await gitx.currentBranch(this.gitPath, repoPath)
    const headSha = await gitx.revParse(this.gitPath, repoPath, 'HEAD')
    const tipSha = await gitx.revParse(this.gitPath, repoPath, task.branch)
    const baseSha = task.baseBranch ? await gitx.revParse(this.gitPath, repoPath, task.baseBranch) : null
    const originalRef = { branch: curBranch, sha: headSha }
    const conflict: MergeConflictInfo = { applicable: false, conflict: false, conflictFiles: [], checked: false, supported: true }
    const done = (): MergePreflight => ({
      canMerge: blockers.length === 0,
      blockers,
      blockingFiles,
      originalRef,
      tipSha,
      baseSha,
      conflict,
    })

    if (task.cleanedAt) {
      push('cleaned', 'worktree 已清理，无法通过工作台合并')
      return done()
    }
    try {
      this.assertAgentIdle(task)
    } catch (e: any) {
      push(e && e.code ? String(e.code) : 'agent', (e && e.message) || 'Agent 正在运行')
    }
    if (!tipSha) {
      push('branch-missing', `任务分支不存在：${task.branch}`)
      return done()
    }
    if (!baseSha) {
      push('base-missing', `基线分支不存在：${task.baseBranch}`)
      return done()
    }

    let ahead = 0
    try {
      ahead = await gitx.countCommits(this.gitPath, repoPath, `${task.baseBranch}..${task.branch}`)
    } catch {
      ahead = 0
    }
    if (ahead === 0) push('nothing-ahead', '没有领先基线的提交，无需合并')

    const wtDirty = await this.dirtySummary(task.worktreePath)
    if (wtDirty.count > 0) push('worktree-dirty', `worktree 有 ${wtDirty.count} 处未提交改动（${wtDirty.shown}），这些改动不会被合并；请先让 Agent 提交`)

    const prog = await gitx.inProgress(this.gitPath, repoPath)
    if (prog) push('in-progress', `主仓库有未完成的 ${prog} 操作，请先处理`)

    if (!opts.internal && this.gitOps.get(this.repoKey(repoPath))) push('repo-busy', '主仓库正在执行其他 Git 操作，请等待完成')

    // Files that would block switching the main repo to the base branch.
    if (headSha && baseSha) {
      const sw = await this.buildSwitchPreflight(repoPath, baseSha)
      for (const obstacle of sw.obstacles) blockingFiles.push({ path: obstacle.path, untracked: obstacle.kind === 'untracked' })
    }
    const repoDirtyCount = (await gitx.statusEntries(this.gitPath, repoPath, true)).length
    if (repoDirtyCount > 0) {
      if (blockingFiles.length > 0) {
        push('dirty-blocks-switch', `主仓库有 ${blockingFiles.length} 个改动会阻止切换，可先保存到 stash 后继续`)
      } else {
        push('repo-dirty', `主仓库有 ${repoDirtyCount} 处未提交改动，请先处理`)
      }
    }

    if (curBranch !== task.baseBranch) {
      if (!opts.switchToBase) {
        push('not-on-base', `主仓库当前在 ${curBranch || '(未知)'}，请先切到基线分支 ${task.baseBranch} 再合并`)
      } else {
        const baseHeld = (await gitx.worktreeList(this.gitPath, repoPath)).find(
          (entry) => entry.branch === task.baseBranch && this.repoKey(entry.path) !== this.repoKey(repoPath),
        )
        if (baseHeld) push('base-checked-out-elsewhere', `基线分支 ${task.baseBranch} 正被 worktree「${baseHeld.path}」检出，无法切换后合并`)
        const other = this.otherReviewingTask(task, curBranch, headSha)
        if (other) push('other-reviewing', `任务「${other.title}」正在验收，请先切回原分支再操作`)
      }
    }

    // Conflict dry-run (only when there is something to merge and the repo is idle).
    if (ahead > 0 && (opts.internal || !this.gitOps.get(this.repoKey(repoPath)))) {
      const pre = await this.runMergePreview(task, tipSha, baseSha)
      conflict.applicable = pre.applicable !== false
      conflict.conflict = !!pre.conflict
      conflict.conflictFiles = pre.conflictFiles || []
      conflict.checked = !!pre.checked
      conflict.supported = pre.supported !== false
      if (pre.checkedAt) conflict.checkedAt = pre.checkedAt
      if (pre.applicable !== false && pre.conflict) {
        const detail = (pre.conflictFiles || []).length ? `冲突文件：${(pre.conflictFiles || []).join('、')}。` : ''
        push('conflict', `无法自动合并：与 ${task.baseBranch} 存在冲突。${detail}`)
      } else if (pre.applicable !== false && pre.supported !== false && pre.checked === false) {
        push('precheck-unavailable', '无法完成合并前冲突预检，请重试或升级 Git')
      }
    }

    return done()
  }


  async merge(id: string, opts: MergeOptions = {}): Promise<WorktreeTask> {
    const task = this.needTask(id)
    return this.withRepoLock(task.repoPath, '合并', () => this.mergeLocked(task, opts))
  }

  private async mergeLocked(task: WorktreeTask, opts: MergeOptions = {}): Promise<WorktreeTask> {
    if (task.cleanedAt) throw new TaskError('worktree 已清理，分支若仍在可手动合并')
    this.assertAgentIdle(task)
    const repoPath = task.repoPath
    const switchToBase = opts.switchToBase === true
    const restoreAfter = opts.restoreAfter !== undefined ? opts.restoreAfter : opts.restoreTo !== false
    const dirtyStrategy = opts.dirtyStrategy || 'refuse'

    // Once the merge commit exists we may only restore; never merge again.
    if (task.pendingOp && task.pendingOp.mergeCommit) {
      throw new TaskError('合并已提交，只能恢复原分支，不能再次合并', 409, 'merge-committed')
    }
    if (task.pendingOp) {
      throw new TaskError('存在未完成的合并操作，请先通过启动对账或手动恢复处理', 409, 'pending-op')
    }
    if (!(await gitx.branchExists(this.gitPath, repoPath, task.branch))) {
      throw new TaskError(`任务分支不存在：${task.branch}`)
    }
    await this.assertNoInProgress(repoPath)

    const cur = await gitx.currentBranch(this.gitPath, repoPath)
    const headSha = await gitx.revParse(this.gitPath, repoPath, 'HEAD')
    const originalRef = { branch: cur, sha: headSha }
    // Step 1: write the intent (journal) before touching anything.
    task.pendingOp = {
      operationId: randomUUID(),
      kind: 'merge',
      taskId: task.id,
      repoIdentity: await this.repoIdentity(repoPath),
      step: 'preflight',
      originalRef,
      expectedTip: opts.expectedTip || null,
      expectedBase: opts.expectedBase || null,
      recoveryStatus: 'pending',
      startedAt: Date.now(),
    }
    this.store.putTask(task)

    let stashRef: string | undefined
    let switched = false
    let mergeCommitted = false
    try {
      // Step 2: re-run the preflight under the lock; refuse on any hard blocker.
      const pf = await this.buildMergePreflight(task, { switchToBase, restoreAfter, internal: true })
      if (pf.blockers.some((b) => b.code === 'conflict')) {
        const b = pf.blockers.find((x) => x.code === 'conflict')!
        throw new TaskError(b.message, 409, 'conflict')
      }
      const hard = pf.blockers.filter((b) => b.code !== 'dirty-blocks-switch')
      if (hard.length) {
        const b = hard[0]!
        throw new TaskError(b.message, b.code === 'repo-busy' ? 409 : 412, b.code)
      }
      if (pf.blockers.some((b) => b.code === 'dirty-blocks-switch')) {
        if (dirtyStrategy !== 'stash') {
          const b = pf.blockers.find((x) => x.code === 'dirty-blocks-switch')!
          throw new TaskError(b.message, 409, 'dirty-blocks-switch')
        }
        // Step 3: stash the blocking changes, recording the stash by SHA.
        task.pendingOp.step = 'stash'
        task.pendingOp.updatedAt = Date.now()
        this.store.putTask(task)
        const message = `dsh-wt:${id8(task.id)}:merge:${Date.now()}`
        try {
          stashRef = await gitx.stashPushSha(this.gitPath, repoPath, message)
        } catch (error) {
          throw new TaskError(`保存到 stash 失败：${error instanceof Error ? error.message : String(error)}`, 409, 'stash-failed')
        }
        task.pendingOp.stashRef = stashRef
        task.pendingOp.updatedAt = Date.now()
        this.store.putTask(task)
        this.addPendingStash(task, {
          sha: stashRef,
          source: 'merge',
          ref: message,
          createdAt: Date.now(),
          files: await gitx.stashFiles(this.gitPath, repoPath, stashRef),
        })
        this.store.putTask(task)
      }

      // Step 4: switch to the base branch when needed.
      const before = await gitx.currentBranch(this.gitPath, repoPath)
      if (before !== task.baseBranch) {
        task.pendingOp.step = 'switch'
        task.pendingOp.updatedAt = Date.now()
        this.store.putTask(task)
        try {
          await gitx.switchBranch(this.gitPath, repoPath, task.baseBranch)
          switched = true
        } catch (error) {
          const nowRef = await gitx.currentBranch(this.gitPath, repoPath)
          if (nowRef === task.baseBranch) switched = true
          else throw new TaskError(`切换到基线分支失败：${error instanceof Error ? error.message : String(error)}`, 409, 'switch-failed')
        }
      }

      // Step 5: verify SHAs + conflict check on the current state.
      task.pendingOp.step = 'verify'
      task.pendingOp.updatedAt = Date.now()
      this.store.putTask(task)
      const curTip = await gitx.revParse(this.gitPath, repoPath, task.branch)
      const curBase = await gitx.revParse(this.gitPath, repoPath, task.baseBranch)
      const pre = await this.runMergePreview(task, curTip, curBase)
      if (pre.applicable !== false && pre.conflict) {
        const detail = (pre.conflictFiles || []).length ? `冲突文件：${(pre.conflictFiles || []).join('、')}。` : ''
        throw new TaskError(`无法自动合并：与 ${task.baseBranch} 存在冲突。${detail}`, 409, 'conflict')
      }
      if (opts.expectedTip && curTip !== opts.expectedTip) throw new TaskError('任务分支已变化，请重新预检后再合并', 409, 'stale')
      if (opts.expectedBase && curBase !== opts.expectedBase) throw new TaskError('基线分支已变化，请重新预检后再合并', 409, 'stale')
      if (pre.applicable !== false && pre.supported !== false && pre.checked === false) {
        throw new TaskError('无法完成合并前冲突预检，已阻止合并；请重试，或升级 Git 后再合并', 409, 'precheck-unavailable')
      }
      const mergeSha = opts.expectedTip || curTip
      if (!mergeSha) throw new TaskError('无法解析任务分支提交', 409, 'stale')

      // Step 6: merge by SHA.
      task.pendingOp.step = 'merge'
      task.pendingOp.updatedAt = Date.now()
      this.store.putTask(task)
      try {
        await gitx.mergeNoFF(this.gitPath, repoPath, mergeSha, opts.timeoutMs)
      } catch (error) {
        const err = error as any
        const text = error instanceof Error ? error.message : String(error)
        await gitx.mergeAbort(this.gitPath, repoPath)
        if (err && err.timedOut) throw new TaskError('合并超时，已清理现场；请人工检查后重试', 409, 'timeout')
        if (/CONFLICT|Automatic merge failed/i.test(text)) {
          const files = conflictFiles(text)
          const detail = files.length ? `冲突文件：${files.join('、')}。` : ''
          throw new TaskError(`无法自动合并：与 ${task.baseBranch} 存在冲突。${detail}`, 409, 'conflict')
        }
        const summary = text.split(/\r?\n/).slice(-3).join(' ').slice(0, 400)
        throw new TaskError(`合并失败（钩子或 Git 错误）：${summary}`, 409, 'hook-failed')
      }
      mergeCommitted = true
      const mergeCommit = await gitx.revParse(this.gitPath, repoPath, 'HEAD')
      task.mergedAt = Date.now()
      task.mergedBranchTip = mergeSha
      if (mergeCommit) task.mergedCommit = mergeCommit
      if (cur && cur !== task.branch && !task.originalBranch) task.originalBranch = cur
      // Record the merge result BEFORE restoring: a repeat request must restore,
      // never merge again.
      task.pendingOp.step = 'merge-committed'
      task.pendingOp.mergeCommit = mergeCommit || null
      task.pendingOp.updatedAt = Date.now()
      this.store.putTask(task)

      // Step 7: restore the original branch/commit (optional).
      if (switched && restoreAfter) {
        task.pendingOp.step = 'restore'
        task.pendingOp.updatedAt = Date.now()
        this.store.putTask(task)
        try {
          if (originalRef.branch) await gitx.switchBranch(this.gitPath, repoPath, originalRef.branch)
          else if (originalRef.sha) await gitx.checkoutDetach(this.gitPath, repoPath, originalRef.sha)
          else throw new Error('原分支与原提交都不可用')
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          this.partials.set(task.id, { restoreFailed: true, reason })
          // Keep pendingOp so startup reconcile (or a manual restore) can retry.
          return task
        }
      }
      // Whole operation complete.
      task.pendingOp = undefined
      this.store.putTask(task)
      return task
    } catch (error) {
      // A failure before the merge commit: restore the original branch if we had
      // switched, then clear the journal (the stash record stays available).
      if (!mergeCommitted && switched) {
        try {
          if (originalRef.branch) await gitx.switchBranch(this.gitPath, repoPath, originalRef.branch)
          else if (originalRef.sha) await gitx.checkoutDetach(this.gitPath, repoPath, originalRef.sha)
        } catch {
          /* stay on base, reconcile will retry */
        }
      }
      if (!mergeCommitted && task.pendingOp) {
        task.pendingOp = undefined
        this.store.putTask(task)
      }
      throw error
    }
  }

  /** Retry restoring the original branch after a committed merge (never re-merges). */
  async restoreAfterMerge(id: string): Promise<WorktreeTask> {
    const task = this.needTask(id)
    return this.withRepoLock(task.repoPath, '恢复原分支', () => this.restoreAfterMergeLocked(task))
  }

  private async restoreAfterMergeLocked(task: WorktreeTask): Promise<WorktreeTask> {
    const op = task.pendingOp
    if (!op || !op.mergeCommit) throw new TaskError('没有待恢复的合并操作', 409, 'not-committed')
    const repoPath = task.repoPath
    const target = op.originalRef.branch || op.originalRef.sha
    if (!target) throw new TaskError('原分支与原提交都不可用，无法恢复', 409, 'no-target')
    if (op.originalRef.branch) await gitx.switchBranch(this.gitPath, repoPath, op.originalRef.branch)
    else await gitx.checkoutDetach(this.gitPath, repoPath, op.originalRef.sha as string)
    task.pendingOp = undefined
    this.partials.delete(task.id)
    this.store.putTask(task)
    return task
  }

  /**
   * Reconcile journals left behind by a crash/restart. Only journals whose repo
   * identity matches the live repo are touched; anything else is flagged for
   * manual handling. Uses the real Git state as the source of truth.
   */
  async reconcilePendingOps(): Promise<Array<{ taskId: string; status: 'recovered' | 'needs-manual'; message: string }>> {
    const out: Array<{ taskId: string; status: 'recovered' | 'needs-manual'; message: string }> = []
    for (const task of this.store.listTasks()) {
      const op = task.pendingOp
      if (!op) continue
      try {
        const result = await this.reconcileOne(task)
        out.push({ taskId: task.id, ...result })
      } catch (error) {
        task.pendingOp = { ...op, recoveryStatus: 'needs-manual', updatedAt: Date.now() }
        this.store.putTask(task)
        out.push({ taskId: task.id, status: 'needs-manual', message: error instanceof Error ? error.message : String(error) })
      }
    }
    return out
  }

  private async reconcileOne(task: WorktreeTask): Promise<{ status: 'recovered' | 'needs-manual'; message: string }> {
    const op = task.pendingOp!
    const repoPath = task.repoPath
    // Prove ownership before touching anything.
    const identity = await this.repoIdentity(repoPath).catch(() => null)
    if (!identity || identity !== op.repoIdentity) {
      task.pendingOp = { ...op, recoveryStatus: 'needs-manual', updatedAt: Date.now() }
      this.store.putTask(task)
      return { status: 'needs-manual', message: '仓库身份不匹配，需人工确认' }
    }

    // Ensure a recorded stash is present on the task (never auto-apply).
    if (op.stashRef && !(task.pendingStashes || []).some((s) => s.sha === op.stashRef)) {
      const exists = (await gitx.stashListEntries(this.gitPath, repoPath)).some((s) => s.sha === op.stashRef)
      this.addPendingStash(task, {
        sha: op.stashRef,
        source: 'merge',
        ref: `dsh-wt:${id8(task.id)}:merge`,
        createdAt: op.startedAt,
        files: exists ? await gitx.stashFiles(this.gitPath, repoPath, op.stashRef) : [],
        unverified: !exists,
      })
    }

    // A committed merge: only the restore may be incomplete.
    if (op.mergeCommit) {
      const restored = await this.tryRestoreOriginal(task, op.originalRef)
      if (!restored) {
        task.pendingOp = { ...op, recoveryStatus: 'needs-manual', updatedAt: Date.now() }
        this.store.putTask(task)
        return { status: 'needs-manual', message: '合并已提交但无法切回原分支，需人工切回' }
      }
      task.pendingOp = undefined
      this.partials.delete(task.id)
      this.store.putTask(task)
      return { status: 'recovered', message: '已恢复原分支' }
    }

    // Pre-merge: clean up any partial merge, then recognise completion or switch back.
    if (await gitx.hasMergeHead(this.gitPath, repoPath)) await gitx.mergeAbort(this.gitPath, repoPath)

    let mergedNow = false
    if (op.expectedTip) {
      try {
        mergedNow = await gitx.isAncestor(this.gitPath, repoPath, op.expectedTip, task.baseBranch)
      } catch {
        mergedNow = false
      }
    }
    if (mergedNow) {
      task.mergedAt = task.mergedAt || Date.now()
      task.mergedBranchTip = op.expectedTip || undefined
      const head = await gitx.revParse(this.gitPath, repoPath, task.baseBranch)
      if (head) task.mergedCommit = head
      const restored = await this.tryRestoreOriginal(task, op.originalRef)
      task.pendingOp = undefined
      this.store.putTask(task)
      return restored
        ? { status: 'recovered', message: '补记合并结果并恢复原分支' }
        : { status: 'needs-manual', message: '已补记合并结果，但未能切回原分支' }
    }

    const restored = await this.tryRestoreOriginal(task, op.originalRef)
    task.pendingOp = undefined
    this.store.putTask(task)
    return restored
      ? { status: 'recovered', message: '已清理未完成的合并并恢复原分支' }
      : { status: 'needs-manual', message: '未能切回原分支，需人工处理' }
  }

  /** Try to put the main repo back on the journal's original branch/commit. */
  private async tryRestoreOriginal(task: WorktreeTask, originalRef: { branch: string | null; sha: string | null }): Promise<boolean> {
    const repoPath = task.repoPath
    try {
      const cur = await gitx.currentBranch(this.gitPath, repoPath)
      const head = await gitx.revParse(this.gitPath, repoPath, 'HEAD')
      if (originalRef.branch) {
        if (cur === originalRef.branch) return true
        await gitx.switchBranch(this.gitPath, repoPath, originalRef.branch)
        return true
      }
      if (originalRef.sha) {
        if (head === originalRef.sha) return true
        await gitx.checkoutDetach(this.gitPath, repoPath, originalRef.sha)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * Preview whether the task branch can merge into its base. This is a dry run:
   * it never touches either working tree and does not decide the task status.
   */
  async mergePreview(id: string, opts: { force?: boolean } = {}): Promise<MergePreview> {
    const task = this.needTask(id)
    const tip = await gitx.revParse(this.gitPath, task.repoPath, task.branch)
    const baseSha = task.baseBranch ? await gitx.revParse(this.gitPath, task.repoPath, task.baseBranch) : null
    const empty: MergePreview = {
      applicable: false,
      branch: task.branch,
      baseBranch: task.baseBranch,
      expectedTip: tip,
      expectedBase: baseSha,
      baseAhead: 0,
      overlapFiles: [],
      conflictFiles: [],
      conflict: false,
      checked: false,
      supported: true,
    }
    if (task.cleanedAt) return { ...empty, reason: 'cleaned' }
    if (!(await gitx.branchExists(this.gitPath, task.repoPath, task.branch))) {
      return { ...empty, reason: 'branch-missing' }
    }
    // Cache keyed purely by (task, tip, base): if neither tip moved the dry-run
    // result is still valid no matter how much wall-clock time passed. `force`
    // bypasses it so the merge dialog can insist on a fresh check.
    const cached = this.previewCache.get(task.id)
    if (!opts.force && cached && cached.tip === tip && cached.base === baseSha) {
      return { ...cached.result, cached: true }
    }
    // Never spawn git while another git action holds this repo; a cached result
    // is still safe to show, otherwise report busy.
    if (this.gitOps.get(this.repoKey(task.repoPath))) {
      if (cached) return { ...cached.result, cached: true }
      return { ...empty, reason: 'busy' }
    }
    return this.runMergePreview(task, tip, baseSha)
  }

  /**
   * Run the merge dry-run and cache it by (task, tip, base). Split out from
   * `mergePreview` so the merge path can recompute while it holds the repo lock
   * (which would otherwise look like "busy").
   */
  private async runMergePreview(task: WorktreeTask, tip: string | null, baseSha: string | null): Promise<MergePreview> {
    const base: MergePreview = {
      applicable: false,
      branch: task.branch,
      baseBranch: task.baseBranch,
      expectedTip: tip,
      expectedBase: baseSha,
      baseAhead: 0,
      overlapFiles: [],
      conflictFiles: [],
      conflict: false,
      checked: false,
      supported: true,
    }
    const remember = (r: MergePreview): MergePreview => {
      const checkedAt = Date.now()
      const out: MergePreview = { ...r, checkedAt, cached: false }
      this.previewCache.set(task.id, { tip, base: baseSha, at: checkedAt, result: out })
      return out
    }
    const mergeBase = await gitx.mergeBase(this.gitPath, task.repoPath, task.baseBranch, task.branch)
    if (!mergeBase) return remember({ ...base, applicable: true, reason: 'no-merge-base' })

    const [baseAhead, baseFiles, taskFiles] = await Promise.all([
      gitx.countCommits(this.gitPath, task.repoPath, `${mergeBase}..${task.baseBranch}`),
      gitx.diffNameOnly(this.gitPath, task.repoPath, mergeBase, task.baseBranch),
      gitx.diffNameOnly(this.gitPath, task.repoPath, mergeBase, task.branch),
    ])
    const taskSet = new Set(taskFiles)
    const overlapFiles = baseFiles.filter((file) => taskSet.has(file))

    const preview: MergePreview = {
      ...base,
      applicable: true,
      baseAhead,
      overlapFiles,
      checked: false,
    }
    // When the base has not moved since the merge-base the merge is a
    // fast-forward and cannot conflict.
    if (baseAhead === 0) {
      preview.checked = true
      return remember(preview)
    }

    // Always run the real dry-run (not only when file names overlap): renames,
    // mode changes and directory conflicts do not need a same-path overlap.
    const check = await gitx.mergeTreeCheck(this.gitPath, task.repoPath, task.baseBranch, task.branch)
    preview.supported = check.supported
    preview.checked = check.supported && !check.error
    preview.conflict = check.conflict
    preview.conflictFiles = check.files
    if (check.error) preview.error = check.error
    return remember(preview)
  }

  async cleanup(id: string, opts: { force?: boolean; deleteBranch?: boolean; forceDeleteBranch?: boolean }): Promise<WorktreeTask> {
    const task = this.needTask(id)
    return this.withRepoLock(task.repoPath, '清理', () => this.cleanupLocked(task, opts))
  }

  private async cleanupLocked(task: WorktreeTask, opts: { force?: boolean; deleteBranch?: boolean; forceDeleteBranch?: boolean }): Promise<WorktreeTask> {
    this.assertAgentIdle(task)
    if ((task.pendingStashes || []).length) throw new TaskError('任务还有未处理的暂存，请先恢复或丢弃后再清理 worktree', 409, 'pending-stash')
    // Never clean the working copy the main repo is currently reviewing: the
    // user would be left on a detached/branch state with no way back.
    if ((await this.snapshot(task)).status === 'reviewing') {
      throw new TaskError('任务正在验收中，请先切回原分支再清理 worktree', 409)
    }
    // Validate branch deletion BEFORE touching the worktree, so a refusal never
    // leaves a half-cleaned task (worktree gone, branch still there).
    let branchMerged = false
    const hasBranch = await gitx.branchExists(this.gitPath, task.repoPath, task.branch)
    if (opts.deleteBranch && hasBranch) {
      if (!(await gitx.branchExists(this.gitPath, task.repoPath, task.baseBranch))) {
        throw new TaskError(`基线分支 ${task.baseBranch} 不存在，无法判断分支是否已合并；确认丢弃请勾选「强制删除分支」`, 409)
      }
      const ahead = await gitx.countCommits(this.gitPath, task.repoPath, `${task.baseBranch}..${task.branch}`)
      branchMerged = ahead === 0
      if (!branchMerged && !opts.forceDeleteBranch) {
        throw new TaskError(`分支还有 ${ahead} 个提交未合并到 ${task.baseBranch}；确认丢弃这些提交请勾选「强制删除分支」`, 409)
      }
    }
    const wtExists = await fs.stat(task.worktreePath).then((s) => s.isDirectory()).catch(() => false)
    if (wtExists) {
      if (!opts.force) await this.refuseDirty(task.worktreePath, 'worktree')
      await gitx.worktreeRemove(this.gitPath, task.repoPath, task.worktreePath, !!opts.force)
    }
    if (opts.deleteBranch && hasBranch) {
      const cur = await gitx.currentBranch(this.gitPath, task.repoPath)
      if (cur === task.branch) {
        const fallback = task.originalBranch && (await gitx.branchExists(this.gitPath, task.repoPath, task.originalBranch))
          ? task.originalBranch
          : task.baseBranch
        if (fallback && fallback !== task.branch && (await gitx.branchExists(this.gitPath, task.repoPath, fallback))) {
          await gitx.switchBranch(this.gitPath, task.repoPath, fallback)
        } else {
          throw new TaskError('主仓库仍在任务分支且没有可切回的分支，请先切回后再删除分支', 409)
        }
      }
      // -D is safe when the branch is fully merged; only an explicit force may
      // discard unmerged commits.
      await gitx.removeBranch(this.gitPath, task.repoPath, task.branch, !!opts.forceDeleteBranch || branchMerged)
    }
    task.cleanedAt = Date.now()
    this.store.putTask(task)
    return task
  }

  /**
   * Archive a finished task: it stays on disk and in the store, but the board
   * hides it by default. Only terminal states (merged / cleaned) can be
   * archived — a task still under development should not disappear.
   */
  async archive(id: string): Promise<WorktreeTask> {
    const task = this.needTask(id)
    if (task.archivedAt) return task
    const status = (await this.snapshot(task)).status
    if (status !== 'merged' && status !== 'cleaned') {
      throw new TaskError('只有已合并或已清理的任务可以归档')
    }
    task.archivedAt = Date.now()
    this.store.putTask(task)
    return task
  }

  /** Restore an archived task to the board's default list. */
  unarchive(id: string): WorktreeTask {
    const task = this.needTask(id)
    if (!task.archivedAt) return task
    task.archivedAt = undefined
    this.store.putTask(task)
    return task
  }

  async delete(id: string): Promise<void> {
    const task = this.needTask(id)
    if ((await this.snapshot(task)).status === 'reviewing') {
      throw new TaskError('任务正在验收中，请先切回原分支再删除记录', 409)
    }
    if ((task.pendingStashes || []).length) throw new TaskError('任务还有未处理的暂存，请先恢复或丢弃后再删除记录', 409, 'pending-stash')
    this.store.deleteTask(id)
  }

  bind(id: string, sessionId: string): WorktreeTask {
    const task = this.needTask(id)
    task.sessionId = sessionId
    task.startOnBind = false
    this.store.putTask(task)
    return task
  }

  unbindBySession(sessionId: string): WorktreeTask | null {
    const task = this.store.listTasks().find((t) => t.sessionId === sessionId)
    if (!task) return null
    task.sessionId = null
    task.startOnBind = false // the user removed the conversation; do not resurrect it
    this.store.putTask(task)
    return task
  }
}

/** Trim and validate a client-supplied model route; undefined when unusable. */
function normalizeModelSelection(value: any): ModelSelection | undefined {
  if (!value || typeof value !== 'object') return undefined
  const provider = typeof value.provider === 'string' ? value.provider.trim() : ''
  const model = typeof value.model === 'string' ? value.model.trim() : ''
  if (!provider || !model) return undefined
  const reasoningEffort = typeof value.reasoningEffort === 'string' && value.reasoningEffort.trim()
    ? value.reasoningEffort.trim()
    : undefined
  return { provider, model, ...(reasoningEffort ? { reasoningEffort } : {}) }
}
