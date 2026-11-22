/**
 * Merge preflight, dry-run preview cache, journaled merge execution,
 * post-merge restore, and crash reconciliation.
 */

import { randomUUID } from 'node:crypto'
import * as gitx from '../gitx.js'
import { MergeBlocker, MergeBlockingFile, MergeConflictInfo, MergePreflight, MergePreview, WorktreeTask } from '../models.js'
import { conflictFiles, id8 } from './prompt.js'
import { buildSwitchPreflight } from './review.js'
import {
  addPendingStash,
  assertAgentIdle,
  assertNoInProgress,
  dirtySummary,
  MergeOptions,
  needTask,
  otherReviewingTask,
  repoIdentity,
  repoKey,
  RuntimeContext,
  TaskError,
  withRepoLock,
} from './types.js'

export async function mergePreflight(
  ctx: RuntimeContext,
  id: string,
  opts: { switchToBase?: boolean; restoreAfter?: boolean } = {},
): Promise<MergePreflight> {
  const task = needTask(ctx, id)
  return buildMergePreflight(ctx, task, opts)
}

/**
 * Collect everything that decides whether (and how) a merge can run. Read-only
 * except for an index refresh; never mutates branches or the worktree. This is
 * the single source of truth used by the dialog, the merge endpoint and tools.
 */
