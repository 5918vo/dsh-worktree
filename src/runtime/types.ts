/**
 * Shared types, errors, and internal context passed to runtime submodules.
 */

import { promises as fs } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import * as gitx from '../gitx.js'
import { MergePreview, ModelSelection, PendingStash, Project, TaskSnapshot, WorktreeConfig, WorktreeTask } from '../models.js'
import { acquireRepoLock, RepoLockBusyError, type RepoLockHandle } from '../repo-lock.js'
import { Store } from '../store.js'

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
  /** Free-form tags; normalized and validated before any git work runs. */
  tags?: unknown
  /** Display priority; omitted/`normal` stores nothing. */
  priority?: unknown
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

export interface PreviewCacheEntry {
  tip: string | null
  base: string | null
  at: number
  result: MergePreview
}

/** Shared state and invariants accessed by runtime submodules. */
export interface RuntimeContext {
  readonly store: Store
  readonly config: WorktreeConfig
  readonly gitPath: string
  /** One in-flight git action per main repo, shared by chat/board/tool callers. */
  readonly gitOps: Map<string, string>
  /** Directory for cross-process repo lock files (shared by every DSH process). */
  readonly repoLockDir: string
  /** Transient (non-persisted) warnings for the next action response. */
  readonly opWarnings: Map<string, string>
  /** Transient partial-success markers (200 but not fully done), e.g. restore-failed. */
  readonly partials: Map<string, { restoreFailed: boolean; reason: string }>
  /** Reuse a merge preview while both tips are unchanged. */
  readonly previewCache: Map<string, PreviewCacheEntry>
  /** Probe a task session's run state ('idle' when no session concept exists). */
  readonly sessionState: (sessionId: string) => 'running' | 'idle' | 'unknown'
  snapshot(task: WorktreeTask): Promise<TaskSnapshot>
}

export function absPath(p: string): string {
  const expanded = p.startsWith('~') ? join(process.env.USERPROFILE || process.env.HOME || '.', p.slice(1)) : p
  return isAbsolute(expanded) ? expanded : resolve(expanded)
}

export function repoKey(repoPath: string): string {
  return repoPath.replace(/[\\/]+$/, '').toLowerCase()
}

export function effectiveConfig(ctx: RuntimeContext, project: Project | undefined) {
  return {
    dirName: project?.dirName?.trim() || ctx.config.dirName,
    branchPrefix: project?.branchPrefix?.trim() || ctx.config.branchPrefix,
  }
}

export function needTask(ctx: RuntimeContext, id: string): WorktreeTask {
  const task = ctx.store.getTask(id)
  if (!task) throw new TaskError(`任务不存在：${id}`, 404)
  return task
}

export async function dirtySummary(ctx: RuntimeContext, dir: string, includeUntracked = true): Promise<{ count: number; shown: string }> {
  const files = await gitx.dirtyFiles(ctx.gitPath, dir, includeUntracked)
  return { count: files.length, shown: files.slice(0, 5).join('、') + (files.length > 5 ? '…' : '') }
}

export async function refuseDirty(ctx: RuntimeContext, dir: string, what: string, includeUntracked = true): Promise<void> {
  const { count, shown } = await dirtySummary(ctx, dir, includeUntracked)
  if (count > 0) throw new TaskError(`${what}有 ${count} 处未提交改动（${shown}），请先处理后再操作`)
}

export function otherReviewingTask(ctx: RuntimeContext, task: WorktreeTask, cur: string | null, headSha?: string | null): WorktreeTask | null {
  const norm = (p: string) => p.replace(/[\\/]+$/, '').toLowerCase()
  return (
    ctx.store
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

export async function assertNoInProgress(ctx: RuntimeContext, repoPath: string): Promise<void> {
  const state = await gitx.inProgress(ctx.gitPath, repoPath)
  if (state) throw new TaskError(`主仓库有未完成的 ${state} 操作，请先处理后再继续`)
}

export function assertAgentIdle(ctx: RuntimeContext, task: WorktreeTask): void {
  if (!task.sessionId) return
  const state = ctx.sessionState(task.sessionId)
  if (state === 'running') throw new TaskError('Agent 正在运行，请等待其完成后再操作', 409, 'agent-running')
  if (state === 'unknown') throw new TaskError('无法确认 Agent 运行状态，已阻止该操作；请稍后重试', 409, 'agent-unknown')
}

export async function repoIdentity(ctx: RuntimeContext, repoPath: string): Promise<string> {
  const common = await gitx.gitCommonDir(ctx.gitPath, repoPath).catch(() => null)
  const base = common || repoPath
  try {
    return (await fs.realpath(base)).replace(/[\\/]+$/, '').toLowerCase()
  } catch {
    return base.replace(/[\\/]+$/, '').toLowerCase()
  }
}

export function addPendingStash(task: WorktreeTask, entry: PendingStash): void {
  const list = Array.isArray(task.pendingStashes) ? task.pendingStashes : []
  list.push(entry)
  task.pendingStashes = list
}

export async function withRepoLock<T>(ctx: RuntimeContext, repoPath: string, label: string, fn: () => Promise<T>): Promise<T> {
  const key = repoKey(repoPath)
  const active = ctx.gitOps.get(key)
  if (active) throw new TaskError(`主仓库正在执行「${active}」，请等待完成后再操作`, 409, 'repo-busy')
  ctx.gitOps.set(key, label)
  let handle: RepoLockHandle | null = null
  try {
    // The common git dir is stable across every worktree of the same repo, so
    // unrelated DSH processes contend on one lock instead of racing.
    const identity = await repoIdentity(ctx, repoPath).catch(() => key)
    try {
      handle = acquireRepoLock(ctx.repoLockDir, identity, label)
    } catch (error) {
      if (error instanceof RepoLockBusyError) {
        throw new TaskError(`主仓库正在执行「${error.label}」，请等待完成后再操作`, 409, 'repo-busy')
      }
      throw error
    }
    return await fn()
  } finally {
    if (handle) handle.release()
    if (ctx.gitOps.get(key) === label) ctx.gitOps.delete(key)
  }
}
