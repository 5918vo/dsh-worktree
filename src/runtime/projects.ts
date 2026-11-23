/**
 * Project CRUD, project/task view aggregation, and task publishing.
 */

import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { normalizeCriteria } from '../criteria.js'
import * as gitx from '../gitx.js'
import { Project, ProjectView, TaskView, WorktreeTask } from '../models.js'
import { compareTaskOrder, normalizePriority, normalizeTags, parseDueAt, parseEstimate, validateTags } from '../task-meta.js'
import { assertTaskBranchName, buildFirstPrompt, id8, normalizeModelSelection } from './prompt.js'
import {
  absPath,
  AddProjectInput,
  assertAgentIdle,
  assertNoInProgress,
  effectiveConfig,
  ParentPromptInfo,
  PublishInput,
  RuntimeContext,
  TaskError,
  withRepoLock,
} from './types.js'
import { isExternalWorktreeDir, worktreeProjectSegment } from '../worktree-layout.js'

/** One-line reason for a failed filesystem/git call, for user-facing errors. */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

async function pathExists(target: string): Promise<boolean> {
  return fs
    .stat(target)
    .then(() => true)
    .catch(() => false)
}

export async function addProject(ctx: RuntimeContext, input: AddProjectInput): Promise<Project> {
  const repoPath = absPath(input.repoPath)
  if (!(await gitx.isRepo(ctx.gitPath, repoPath))) {
    throw new TaskError(`目标目录不是 git 仓库工作区：${repoPath}`)
  }
  const existing = ctx.store.findProjectByRepo(repoPath)
  if (existing) return existing
  const { current, default: defaultBranch } = await gitx.listBranches(ctx.gitPath, repoPath)
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
  ctx.store.putProject(project)
  ctx.store.addRecent(repoPath)
  return project
}

export async function updateProject(
  ctx: RuntimeContext,
  id: string,
  patch: { name?: string; baseBranch?: string; dirName?: string; branchPrefix?: string; mergeGate?: 'off' | 'criteria' },
): Promise<Project> {
  const project = ctx.store.getProject(id)
  if (!project) throw new TaskError(`项目不存在：${id}`, 404)
  if (typeof patch.name === 'string' && patch.name.trim()) project.name = patch.name.trim()
  if (typeof patch.baseBranch === 'string' && patch.baseBranch.trim()) {
    const b = patch.baseBranch.trim()
    if (!(await gitx.branchExists(ctx.gitPath, project.repoPath, b))) throw new TaskError(`基线分支不存在：${b}`)
    project.baseBranch = b
  }
  if (typeof patch.dirName === 'string') project.dirName = patch.dirName.trim() || undefined
  if (typeof patch.branchPrefix === 'string') project.branchPrefix = patch.branchPrefix.trim() || undefined
  if (patch.mergeGate !== undefined) {
    if (patch.mergeGate !== 'off' && patch.mergeGate !== 'criteria') throw new TaskError('合并门禁取值无效', 400)
    project.mergeGate = patch.mergeGate
  }
  ctx.store.putProject(project)
  return project
}

/**
 * Remove one task's worktree directory from disk. Returns true when something
 * was actually removed. Missing paths are skipped; when git refuses (stale
 * registration, missing main repo) fall back to a plain directory removal and
 * prune the leftover administrative metadata.
 */
async function removeWorktreeDir(ctx: RuntimeContext, task: WorktreeTask): Promise<boolean> {
  const exists = await fs.stat(task.worktreePath).then((s) => s.isDirectory()).catch(() => false)
  if (!exists) return false
  try {
    await gitx.worktreeRemove(ctx.gitPath, task.repoPath, task.worktreePath, true)
    return true
  } catch {
    /* fall through to a direct filesystem removal */
  }
  await fs.rm(task.worktreePath, { recursive: true, force: true })
  await gitx.worktreePrune(ctx.gitPath, task.repoPath)
  return true
}

