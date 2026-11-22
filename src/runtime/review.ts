/**
 * Acceptance review switching (checkout/back), switch preflights, and stash
 * lifecycle (migration, apply, diff, drop).
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import * as gitx from '../gitx.js'
import { PendingStash, WorktreeTask } from '../models.js'
import { conflictFiles, id8 } from './prompt.js'
import {
  addPendingStash,
  assertAgentIdle,
  assertNoInProgress,
  dirtySummary,
  needTask,
  otherReviewingTask,
  RuntimeContext,
  SwitchObstacle,
  SwitchPreflight,
  SwitchStrategy,
  TaskError,
  withRepoLock,
} from './types.js'

/**
 * Which working-tree files would block `git checkout <targetSha>`?
 * Refreshes the index first so CRLF/mtime-only noise does not count as dirty.
 */
export async function buildSwitchPreflight(ctx: RuntimeContext, repoPath: string, targetSha: string | null): Promise<SwitchPreflight> {
  await gitx.updateIndexRefresh(ctx.gitPath, repoPath)
  const [currentRef, currentSha] = await Promise.all([
    gitx.currentBranch(ctx.gitPath, repoPath),
    gitx.revParse(ctx.gitPath, repoPath, 'HEAD'),
  ])
  const entries = await gitx.statusEntries(ctx.gitPath, repoPath, true)
  const changed = targetSha && currentSha ? new Set(await gitx.diffNameOnlyZ(ctx.gitPath, repoPath, currentSha, targetSha)) : new Set<string>()
  const targetTree = targetSha ? await gitx.lsTreePaths(ctx.gitPath, repoPath, targetSha) : new Set<string>()
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

/** Apply the user's choice when switching with dirty files; returns a stash record when stashed. */
async function applySwitchStrategy(
  ctx: RuntimeContext,
  task: WorktreeTask,
  repoPath: string,
  pre: SwitchPreflight,
  strategy?: SwitchStrategy,
): Promise<{ sha: string; ref: string } | undefined> {
  if (pre.safe) return undefined
  const list = pre.obstacles.map((o) => o.path).slice(0, 12).join('、')
  if (!strategy || strategy === 'abort') {
    throw new TaskError(`主仓库有 ${pre.obstacles.length} 个改动会阻止切换：${list}。请选择「暂存后切换」或「放弃改动后切换」`, 409)
  }
  if (strategy === 'stash') {
    const ref = `dsh-wt:${id8(task.id)}:review:${Date.now()}`
    const sha = await gitx.stashPushSha(ctx.gitPath, repoPath, ref)
    return { sha, ref }
  }
  // discard
  const tracked = pre.obstacles.filter((o) => o.kind === 'tracked').map((o) => o.path)
  if (tracked.length) await gitx.restorePaths(ctx.gitPath, repoPath, tracked)
  for (const item of pre.obstacles.filter((o) => o.kind === 'untracked')) {
    await fs.rm(join(repoPath, item.path), { recursive: true, force: true })
  }
  return undefined
}

/** Resolve where `back` should return to: original ref → original sha → base. */
async function resolveBackTarget(ctx: RuntimeContext, task: WorktreeTask): Promise<{ ref?: string; sha?: string }> {
  if (task.reviewOriginalRef && (await gitx.branchExists(ctx.gitPath, task.repoPath, task.reviewOriginalRef))) {
    return { ref: task.reviewOriginalRef }
  }
  if (task.reviewOriginalSha && (await gitx.revParse(ctx.gitPath, task.repoPath, task.reviewOriginalSha))) {
    return { sha: task.reviewOriginalSha }
  }
  if (task.originalBranch && (await gitx.branchExists(ctx.gitPath, task.repoPath, task.originalBranch))) {
    return { ref: task.originalBranch }
  }
  if (await gitx.branchExists(ctx.gitPath, task.repoPath, task.baseBranch)) return { ref: task.baseBranch }
  return {}
}

export async function checkoutPreflight(ctx: RuntimeContext, id: string): Promise<SwitchPreflight> {
  const task = needTask(ctx, id)
  if (task.cleanedAt) throw new TaskError('worktree 已清理，无法验收切换')
  if (!(await gitx.branchExists(ctx.gitPath, task.repoPath, task.branch))) throw new TaskError(`任务分支不存在：${task.branch}`)
  const targetSha = await gitx.revParse(ctx.gitPath, task.repoPath, task.branch)
  if (!targetSha) throw new TaskError(`无法解析任务分支：${task.branch}`)
  const pre = await buildSwitchPreflight(ctx, task.repoPath, targetSha)
  pre.targetRef = task.branch
  return pre
}

export async function backPreflight(ctx: RuntimeContext, id: string): Promise<SwitchPreflight> {
  const task = needTask(ctx, id)
  const target = await resolveBackTarget(ctx, task)
  const targetSha = target.ref ? await gitx.revParse(ctx.gitPath, task.repoPath, target.ref) : target.sha || null
  const pre = await buildSwitchPreflight(ctx, task.repoPath, targetSha)
  pre.targetRef = target.ref || target.sha || ''
  return pre
}

export async function checkoutTask(
  ctx: RuntimeContext,
  id: string,
  opts: { strategy?: SwitchStrategy; expectedSha?: string } = {},
): Promise<WorktreeTask> {
  const task = needTask(ctx, id)
  return withRepoLock(ctx, task.repoPath, '验收切换', () => checkoutLocked(ctx, task, opts))
}

async function checkoutLocked(
  ctx: RuntimeContext,
  task: WorktreeTask,
  opts: { strategy?: SwitchStrategy; expectedSha?: string } = {},
): Promise<WorktreeTask> {
  if (task.cleanedAt) throw new TaskError('worktree 已清理，无法验收切换')
  assertAgentIdle(ctx, task)
  const repoPath = task.repoPath
  await assertNoInProgress(ctx, repoPath)
  if (!(await gitx.branchExists(ctx.gitPath, repoPath, task.branch))) {
    throw new TaskError(`任务分支不存在：${task.branch}`)
  }
  const headSha = await gitx.revParse(ctx.gitPath, repoPath, 'HEAD')
  if (task.reviewSha && headSha === task.reviewSha) return task
  // Acceptance reviews committed work; uncommitted worktree edits would not be visible.
  const ahead = await gitx.countCommits(ctx.gitPath, repoPath, `${task.baseBranch}..${task.branch}`)
  if (ahead === 0) {
    const dirty = await dirtySummary(ctx, task.worktreePath)
    if (dirty.count > 0) throw new TaskError(`worktree 有 ${dirty.count} 处未提交改动（${dirty.shown}），请先让 Agent 提交后再验收`)
    throw new TaskError('还没有可验收的提交')
  }
  const wtDirty = await dirtySummary(ctx, task.worktreePath)
  if (wtDirty.count > 0) throw new TaskError(`worktree 有 ${wtDirty.count} 处未提交改动（${wtDirty.shown}），请先让 Agent 提交后再验收`)
  const reviewSha = await gitx.revParse(ctx.gitPath, repoPath, task.branch)
  if (!reviewSha) throw new TaskError(`无法解析任务分支：${task.branch}`)
  if (opts.expectedSha && opts.expectedSha !== reviewSha) throw new TaskError('任务分支已变化，请重新预检', 409)
  const originalRef = await gitx.currentBranch(ctx.gitPath, repoPath)
  const other = otherReviewingTask(ctx, task, originalRef, headSha)
  if (other) throw new TaskError(`任务「${other.title}」正在验收，请先切回原分支`, 409)
  const pre = await buildSwitchPreflight(ctx, repoPath, reviewSha)
  pre.targetRef = task.branch
  const stash = await applySwitchStrategy(ctx, task, repoPath, pre, opts.strategy)
  try {
    // Detached checkout: the task branch stays owned by the worktree only.
    await gitx.checkoutDetach(ctx.gitPath, repoPath, reviewSha)
  } catch (error) {
    // Git may have replaced some files before failing (Windows file locks).
    // Trust the real HEAD: reaching the target counts as success.
    const now = await gitx.revParse(ctx.gitPath, repoPath, 'HEAD')
    if (now !== reviewSha) throw new TaskError(`切换到验收提交失败：${error instanceof Error ? error.message : String(error)}`, 409)
  }
  task.reviewSha = reviewSha
  task.reviewOriginalRef = originalRef || undefined
  task.reviewOriginalSha = headSha || undefined
  if (originalRef) task.originalBranch = originalRef
  if (stash) {
    task.reviewStash = stash.ref
    addPendingStash(task, {
      sha: stash.sha,
      source: 'review',
      ref: stash.ref,
      createdAt: Date.now(),
      files: await gitx.stashFiles(ctx.gitPath, repoPath, stash.sha),
    })
  }
  ctx.store.putTask(task)
  return task
}

export async function backTask(
  ctx: RuntimeContext,
  id: string,
  opts: { strategy?: SwitchStrategy; expectedSha?: string } = {},
): Promise<WorktreeTask> {
  const task = needTask(ctx, id)
  return withRepoLock(ctx, task.repoPath, '切回原分支', () => backLocked(ctx, task, opts))
}

async function backLocked(
  ctx: RuntimeContext,
  task: WorktreeTask,
  opts: { strategy?: SwitchStrategy; expectedSha?: string } = {},
): Promise<WorktreeTask> {
  const repoPath = task.repoPath
  assertAgentIdle(ctx, task)
  await assertNoInProgress(ctx, repoPath)
  const headSha = await gitx.revParse(ctx.gitPath, repoPath, 'HEAD')
  const currentRef = await gitx.currentBranch(ctx.gitPath, repoPath)
  // The user moved the main repo away during review: only clear the record,
  // never force a switch over their own checkout. A branch at the same sha
  // still counts as moved (review keeps the repo detached).
  if (task.reviewSha && (headSha !== task.reviewSha || currentRef !== null)) {
    task.reviewSha = undefined
    task.reviewOriginalRef = undefined
    task.reviewOriginalSha = undefined
    ctx.store.putTask(task)
    return task
  }
  const target = await resolveBackTarget(ctx, task)
  const targetSha = target.ref ? await gitx.revParse(ctx.gitPath, repoPath, target.ref) : target.sha || null
  if (!targetSha) throw new TaskError('原分支与基线分支都不存在，无法切回')
  if (opts.expectedSha && opts.expectedSha !== targetSha) throw new TaskError('目标分支已变化，请重新预检', 409)
  const pre = await buildSwitchPreflight(ctx, repoPath, targetSha)
  pre.targetRef = target.ref || target.sha || ''
  const stash = await applySwitchStrategy(ctx, task, repoPath, pre, opts.strategy)
  try {
    if (target.ref) await gitx.switchBranch(ctx.gitPath, repoPath, target.ref)
    else await gitx.checkoutDetach(ctx.gitPath, repoPath, targetSha)
  } catch (error) {
    const nowSha = await gitx.revParse(ctx.gitPath, repoPath, 'HEAD')
    const nowRef = await gitx.currentBranch(ctx.gitPath, repoPath)
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
    addPendingStash(task, {
      sha: stash.sha,
      source: 'review',
      ref: stash.ref,
      createdAt: Date.now(),
      files: await gitx.stashFiles(ctx.gitPath, repoPath, stash.sha),
    })
  }
  if (!task.originalBranch && target.ref) task.originalBranch = target.ref
  ctx.store.putTask(task)
  return task
}

/** Choose a recorded stash (by sha when given, else the oldest). */
function pickStash(task: WorktreeTask, sha?: string): PendingStash | undefined {
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
export async function migrateLegacyStashes(ctx: RuntimeContext): Promise<number> {
  let migrated = 0
  for (const task of ctx.store.listTasks()) {
    if (!task.reviewStash) continue
    const list = Array.isArray(task.pendingStashes) ? task.pendingStashes : []
    if (!list.some((s) => s.source === 'review' && s.ref === task.reviewStash)) {
      const match = await gitx
        .stashEntryForMessage(ctx.gitPath, task.repoPath, task.reviewStash)
        .catch(() => ({ entry: null, unique: false }))
      const sha = match.unique && match.entry ? match.entry.sha : ''
      addPendingStash(task, {
        sha,
        source: 'review',
        ref: task.reviewStash,
        createdAt: task.updatedAt || Date.now(),
        files: sha ? await gitx.stashFiles(ctx.gitPath, task.repoPath, sha).catch(() => []) : [],
        unverified: !sha,
      })
    }
    task.reviewStash = undefined
    ctx.store.putTask(task)
    migrated += 1
  }
  return migrated
}

/** Apply a recorded stash (never drops it; the user must drop explicitly). */
export async function applyStash(ctx: RuntimeContext, id: string, sha?: string): Promise<WorktreeTask> {
  const task = needTask(ctx, id)
  const entry = pickStash(task, sha)
  if (!entry) throw new TaskError('没有可恢复的暂存', 404, 'stash-missing')
  if (!entry.sha) throw new TaskError('暂存记录无法唯一匹配到 stash，无法自动恢复；请手动处理', 409, 'stash-unverified')
  try {
    await gitx.stashApplyBySha(ctx.gitPath, task.repoPath, entry.sha)
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
export async function stashDiff(ctx: RuntimeContext, id: string, sha?: string): Promise<{ patch: string }> {
  const task = needTask(ctx, id)
  const entry = pickStash(task, sha)
  if (!entry || !entry.sha) return { patch: '' }
  const patch = await gitx.stashShowBySha(ctx.gitPath, task.repoPath, entry.sha)
  return { patch }
}

/** Drop a recorded stash (explicit user action; removes the record). */
export async function dropStash(ctx: RuntimeContext, id: string, sha?: string): Promise<WorktreeTask> {
  const task = needTask(ctx, id)
  const entry = pickStash(task, sha)
  if (!entry) return task
  if (entry.sha) await gitx.stashDropBySha(ctx.gitPath, task.repoPath, entry.sha)
  task.pendingStashes = (task.pendingStashes || []).filter((s) => s !== entry)
  if (task.reviewStash === entry.ref) task.reviewStash = undefined
  ctx.store.putTask(task)
  return task
}
