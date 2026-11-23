/**
 * Task lifecycle facade: coordinates projects, publishing, snapshots, diffs,
 * acceptance review switching, stashes, journaled merges, and cleanup.
 * Implementation submodules live under `./runtime/*`.
 */

import { join } from 'node:path'
import { normalizeCriteria } from './criteria.js'
import * as gitx from './gitx.js'
import { MergePreflight, MergePreview, Project, ProjectView, TaskDiff, TaskSnapshot, TaskStatus, TaskTemplate, TaskView, WorktreeConfig, WorktreeTask } from './models.js'
import { Store, TaskMetaPatch } from './store.js'
import { taskDiff } from './runtime/diff.js'
import { archiveTask, bindTask, cleanupTask, deleteTask, setCriterionChecked as setCriterionCheckedTask, unarchiveTask, unbindTaskBySession } from './runtime/lifecycle.js'
import { mergePreflight, mergePreview, mergeTask, reconcilePendingOps, restoreAfterMerge } from './runtime/merge.js'
import { addProject, deleteProject, projectViews, publishTask, taskViews, updateProject } from './runtime/projects.js'
import { applyStash, backPreflight, backTask, checkoutPreflight, checkoutTask, dropStash, migrateLegacyStashes, stashDiff } from './runtime/review.js'
import { computeSnapshot, statusOf } from './runtime/snapshot.js'
import {
  absPath,
  AddProjectInput,
  effectiveConfig,
  MergeOptions,
  PreviewCacheEntry,
  PublishInput,
  repoIdentity,
  RuntimeContext,
  SwitchPreflight,
  SwitchStrategy,
  TaskError,
} from './runtime/types.js'

export { buildFirstPrompt } from './runtime/prompt.js'
export {
  AddProjectInput,
  MergeOptions,
  ParentPromptInfo,
  PublishInput,
  SwitchObstacle,
  SwitchPreflight,
  SwitchStrategy,
  TaskError,
} from './runtime/types.js'

export class Runtime {
  private readonly ctx: RuntimeContext
  readonly gitPath: string
  private envInfo: { gitVersion: string | null; mergeTreeSupported: boolean; longPaths: boolean | null } | null = null

  constructor(deps: {
    store: Store
    config: WorktreeConfig
    sessionState?: (sessionId: string) => 'running' | 'idle' | 'unknown'
    /** Override for tests; defaults next to the shared task store. */
    repoLockDir?: string
  }) {
    this.gitPath = deps.config.gitPath
    const gitOps = new Map<string, string>()
    const opWarnings = new Map<string, string>()
    const partials = new Map<string, { restoreFailed: boolean; reason: string }>()
    const previewCache = new Map<string, PreviewCacheEntry>()
    const sessionState = deps.sessionState || (() => 'idle')
    this.ctx = {
      store: deps.store,
      config: deps.config,
      gitPath: deps.config.gitPath,
      gitOps,
      repoLockDir: deps.repoLockDir || join(deps.store.directory(), 'repo-locks'),
      opWarnings,
      partials,
      previewCache,
      sessionState,
      snapshot: (task: WorktreeTask) => this.snapshot(task),
    }
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
    const warning = this.ctx.opWarnings.get(id)
    if (warning) this.ctx.opWarnings.delete(id)
    return warning
  }

  /** Read and clear the one-shot partial-success marker for the last merge. */
  takePartial(id: string): { restoreFailed: boolean; reason: string } | undefined {
    const partial = this.ctx.partials.get(id)
    if (partial) this.ctx.partials.delete(id)
    return partial
  }

  async repoInfo(dir: string): Promise<{ current: string | null; default: string | null }> {
    if (!(await gitx.isRepo(this.gitPath, dir))) {
      throw new TaskError(`目录不是 git 仓库工作区：${dir}`)
    }
    const { current, default: def } = await gitx.listBranches(this.gitPath, dir)
    return { current, default: def }
  }

  async branches(dir: string): Promise<{ branches: Array<{ name: string; current: boolean }>; current: string | null; default: string | null }> {
    const d = absPath(dir)
    if (!(await gitx.isRepo(this.gitPath, d))) {
      throw new TaskError(`目录不是 git 仓库工作区：${d}`)
    }
    return gitx.listBranches(this.gitPath, d)
  }

  /** Effective per-project worktree knobs (project override > global config). */
  effective(project: Project | undefined) {
    return effectiveConfig(this.ctx, project)
  }

  // ---- projects ----

  addProject(input: AddProjectInput): Promise<Project> {
    return addProject(this.ctx, input)
  }

  updateProject(id: string, patch: { name?: string; baseBranch?: string; dirName?: string; branchPrefix?: string; mergeGate?: 'off' | 'criteria' }): Promise<Project> {
    return updateProject(this.ctx, id, patch)
  }

  deleteProject(id: string, opts: { withTasks?: boolean; withWorktrees?: boolean }): Promise<{ deletedTasks: number; deletedWorktrees: number }> {
    return deleteProject(this.ctx, id, opts)
  }

  projectViews(opts: { includeArchived?: boolean } = {}): Promise<ProjectView[]> {
    return projectViews(this.ctx, opts)
  }

  // ---- acceptance criteria library ----

  listAcceptanceCriteria(): string[] {
    return this.ctx.store.listCriteria()
  }

  addAcceptanceCriteria(values: string[]): string[] {
    return this.ctx.store.addCriteria(normalizeCriteria(values))
  }

  removeAcceptanceCriterion(text: string): string[] {
    return this.ctx.store.removeCriterion(String(text || '').trim())
  }

  setAcceptanceCriteria(values: string[]): string[] {
    return this.ctx.store.setCriteria(normalizeCriteria(values))
  }

