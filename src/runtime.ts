/**
 * Task lifecycle: publish (worktree + branch + record), git snapshot
 * aggregation, acceptance actions. Session creation stays on the client
 * (remote.session.create); the host only records the binding.
 */

import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import * as gitx from './gitx.js'
import { MergePreview, Project, ProjectStats, ProjectView, TaskSnapshot, TaskStatus, TaskView, WorktreeConfig, WorktreeTask } from './models.js'
import { Store } from './store.js'

export interface PublishInput {
  projectId?: string
  repoPath?: string
  baseBranch?: string
  title: string
  description: string
  branchName?: string
  start?: boolean
  /** Client publishes bind their own session; tools rely on the board retry. */
  autoBind?: boolean
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

function assertTaskBranchName(name: string): void {
  const valid = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(name)
  if (!valid || name.includes('..') || name.includes('@{') || name.endsWith('/') || name.endsWith('.') || name.endsWith('.lock')) {
    throw new TaskError('任务分支只能使用英文、数字、点、下划线和斜杠')
  }
}

export function buildFirstPrompt(task: WorktreeTask): string {
  return [
    '这是一个 git worktree 任务。',
    '',
    `任务：${task.title}`,
    `描述：${task.description.trim()}`,
    '',
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
  ].join('\n')
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

  /** Aggregate the board's left column: every project with its task views. */
  async projectViews(): Promise<ProjectView[]> {
    const views = await this.views()
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

  async publish(input: PublishInput): Promise<WorktreeTask> {
    if (!input.title?.trim()) throw new TaskError('任务标题不能为空')
    if (!input.description?.trim()) throw new TaskError('任务描述不能为空')

    const project = await this.ensureProject(input)
    const repoPath = project.repoPath
    if (!(await gitx.isRepo(this.gitPath, repoPath))) {
      throw new TaskError(`目标目录不是 git 仓库工作区：${repoPath}`)
    }

    const { current, default: defaultBranch } = await gitx.listBranches(this.gitPath, repoPath)
    const base = (input.baseBranch || project.baseBranch || current || defaultBranch || '').trim()
    if (!base || !(await gitx.branchExists(this.gitPath, repoPath, base))) {
      throw new TaskError(`基线分支不存在：${base || '(未指定)'}`)
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
      createdAt: now,
      updatedAt: now,
    }
    task.firstPrompt = buildFirstPrompt(task)
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

  async views(): Promise<TaskView[]> {
    const tasks = this.store.listTasks()
    return Promise.all(tasks.map((t) => this.view(t)))
  }

  private needTask(id: string): WorktreeTask {
    const task = this.store.getTask(id)
    if (!task) throw new TaskError(`任务不存在：${id}`, 404)
    return task
  }

  private async refuseDirty(dir: string, what: string, includeUntracked = true): Promise<void> {
    const dirty = await gitx.isDirty(this.gitPath, dir, includeUntracked)
    if (dirty > 0) throw new TaskError(`${what}有 ${dirty} 处未提交改动，请先处理后再操作`)
  }

  async checkout(id: string): Promise<WorktreeTask> {
    const task = this.needTask(id)
    if (task.cleanedAt) throw new TaskError('worktree 已清理，无法验收切换')
    await this.refuseDirty(task.repoPath, '主仓库', false)
    const cur = await gitx.currentBranch(this.gitPath, task.repoPath)
    if (cur !== task.branch) {
      task.originalBranch = cur ?? task.originalBranch
      await gitx.switchBranch(this.gitPath, task.repoPath, task.branch)
      this.store.putTask(task)
    }
    return task
  }

  async back(id: string): Promise<WorktreeTask> {
    const task = this.needTask(id)
    if (!task.originalBranch) throw new TaskError('没有记录验收前的分支')
    if (!(await gitx.branchExists(this.gitPath, task.repoPath, task.originalBranch))) {
      throw new TaskError(`原分支已不存在：${task.originalBranch}`)
    }
    await this.refuseDirty(task.repoPath, '主仓库', false)
    const cur = await gitx.currentBranch(this.gitPath, task.repoPath)
    if (cur !== task.originalBranch) {
      await gitx.switchBranch(this.gitPath, task.repoPath, task.originalBranch)
    }
    return task
  }

  async merge(id: string): Promise<WorktreeTask> {
    const task = this.needTask(id)
    if (task.cleanedAt) throw new TaskError('worktree 已清理，分支若仍在可手动合并')
    if (!(await gitx.branchExists(this.gitPath, task.repoPath, task.branch))) {
      throw new TaskError(`任务分支不存在：${task.branch}`)
    }
    await this.refuseDirty(task.repoPath, '主仓库', false)
    const cur = await gitx.currentBranch(this.gitPath, task.repoPath)
    if (cur !== task.baseBranch) {
      await gitx.switchBranch(this.gitPath, task.repoPath, task.baseBranch)
    }
    try {
      await gitx.mergeNoFF(this.gitPath, task.repoPath, task.branch)
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
    // After a successful merge the working branch is the base; keep the
    // original-branch hint only if the user never went through checkout.
    if (cur && cur !== task.branch && !task.originalBranch) task.originalBranch = cur
    task.mergedAt = Date.now()
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