async function buildMergePreflight(
  ctx: RuntimeContext,
  task: WorktreeTask,
  opts: { switchToBase?: boolean; restoreAfter?: boolean; internal?: boolean },
): Promise<MergePreflight> {
  const repoPath = task.repoPath
  const blockers: MergeBlocker[] = []
  const blockingFiles: MergeBlockingFile[] = []
  const seen = new Set<string>()
  const push = (code: string, message: string): void => {
    if (seen.has(code)) return
    seen.add(code)
    blockers.push({ code, message })
  }
  const curBranch = await gitx.currentBranch(ctx.gitPath, repoPath)
  const headSha = await gitx.revParse(ctx.gitPath, repoPath, 'HEAD')
  const tipSha = await gitx.revParse(ctx.gitPath, repoPath, task.branch)
  const baseSha = task.baseBranch ? await gitx.revParse(ctx.gitPath, repoPath, task.baseBranch) : null
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
    assertAgentIdle(ctx, task)
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
    ahead = await gitx.countCommits(ctx.gitPath, repoPath, `${task.baseBranch}..${task.branch}`)
  } catch {
    ahead = 0
  }
  if (ahead === 0) push('nothing-ahead', '没有领先基线的提交，无需合并')

  const wtDirty = await dirtySummary(ctx, task.worktreePath)
  if (wtDirty.count > 0) push('worktree-dirty', `worktree 有 ${wtDirty.count} 处未提交改动（${wtDirty.shown}），这些改动不会被合并；请先让 Agent 提交`)

  const prog = await gitx.inProgress(ctx.gitPath, repoPath)
  if (prog) push('in-progress', `主仓库有未完成的 ${prog} 操作，请先处理`)

  if (!opts.internal && ctx.gitOps.get(repoKey(repoPath))) push('repo-busy', '主仓库正在执行其他 Git 操作，请等待完成')

  // Files that would block switching the main repo to the base branch.
  if (headSha && baseSha) {
    const sw = await buildSwitchPreflight(ctx, repoPath, baseSha)
    for (const obstacle of sw.obstacles) blockingFiles.push({ path: obstacle.path, untracked: obstacle.kind === 'untracked' })
  }
  const repoDirtyCount = (await gitx.statusEntries(ctx.gitPath, repoPath, true)).length
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
      const baseHeld = (await gitx.worktreeList(ctx.gitPath, repoPath)).find(
        (entry) => entry.branch === task.baseBranch && repoKey(entry.path) !== repoKey(repoPath),
      )
      if (baseHeld) push('base-checked-out-elsewhere', `基线分支 ${task.baseBranch} 正被 worktree「${baseHeld.path}」检出，无法切换后合并`)
      const other = otherReviewingTask(ctx, task, curBranch, headSha)
      if (other) push('other-reviewing', `任务「${other.title}」正在验收，请先切回原分支再操作`)
    }
  }

  // Conflict dry-run (only when there is something to merge and the repo is idle).
  if (ahead > 0 && (opts.internal || !ctx.gitOps.get(repoKey(repoPath)))) {
    const pre = await runMergePreview(ctx, task, tipSha, baseSha)
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

export async function mergeTask(ctx: RuntimeContext, id: string, opts: MergeOptions = {}): Promise<WorktreeTask> {
  const task = needTask(ctx, id)
  return withRepoLock(ctx, task.repoPath, '合并', () => mergeLocked(ctx, task, opts))
}

async function mergeLocked(ctx: RuntimeContext, task: WorktreeTask, opts: MergeOptions = {}): Promise<WorktreeTask> {
  if (task.cleanedAt) throw new TaskError('worktree 已清理，分支若仍在可手动合并')
  assertAgentIdle(ctx, task)
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
  if (!(await gitx.branchExists(ctx.gitPath, repoPath, task.branch))) {
    throw new TaskError(`任务分支不存在：${task.branch}`)
  }
  await assertNoInProgress(ctx, repoPath)

  const cur = await gitx.currentBranch(ctx.gitPath, repoPath)
  const headSha = await gitx.revParse(ctx.gitPath, repoPath, 'HEAD')
  const originalRef = { branch: cur, sha: headSha }
  // Step 1: write the intent (journal) before touching anything.
  task.pendingOp = {
    operationId: randomUUID(),
    kind: 'merge',
    taskId: task.id,
    repoIdentity: await repoIdentity(ctx, repoPath),
    step: 'preflight',
    originalRef,
    expectedTip: opts.expectedTip || null,
    expectedBase: opts.expectedBase || null,
    recoveryStatus: 'pending',
    startedAt: Date.now(),
  }
  ctx.store.putTask(task)

  let stashRef: string | undefined
  let switched = false
  let mergeCommitted = false
  try {
    // Step 2: re-run the preflight under the lock; refuse on any hard blocker.
    const pf = await buildMergePreflight(ctx, task, { switchToBase, restoreAfter, internal: true })
    if (pf.blockers.some((b) => b.code === 'conflict')) {
      const b = pf.blockers.find((x) => x.code === 'conflict')!
      throw new TaskError(b.message, 409, 'conflict')
    }
    const hard = pf.blockers.filter((b) => b.code !== 'dirty-blocks-switch')
    if (hard.length) {
      const b = hard[0]!
      const status = b.code === 'repo-busy' || b.code === 'base-checked-out-elsewhere' || b.code === 'other-reviewing' ? 409 : 412
      throw new TaskError(b.message, status, b.code)
    }
    if (pf.blockers.some((b) => b.code === 'dirty-blocks-switch')) {
      if (dirtyStrategy !== 'stash') {
        const b = pf.blockers.find((x) => x.code === 'dirty-blocks-switch')!
        throw new TaskError(b.message, 409, 'dirty-blocks-switch')
      }
      // Step 3: stash the blocking changes, recording the stash by SHA.
      task.pendingOp.step = 'stash'
      task.pendingOp.updatedAt = Date.now()
      ctx.store.putTask(task)
      const message = `dsh-wt:${id8(task.id)}:merge:${Date.now()}`
      try {
        stashRef = await gitx.stashPushSha(ctx.gitPath, repoPath, message)
      } catch (error) {
        throw new TaskError(`保存到 stash 失败：${error instanceof Error ? error.message : String(error)}`, 409, 'stash-failed')
      }
      task.pendingOp.stashRef = stashRef
      task.pendingOp.updatedAt = Date.now()
      ctx.store.putTask(task)
      addPendingStash(task, {
        sha: stashRef,
        source: 'merge',
        ref: message,
        createdAt: Date.now(),
        files: await gitx.stashFiles(ctx.gitPath, repoPath, stashRef),
      })
      ctx.store.putTask(task)
    }

    // Step 4: switch to the base branch when needed.
    const before = await gitx.currentBranch(ctx.gitPath, repoPath)
    if (before !== task.baseBranch) {
      task.pendingOp.step = 'switch'
      task.pendingOp.updatedAt = Date.now()
      ctx.store.putTask(task)
      try {
        await gitx.switchBranch(ctx.gitPath, repoPath, task.baseBranch)
        switched = true
      } catch (error) {
        const nowRef = await gitx.currentBranch(ctx.gitPath, repoPath)
        if (nowRef === task.baseBranch) switched = true
        else throw new TaskError(`切换到基线分支失败：${error instanceof Error ? error.message : String(error)}`, 409, 'switch-failed')
      }
    }

    // Step 5: verify SHAs + conflict check on the current state.
    task.pendingOp.step = 'verify'
    task.pendingOp.updatedAt = Date.now()
    ctx.store.putTask(task)
    const curTip = await gitx.revParse(ctx.gitPath, repoPath, task.branch)
    const curBase = await gitx.revParse(ctx.gitPath, repoPath, task.baseBranch)
    const pre = await runMergePreview(ctx, task, curTip, curBase)
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
    ctx.store.putTask(task)
    try {
      await gitx.mergeNoFF(ctx.gitPath, repoPath, mergeSha, opts.timeoutMs)
    } catch (error) {
      const err = error as any
      const text = error instanceof Error ? error.message : String(error)
      await gitx.mergeAbort(ctx.gitPath, repoPath)
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
    const mergeCommit = await gitx.revParse(ctx.gitPath, repoPath, 'HEAD')
    task.mergedAt = Date.now()
    task.mergedBranchTip = mergeSha
    if (mergeCommit) task.mergedCommit = mergeCommit
    if (cur && cur !== task.branch && !task.originalBranch) task.originalBranch = cur
    // Record the merge result BEFORE restoring: a repeat request must restore,
    // never merge again.
    task.pendingOp.step = 'merge-committed'
    task.pendingOp.mergeCommit = mergeCommit || null
    task.pendingOp.updatedAt = Date.now()
    ctx.store.putTask(task)

    // Step 7: restore the original branch/commit (optional).
    if (switched && restoreAfter) {
      task.pendingOp.step = 'restore'
      task.pendingOp.updatedAt = Date.now()
      ctx.store.putTask(task)
      try {
        if (originalRef.branch) await gitx.switchBranch(ctx.gitPath, repoPath, originalRef.branch)
        else if (originalRef.sha) await gitx.checkoutDetach(ctx.gitPath, repoPath, originalRef.sha)
        else throw new Error('原分支与原提交都不可用')
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        ctx.partials.set(task.id, { restoreFailed: true, reason })
        // Keep pendingOp so startup reconcile (or a manual restore) can retry.
        return task
      }
    }
    // Whole operation complete.
    task.pendingOp = undefined
    ctx.store.putTask(task)
    return task
  } catch (error) {
    // A failure before the merge commit: restore the original branch if we had
    // switched, then clear the journal (the stash record stays available).
    if (!mergeCommitted && switched) {
      try {
        if (originalRef.branch) await gitx.switchBranch(ctx.gitPath, repoPath, originalRef.branch)
        else if (originalRef.sha) await gitx.checkoutDetach(ctx.gitPath, repoPath, originalRef.sha)
      } catch {
        /* stay on base, reconcile will retry */
      }
    }
    if (!mergeCommitted && task.pendingOp) {
      task.pendingOp = undefined
      ctx.store.putTask(task)
    }
    throw error
  }
}

/** Retry restoring the original branch after a committed merge (never re-merges). */
export async function restoreAfterMerge(ctx: RuntimeContext, id: string): Promise<WorktreeTask> {
  const task = needTask(ctx, id)
  return withRepoLock(ctx, task.repoPath, '恢复原分支', () => restoreAfterMergeLocked(ctx, task))
}

async function restoreAfterMergeLocked(ctx: RuntimeContext, task: WorktreeTask): Promise<WorktreeTask> {
  const op = task.pendingOp
  if (!op || !op.mergeCommit) throw new TaskError('没有待恢复的合并操作', 409, 'not-committed')
  const repoPath = task.repoPath
  const target = op.originalRef.branch || op.originalRef.sha
  if (!target) throw new TaskError('原分支与原提交都不可用，无法恢复', 409, 'no-target')
  if (op.originalRef.branch) await gitx.switchBranch(ctx.gitPath, repoPath, op.originalRef.branch)
  else await gitx.checkoutDetach(ctx.gitPath, repoPath, op.originalRef.sha as string)
  task.pendingOp = undefined
  ctx.partials.delete(task.id)
  ctx.store.putTask(task)
  return task
}

/**
 * Reconcile journals left behind by a crash/restart. Only journals whose repo
 * identity matches the live repo are touched; anything else is flagged for
 * manual handling. Uses the real Git state as the source of truth.
 */
export async function reconcilePendingOps(
  ctx: RuntimeContext,
): Promise<Array<{ taskId: string; status: 'recovered' | 'needs-manual'; message: string }>> {
  const out: Array<{ taskId: string; status: 'recovered' | 'needs-manual'; message: string }> = []
  for (const task of ctx.store.listTasks()) {
    const op = task.pendingOp
    if (!op) continue
    try {
      const result = await reconcileOne(ctx, task)
      out.push({ taskId: task.id, ...result })
    } catch (error) {
      task.pendingOp = { ...op, recoveryStatus: 'needs-manual', updatedAt: Date.now() }
      ctx.store.putTask(task)
      out.push({ taskId: task.id, status: 'needs-manual', message: error instanceof Error ? error.message : String(error) })
    }
  }
  return out
}

async function reconcileOne(ctx: RuntimeContext, task: WorktreeTask): Promise<{ status: 'recovered' | 'needs-manual'; message: string }> {
  const op = task.pendingOp!
  const repoPath = task.repoPath
  // Prove ownership before touching anything.
  const identity = await repoIdentity(ctx, repoPath).catch(() => null)
  if (!identity || identity !== op.repoIdentity) {
    task.pendingOp = { ...op, recoveryStatus: 'needs-manual', updatedAt: Date.now() }
    ctx.store.putTask(task)
    return { status: 'needs-manual', message: '仓库身份不匹配，需人工确认' }
  }

  // Ensure a recorded stash is present on the task (never auto-apply).
  if (op.stashRef && !(task.pendingStashes || []).some((s) => s.sha === op.stashRef)) {
    const exists = (await gitx.stashListEntries(ctx.gitPath, repoPath)).some((s) => s.sha === op.stashRef)
    addPendingStash(task, {
      sha: op.stashRef,
      source: 'merge',
      ref: `dsh-wt:${id8(task.id)}:merge`,
      createdAt: op.startedAt,
      files: exists ? await gitx.stashFiles(ctx.gitPath, repoPath, op.stashRef) : [],
      unverified: !exists,
    })
  }

  // A committed merge: only the restore may be incomplete.
  if (op.mergeCommit) {
    const restored = await tryRestoreOriginal(ctx, task, op.originalRef)
    if (!restored) {
      task.pendingOp = { ...op, recoveryStatus: 'needs-manual', updatedAt: Date.now() }
      ctx.store.putTask(task)
      return { status: 'needs-manual', message: '合并已提交但无法切回原分支，需人工切回' }
    }
    task.pendingOp = undefined
    ctx.partials.delete(task.id)
    ctx.store.putTask(task)
    return { status: 'recovered', message: '已恢复原分支' }
  }

  // Pre-merge: clean up any partial merge, then recognise completion or switch back.
  if (await gitx.hasMergeHead(ctx.gitPath, repoPath)) await gitx.mergeAbort(ctx.gitPath, repoPath)

  let mergedNow = false
  if (op.expectedTip) {
    try {
      mergedNow = await gitx.isAncestor(ctx.gitPath, repoPath, op.expectedTip, task.baseBranch)
    } catch {
      mergedNow = false
    }
  }
  if (mergedNow) {
    task.mergedAt = task.mergedAt || Date.now()
    task.mergedBranchTip = op.expectedTip || undefined
    const head = await gitx.revParse(ctx.gitPath, repoPath, task.baseBranch)
    if (head) task.mergedCommit = head
    const restored = await tryRestoreOriginal(ctx, task, op.originalRef)
    task.pendingOp = undefined
    ctx.store.putTask(task)
    return restored
      ? { status: 'recovered', message: '补记合并结果并恢复原分支' }
      : { status: 'needs-manual', message: '已补记合并结果，但未能切回原分支' }
  }

  const restored = await tryRestoreOriginal(ctx, task, op.originalRef)
  task.pendingOp = undefined
  ctx.store.putTask(task)
  return restored
    ? { status: 'recovered', message: '已清理未完成的合并并恢复原分支' }
    : { status: 'needs-manual', message: '未能切回原分支，需人工处理' }
}

/** Try to put the main repo back on the journal's original branch/commit. */
async function tryRestoreOriginal(
  ctx: RuntimeContext,
  task: WorktreeTask,
  originalRef: { branch: string | null; sha: string | null },
): Promise<boolean> {
  const repoPath = task.repoPath
  try {
    const cur = await gitx.currentBranch(ctx.gitPath, repoPath)
    const head = await gitx.revParse(ctx.gitPath, repoPath, 'HEAD')
    if (originalRef.branch) {
      if (cur === originalRef.branch) return true
      await gitx.switchBranch(ctx.gitPath, repoPath, originalRef.branch)
      return true
    }
    if (originalRef.sha) {
      if (head === originalRef.sha) return true
      await gitx.checkoutDetach(ctx.gitPath, repoPath, originalRef.sha)
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
export async function mergePreview(ctx: RuntimeContext, id: string, opts: { force?: boolean } = {}): Promise<MergePreview> {
  const task = needTask(ctx, id)
  const tip = await gitx.revParse(ctx.gitPath, task.repoPath, task.branch)
  const baseSha = task.baseBranch ? await gitx.revParse(ctx.gitPath, task.repoPath, task.baseBranch) : null
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
  if (!(await gitx.branchExists(ctx.gitPath, task.repoPath, task.branch))) {
    return { ...empty, reason: 'branch-missing' }
  }
  // Cache keyed purely by (task, tip, base): if neither tip moved the dry-run
  // result is still valid no matter how much wall-clock time passed. `force`
  // bypasses it so the merge dialog can insist on a fresh check.
  const cached = ctx.previewCache.get(task.id)
  if (!opts.force && cached && cached.tip === tip && cached.base === baseSha) {
    return { ...cached.result, cached: true }
  }
  // Never spawn git while another git action holds this repo; a cached result
  // is still safe to show, otherwise report busy.
  if (ctx.gitOps.get(repoKey(task.repoPath))) {
    if (cached) return { ...cached.result, cached: true }
    return { ...empty, reason: 'busy' }
  }
  return runMergePreview(ctx, task, tip, baseSha)
}

/**
 * Run the merge dry-run and cache it by (task, tip, base). Split out from
 * `mergePreview` so the merge path can recompute while it holds the repo lock
 * (which would otherwise look like "busy").
 */
async function runMergePreview(ctx: RuntimeContext, task: WorktreeTask, tip: string | null, baseSha: string | null): Promise<MergePreview> {
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
    ctx.previewCache.set(task.id, { tip, base: baseSha, at: checkedAt, result: out })
    return out
  }
  const mergeBase = await gitx.mergeBase(ctx.gitPath, task.repoPath, task.baseBranch, task.branch)
  if (!mergeBase) return remember({ ...base, applicable: true, reason: 'no-merge-base' })

  const [baseAhead, baseFiles, taskFiles] = await Promise.all([
    gitx.countCommits(ctx.gitPath, task.repoPath, `${mergeBase}..${task.baseBranch}`),
    gitx.diffNameOnly(ctx.gitPath, task.repoPath, mergeBase, task.baseBranch),
    gitx.diffNameOnly(ctx.gitPath, task.repoPath, mergeBase, task.branch),
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
  const check = await gitx.mergeTreeCheck(ctx.gitPath, task.repoPath, task.baseBranch, task.branch)
  preview.supported = check.supported
  preview.checked = check.supported && !check.error
  preview.conflict = check.conflict
  preview.conflictFiles = check.files
  if (check.error) preview.error = check.error
  return remember(preview)
}