export async function deleteProject(
  ctx: RuntimeContext,
  id: string,
  opts: { withTasks?: boolean; withWorktrees?: boolean },
): Promise<{ deletedTasks: number; deletedWorktrees: number }> {
  const project = ctx.store.getProject(id)
  if (!project) throw new TaskError(`项目不存在：${id}`, 404)
  const tasks = ctx.store.listTasksOfProject(id)
  if (tasks.length > 0 && !opts.withTasks) {
    throw new TaskError(`项目下还有 ${tasks.length} 个任务；勾选「连同任务删除」后重试`)
  }
  // Deleting a project is destructive: gate it exactly like a single task
  // delete, and take the per-repo lock so a concurrent publish/merge cannot
  // recreate a worktree between the check and the removal.
  return withRepoLock(ctx, project.repoPath, 'delete-project', async () => {
    await assertNoInProgress(ctx, project.repoPath)
    for (const t of tasks) {
      assertAgentIdle(ctx, t)
      if ((await ctx.snapshot(t)).status === 'reviewing') {
        throw new TaskError(`任务「${t.title}」正在验收中，请先切回原分支再删除项目`, 409)
      }
      if ((t.pendingStashes || []).length) {
        throw new TaskError(`任务「${t.title}」还有未处理的暂存，请先恢复或丢弃再删除项目`, 409, 'pending-stash')
      }
    }
    let deletedWorktrees = 0
    const failed: Array<{ taskId: string; title: string; reason: string }> = []
    if (opts.withWorktrees) {
      for (const t of tasks) {
        try {
          if (await removeWorktreeDir(ctx, t)) deletedWorktrees += 1
        } catch (error) {
          failed.push({ taskId: t.id, title: t.title, reason: describeError(error) })
        }
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
    // Records of tasks whose worktree is gone are deleted; records that still
    // own a worktree stay, so the ledger never points at a directory the user
    // could no longer clean up from the board.
    const failedIds = new Set(failed.map((item) => item.taskId))
    let deletedTasks = 0
    for (const t of tasks) {
      if (failedIds.has(t.id)) continue
      ctx.store.deleteTask(t.id)
      deletedTasks += 1
    }
    if (failed.length) {
      const names = failed.map((item) => `「${item.title}」（${item.reason}）`).join('、')
      throw new TaskError(
        `项目「${project.name}」未删除：${names} 的 worktree 删除失败；已清理 ${deletedWorktrees} 个 worktree、${deletedTasks} 条任务记录，请修复后重试`,
        409,
        'partial-delete',
      )
    }
    ctx.store.deleteProject(id)
    return { deletedTasks, deletedWorktrees }
  })
}

/** Resolve the owning project for a publish: explicit id, repo match, or create. */
async function ensureProject(ctx: RuntimeContext, input: PublishInput): Promise<Project> {
  if (input.projectId) {
    const project = ctx.store.getProject(input.projectId)
    if (!project) throw new TaskError(`项目不存在：${input.projectId}`, 404)
    return project
  }
  const repoPath = absPath(input.repoPath || '')
  if (!input.repoPath) throw new TaskError('缺少 projectId 或 repoPath')
  const found = ctx.store.findProjectByRepo(repoPath)
  if (found) return found
  return addProject(ctx, { repoPath })
}

export async function taskViews(ctx: RuntimeContext, opts: { includeArchived?: boolean } = {}): Promise<TaskView[]> {
  const tasks = ctx.store.listTasks().filter((t) => opts.includeArchived || !t.archivedAt)
  return Promise.all(tasks.map(async (task) => ({ task, snapshot: await ctx.snapshot(task) })))
}

/**
 * Aggregate the board's left column: every project with its task views.
 * Archived tasks are filtered out by default; pass `includeArchived` for the
 * board's "show archived" toggle.
 */
export async function projectViews(ctx: RuntimeContext, opts: { includeArchived?: boolean } = {}): Promise<ProjectView[]> {
  const views = await taskViews(ctx, { includeArchived: opts.includeArchived })
  const byId = new Map<string, ProjectView>()
  const orphans: TaskView[] = []
  for (const p of ctx.store.listProjects()) {
    byId.set(p.id, { project: p, stats: { tasks: 0, byStatus: {}, running: 0 }, tasks: [] })
  }
  for (const v of views) {
    const bucket = v.task.projectId ? byId.get(v.task.projectId) : undefined
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
    // Pinned first, then priority, then newest-created: pinning and priority
    // are presentation bits and must not reorder anything else.
    b.tasks.sort((x, y) => compareTaskOrder(x.task, y.task))
    b.stats.tasks = b.tasks.length
    for (const v of b.tasks) {
      const s = v.snapshot.status
      b.stats.byStatus[s] = (b.stats.byStatus[s] || 0) + 1
    }
    b.stats.running = b.tasks.filter((v) => v.snapshot.status === 'developing').length
  }
  return out.sort((a, b) => a.project.name.localeCompare(b.project.name))
}

/** Best-effort facts about a merged task: what it merged, and what came after. */
async function parentPromptInfo(ctx: RuntimeContext, parent: WorktreeTask, base: string): Promise<ParentPromptInfo> {
  const repo = parent.repoPath
  let mergedCommits: gitx.CommitLine[] = []
  let mergedFiles: string[] = []
  if (parent.mergedCommit && parent.mergedBranchTip) {
    mergedCommits = await gitx.logOneline(ctx.gitPath, repo, `${parent.mergedCommit}^1..${parent.mergedBranchTip}`, 30)
    mergedFiles = await gitx.diffNameOnly(ctx.gitPath, repo, `${parent.mergedCommit}^1`, parent.mergedBranchTip)
  } else if (await gitx.branchExists(ctx.gitPath, repo, parent.branch)) {
    mergedCommits = await gitx.logOneline(ctx.gitPath, repo, parent.branch, 20)
    mergedFiles = await gitx.diffNameOnly(ctx.gitPath, repo, base, parent.branch)
  }
  let leftoverCommits: gitx.CommitLine[] = []
  let leftoverRange: string | undefined
  if (await gitx.branchExists(ctx.gitPath, repo, parent.branch)) {
    const mb = await gitx.mergeBase(ctx.gitPath, repo, base, parent.branch)
    if (mb) {
      leftoverCommits = await gitx.logOneline(ctx.gitPath, repo, `${mb}..${parent.branch}`, 20)
      if (leftoverCommits.length) leftoverRange = `${mb}..${parent.branch}`
    }
  }
  return { id: parent.id, title: parent.title, branch: parent.branch, mergedCommits, mergedFiles, leftoverCommits, leftoverRange }
}

/**
 * Validate that a predecessor task's merged changes really are in `base`.
 * Returns the resolved parent plus the facts the follow-up prompt needs.
 */
async function loadContinuableParent(
  ctx: RuntimeContext,
  parentId: string,
  repoPath: string,
  base: string,
): Promise<{ parent: WorktreeTask; info: ParentPromptInfo }> {
  const parent = ctx.store.getTask(parentId)
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
  if (!(await gitx.isAncestor(ctx.gitPath, repoPath, ref, base))) {
    throw new TaskError(`所选基线 ${base} 未包含前序任务已合并的成果。请改选原合并目标 ${parent.baseBranch}，或改为普通任务发布。`)
  }
  return { parent, info: await parentPromptInfo(ctx, parent, base) }
}

export async function publishTask(ctx: RuntimeContext, input: PublishInput): Promise<WorktreeTask> {
  if (!input.title?.trim()) throw new TaskError('任务标题不能为空')
  if (!input.description?.trim()) throw new TaskError('任务描述不能为空')
  const model = input.model === undefined ? undefined : normalizeModelSelection(input.model)
  if (input.model !== undefined && model === undefined) throw new TaskError('模型选择无效')
  const acceptanceCriteria = normalizeCriteria(input.acceptanceCriteria || [])
  // Validate metadata before creating a project, branch or worktree: a bad
  // tag must not leave a half-published task behind.
  const tags = normalizeTags(input.tags === undefined ? [] : input.tags)
  const tagCheck = validateTags(tags)
  if (!tagCheck.ok) {
    throw new TaskError(tagCheck.error === 'too-many' ? '标签最多 8 个' : '单个标签最多 24 个字符')
  }
  const priority = normalizePriority(input.priority)
  if (input.priority !== undefined && priority === undefined) {
    throw new TaskError('优先级只能是 low、normal 或 high')
  }
  const due = input.dueAt === undefined ? null : parseDueAt(input.dueAt)
  if (due && !due.ok) throw new TaskError('截止日期无效')
  const estimate = input.estimate === undefined ? null : parseEstimate(input.estimate)
  if (estimate && !estimate.ok) throw new TaskError('规模估算只能是 1、2、3、5 或 8 点')

  const project = await ensureProject(ctx, input)
  const repoPath = project.repoPath
  if (!(await gitx.isRepo(ctx.gitPath, repoPath))) {
    throw new TaskError(`目标目录不是 git 仓库工作区：${repoPath}`)
  }

  const { current, default: defaultBranch } = await gitx.listBranches(ctx.gitPath, repoPath)
  // When continuing, the baseline defaults to the predecessor's actual merge
  // target (never the current project default, which may have moved on).
  const parentRecord = input.parentId ? ctx.store.getTask(input.parentId) : undefined
  if (input.parentId && !parentRecord) throw new TaskError(`前序任务不存在：${input.parentId}`, 404)
  const base = (input.baseBranch || (parentRecord && parentRecord.baseBranch) || project.baseBranch || current || defaultBranch || '').trim()
  if (!base || !(await gitx.branchExists(ctx.gitPath, repoPath, base))) {
    throw new TaskError(`基线分支不存在：${base || '(未指定)'}`)
  }

  let parentInfo: ParentPromptInfo | undefined
  let parentId: string | undefined
  if (input.parentId) {
    const loaded = await loadContinuableParent(ctx, input.parentId, repoPath, base)
    parentInfo = loaded.info
    parentId = loaded.parent.id
    if (!input.carryLeftover) {
      // Default: continue from what was merged; do not silently migrate newer commits.
      parentInfo.leftoverCommits = []
      parentInfo.leftoverRange = undefined
    }
  }

  const eff = effectiveConfig(ctx, project)
  const id = randomUUID()
  const short = id8(id)
  const wanted = (input.branchName?.trim() || `${eff.branchPrefix}${short}`).trim()
  assertTaskBranchName(wanted)
  const branch = await gitx.uniqueBranchName(ctx.gitPath, repoPath, wanted)
  const external = isExternalWorktreeDir(eff.dirName)
  // External roots mirror T3 Code: <root>/<project>/<id8>, never inside the
  // repo. A relative dirName keeps the legacy in-repo placement.
  const preferred = external
    ? join(absPath(eff.dirName), worktreeProjectSegment(project.name), short)
    : join(repoPath, eff.dirName, short)
  // `git worktree add` refuses an existing directory, and a leftover from an
  // interrupted publish (or a manual copy) would otherwise block the task. Pick
  // a free sibling instead of failing: dirs are never shared between tasks.
  let worktreePath = preferred
  for (let attempt = 0; await pathExists(worktreePath); attempt += 1) {
    if (attempt >= 4) throw new TaskError(`worktree 目录已被占用且无法自动改名：${preferred}`)
    worktreePath = `${preferred}-${id8(randomUUID()).slice(0, 4)}`
  }

  await fs.mkdir(dirname(worktreePath), { recursive: true })
  try {
    await gitx.worktreeAdd(ctx.gitPath, repoPath, worktreePath, branch, base)
  } catch (error) {
    // Remove only the empty shell we just created; never user content.
    await fs.rmdir(worktreePath).catch(() => {})
    throw error
  }
  // Only an in-repo worktree can show up as untracked in the main repo.
  if (!external) await gitx.ensureExclude(ctx.gitPath, repoPath, eff.dirName)

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
    ...(tags.length ? { tags } : {}),
    ...(priority && priority !== 'normal' ? { priority } : {}),
    ...(due && due.ok && due.value !== null ? { dueAt: due.value } : {}),
    ...(estimate && estimate.ok && estimate.value !== null ? { estimate: estimate.value } : {}),
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
  ctx.store.putTask(task)
  ctx.store.addRecent(repoPath)
  return task
}