  /** Check or uncheck one criterion on a task; 404 / 400 on missing task / criterion. */
  setCriterionChecked(id: string, text: string, checked: boolean): WorktreeTask {
    return setCriterionCheckedTask(this.ctx, id, text, checked)
  }

  // ---- publish templates ----

  listTaskTemplates(): TaskTemplate[] {
    return this.ctx.store.listTemplates()
  }

  saveTaskTemplate(input: { id?: string; name: string; title?: string; description?: string; criteria?: string[] }): TaskTemplate[] {
    const name = String((input && input.name) || '').trim()
    if (!name) throw new TaskError('模板名称不能为空')
    const result = this.ctx.store.saveTemplate({ ...input, name })
    if (!result.ok) throw new TaskError(`模板不存在：${String(input.id || '')}`, 404)
    return result.templates
  }

  deleteTaskTemplate(id: string): TaskTemplate[] {
    return this.ctx.store.deleteTemplate(String(id || '').trim())
  }

  /** Pin or unpin a task; 404 when the task row is gone. */
  setTaskPinned(id: string, pinned: boolean): WorktreeTask {
    const result = this.ctx.store.setTaskPinned(id, pinned)
    if (!result.ok) throw new TaskError(`任务不存在：${id}`, 404)
    return result.task
  }

  /** Atomically update tags / priority / notes; unknown ids are 404s. */
  updateTaskMeta(id: string, patch: TaskMetaPatch): WorktreeTask {
    const result = this.ctx.store.updateTaskMeta(id, patch)
    if (result.ok) return result.task
    const message = result.reason === 'missing' ? `任务不存在：${id}`
      : result.reason === 'tags-too-many' ? '标签最多 8 个'
        : result.reason === 'tags-too-long' ? '单个标签最多 24 个字符'
          : result.reason === 'priority-invalid' ? '优先级只能是 low、normal 或 high'
            : '备注最多 2000 个字符'
    throw new TaskError(message, result.reason === 'missing' ? 404 : 400)
  }

  // ---- tasks, snapshots & diffs ----

  publish(input: PublishInput): Promise<WorktreeTask> {
    return publishTask(this.ctx, input)
  }

  snapshot(task: WorktreeTask): Promise<TaskSnapshot> {
    return computeSnapshot(this.ctx, task)
  }

  statusOf(task: WorktreeTask, snap: TaskSnapshot): TaskStatus {
    return statusOf(task, snap)
  }

  async view(task: WorktreeTask): Promise<TaskView> {
    return { task, snapshot: await this.snapshot(task) }
  }

  views(opts: { includeArchived?: boolean } = {}): Promise<TaskView[]> {
    return taskViews(this.ctx, opts)
  }

  diff(id: string): Promise<TaskDiff> {
    return taskDiff(this.ctx, id)
  }

  repoIdentity(repoPath: string): Promise<string> {
    return repoIdentity(this.ctx, repoPath)
  }

  // ---- review switching & stashes ----

  checkoutPreflight(id: string): Promise<SwitchPreflight> {
    return checkoutPreflight(this.ctx, id)
  }

  backPreflight(id: string): Promise<SwitchPreflight> {
    return backPreflight(this.ctx, id)
  }

  checkout(id: string, opts: { strategy?: SwitchStrategy; expectedSha?: string } = {}): Promise<WorktreeTask> {
    return checkoutTask(this.ctx, id, opts)
  }

  back(id: string, opts: { strategy?: SwitchStrategy; expectedSha?: string } = {}): Promise<WorktreeTask> {
    return backTask(this.ctx, id, opts)
  }

  migrateLegacyStashes(): Promise<number> {
    return migrateLegacyStashes(this.ctx)
  }

  applyStash(id: string, sha?: string): Promise<WorktreeTask> {
    return applyStash(this.ctx, id, sha)
  }

  stashDiff(id: string, sha?: string): Promise<{ patch: string }> {
    return stashDiff(this.ctx, id, sha)
  }

  dropStash(id: string, sha?: string): Promise<WorktreeTask> {
    return dropStash(this.ctx, id, sha)
  }

  // ---- merge, preview & crash reconciliation ----

  mergePreflight(id: string, opts: { switchToBase?: boolean; restoreAfter?: boolean } = {}): Promise<MergePreflight> {
    return mergePreflight(this.ctx, id, opts)
  }

  merge(id: string, opts: MergeOptions = {}): Promise<WorktreeTask> {
    return mergeTask(this.ctx, id, opts)
  }

  restoreAfterMerge(id: string): Promise<WorktreeTask> {
    return restoreAfterMerge(this.ctx, id)
  }

  reconcilePendingOps(): Promise<Array<{ taskId: string; status: 'recovered' | 'needs-manual'; message: string }>> {
    return reconcilePendingOps(this.ctx)
  }

  mergePreview(id: string, opts: { force?: boolean } = {}): Promise<MergePreview> {
    return mergePreview(this.ctx, id, opts)
  }

  // ---- cleanup, archive & session binding ----

  cleanup(id: string, opts: { force?: boolean; deleteBranch?: boolean; forceDeleteBranch?: boolean }): Promise<WorktreeTask> {
    return cleanupTask(this.ctx, id, opts)
  }

  archive(id: string): Promise<WorktreeTask> {
    return archiveTask(this.ctx, id)
  }

  unarchive(id: string): WorktreeTask {
    return unarchiveTask(this.ctx, id)
  }

  delete(id: string): Promise<void> {
    return deleteTask(this.ctx, id)
  }

  bind(id: string, sessionId: string): WorktreeTask {
    return bindTask(this.ctx, id, sessionId)
  }

  unbindBySession(sessionId: string): WorktreeTask | null {
    return unbindTaskBySession(this.ctx, sessionId)
  }
}
