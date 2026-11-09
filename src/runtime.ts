/**
 * Task lifecycle: publish (worktree + branch + record), git snapshot
 * aggregation, acceptance actions. Session creation stays on the client
 * (remote.session.create); the host only records the binding.
 */

import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import * as gitx from './gitx.js'
import { DiffFile, MergePreview, ModelSelection, Project, ProjectStats, ProjectView, TaskDiff, TaskSnapshot, TaskStatus, TaskView, WorktreeConfig, WorktreeTask } from './models.js'
import { Store } from './store.js'

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
}

export interface AddProjectInput {
  repoPath: string
  name?: string
  baseBranch?: string
  dirName?: string
  branchPrefix?: string
}

export class TaskError extends Error {
  readonly status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'TaskError'
    this.status = status
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

export class Runtime {
  private readonly store: Store
  private readonly config: WorktreeConfig
  readonly gitPath: string

  constructor(deps: { store: Store; config: WorktreeConfig }) {
    this.store = deps.store
    this.config = deps.config
    this.gitPath = deps.config.gitPath
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

      if (repoIsRepo) {
        const [cur, dirty] = await Promise.all([
          gitx.currentBranch(this.gitPath, task.repoPath),
          // Untracked files in the main repo do not belong to the task branch and
          // must not block checkout or merge. Tracked edits still do.
          gitx.isDirty(this.gitPath, task.repoPath, false),
        ])
        snap.repo.currentBranch = cur
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

  /** Another task of the same repo whose branch is currently checked out in the main repo. */
  private otherReviewingTask(task: WorktreeTask, cur: string | null): WorktreeTask | null {
    if (!cur || cur === task.branch) return null
    const norm = (p: string) => p.replace(/[\\/]+$/, '').toLowerCase()
    return (
      this.store
        .listTasks()
        .find((t) => t.id !== task.id && !t.cleanedAt && norm(t.repoPath) === norm(task.repoPath) && t.branch === cur) || null
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

  async checkout(id: string): Promise<WorktreeTask> {
    const task = this.needTask(id)
    if (task.cleanedAt) throw new TaskError('worktree 已清理，无法验收切换')
    const repoPath = task.repoPath
    await this.assertNoInProgress(repoPath)
    await this.assertRepoClean(repoPath)
    const cur = await gitx.currentBranch(this.gitPath, repoPath)
    if (cur === task.branch) return task
    // The main repo can only check out one task branch at a time.
    const other = this.otherReviewingTask(task, cur)
    if (other) throw new TaskError(`任务「${other.title}」正在验收，请先切回原分支`, 409)
    if (!(await gitx.branchExists(this.gitPath, repoPath, task.branch))) {
      throw new TaskError(`任务分支不存在：${task.branch}`)
    }
    // Acceptance reviews committed work; uncommitted worktree edits would not be visible.
    const ahead = await gitx.countCommits(this.gitPath, repoPath, `${task.baseBranch}..${task.branch}`)
    if (ahead === 0) {
      const dirty = await this.dirtySummary(task.worktreePath)
      if (dirty.count > 0) throw new TaskError(`worktree 有 ${dirty.count} 处未提交改动（${dirty.shown}），请先让 Agent 提交后再验收`)
      throw new TaskError('还没有可验收的提交')
    }
    const wtDirty = await this.dirtySummary(task.worktreePath)
    if (wtDirty.count > 0) throw new TaskError(`worktree 有 ${wtDirty.count} 处未提交改动（${wtDirty.shown}），请先让 Agent 提交后再验收`)
    task.originalBranch = cur ?? task.originalBranch
    await gitx.switchBranch(this.gitPath, repoPath, task.branch)
    this.store.putTask(task)
    return task
  }

  async back(id: string): Promise<WorktreeTask> {
    const task = this.needTask(id)
    const repoPath = task.repoPath
    await this.assertNoInProgress(repoPath)
    await this.assertRepoClean(repoPath)
    const cur = await gitx.currentBranch(this.gitPath, repoPath)
    let target: string | null = null
    if (task.originalBranch && (await gitx.branchExists(this.gitPath, repoPath, task.originalBranch))) {
      target = task.originalBranch
    } else if (await gitx.branchExists(this.gitPath, repoPath, task.baseBranch)) {
      // Escape hatch: the recorded branch is gone (or was never recorded) → use base.
      target = task.baseBranch
    }
    if (!target) throw new TaskError('原分支与基线分支都不存在，无法切回')
    if (cur !== target) await gitx.switchBranch(this.gitPath, repoPath, target)
    if (!task.originalBranch) {
      task.originalBranch = target
      this.store.putTask(task)
    }
    return task
  }

  async merge(id: string): Promise<WorktreeTask> {
    const task = this.needTask(id)
    if (task.cleanedAt) throw new TaskError('worktree 已清理，分支若仍在可手动合并')
    const repoPath = task.repoPath
    if (!(await gitx.branchExists(this.gitPath, repoPath, task.branch))) {
      throw new TaskError(`任务分支不存在：${task.branch}`)
    }
    await this.assertNoInProgress(repoPath)
    await this.assertRepoClean(repoPath)
    // Never silently move the user's branch: merging must happen on the base branch.
    const cur = await gitx.currentBranch(this.gitPath, repoPath)
    if (cur !== task.baseBranch) {
      throw new TaskError(`主仓库当前在 ${cur || '(未知)'} 分支，请先切到基线分支 ${task.baseBranch} 再合并`)
    }
    const ahead = await gitx.countCommits(this.gitPath, repoPath, `${task.baseBranch}..${task.branch}`)
    if (ahead === 0) throw new TaskError('没有领先基线的提交，无需合并')
    const wtDirty = await this.dirtySummary(task.worktreePath)
    if (wtDirty.count > 0) throw new TaskError(`worktree 有 ${wtDirty.count} 处未提交改动（${wtDirty.shown}），这些改动不会被合并；请先让 Agent 提交`)
    // Capture the tip that is about to be merged.
    const mergedTip = await gitx.revParse(this.gitPath, repoPath, task.branch)
    try {
      await gitx.mergeNoFF(this.gitPath, repoPath, task.branch)
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      if (/CONFLICT|Automatic merge failed/i.test(text)) {
        const files = conflictFiles(text)
        const detail = files.length ? `冲突文件：${files.join('、')}。` : ''
        throw new TaskError(
          `无法自动合并：与 ${task.baseBranch} 存在冲突。${detail}请在任务 worktree 中执行 git merge ${task.baseBranch}，解决冲突并提交后再重试。`,
          409,
        )
      }
      throw error
    }
    if (cur && cur !== task.branch && !task.originalBranch) task.originalBranch = cur
    task.mergedAt = Date.now()
    if (mergedTip) task.mergedBranchTip = mergedTip
    const mergeCommit = await gitx.revParse(this.gitPath, repoPath, 'HEAD')
    if (mergeCommit) task.mergedCommit = mergeCommit
    this.store.putTask(task)
    return task
  }

  /**
   * Preview whether the task branch can merge into its base. This is a dry run:
   * it never touches either working tree and does not decide the task status.
   */
  async mergePreview(id: string): Promise<MergePreview> {
    const task = this.needTask(id)
    const base: MergePreview = {
      applicable: false,
      branch: task.branch,
      baseBranch: task.baseBranch,
      baseAhead: 0,
      overlapFiles: [],
      conflictFiles: [],
      conflict: false,
      checked: false,
      supported: true,
    }
    if (task.cleanedAt) return { ...base, reason: 'cleaned' }
    if (!(await gitx.branchExists(this.gitPath, task.repoPath, task.branch))) {
      return { ...base, reason: 'branch-missing' }
    }
    const mergeBase = await gitx.mergeBase(this.gitPath, task.repoPath, task.baseBranch, task.branch)
    if (!mergeBase) return { ...base, applicable: true, reason: 'no-merge-base' }

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
      checked: true,
    }
    if (baseAhead === 0 || overlapFiles.length === 0) return preview

    const check = await gitx.mergeTreeCheck(this.gitPath, task.repoPath, task.baseBranch, task.branch)
    preview.supported = check.supported
    preview.checked = check.supported && !check.error
    preview.conflict = check.conflict
    preview.conflictFiles = check.files
    if (check.error) preview.error = check.error
    return preview
  }

  async cleanup(id: string, opts: { force?: boolean; deleteBranch?: boolean }): Promise<WorktreeTask> {
    const task = this.needTask(id)
    const wtExists = await fs.stat(task.worktreePath).then((s) => s.isDirectory()).catch(() => false)
    if (wtExists) {
      if (!opts.force) await this.refuseDirty(task.worktreePath, 'worktree')
      await gitx.worktreeRemove(this.gitPath, task.repoPath, task.worktreePath, !!opts.force)
    }
    if (opts.deleteBranch && (await gitx.branchExists(this.gitPath, task.repoPath, task.branch))) {
      const cur = await gitx.currentBranch(this.gitPath, task.repoPath)
      if (cur === task.branch && task.originalBranch) {
        await gitx.switchBranch(this.gitPath, task.repoPath, task.originalBranch)
      }
      await gitx.removeBranch(this.gitPath, task.repoPath, task.branch, true)
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

  delete(id: string): void {
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
