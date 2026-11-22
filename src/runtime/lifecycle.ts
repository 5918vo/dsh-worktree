/**
 * Task cleanup, archive/unarchive, deletion, and session binding operations.
 */

import { promises as fs } from 'node:fs'
import * as gitx from '../gitx.js'
import { WorktreeTask } from '../models.js'
import { assertAgentIdle, needTask, refuseDirty, RuntimeContext, TaskError, withRepoLock } from './types.js'

export async function cleanupTask(
  ctx: RuntimeContext,
  id: string,
  opts: { force?: boolean; deleteBranch?: boolean; forceDeleteBranch?: boolean },
): Promise<WorktreeTask> {
  const task = needTask(ctx, id)
  return withRepoLock(ctx, task.repoPath, '清理', () => cleanupLocked(ctx, task, opts))
}

async function cleanupLocked(
  ctx: RuntimeContext,
  task: WorktreeTask,
  opts: { force?: boolean; deleteBranch?: boolean; forceDeleteBranch?: boolean },
): Promise<WorktreeTask> {
  assertAgentIdle(ctx, task)
  if ((task.pendingStashes || []).length) throw new TaskError('任务还有未处理的暂存，请先恢复或丢弃后再清理 worktree', 409, 'pending-stash')
  // Never clean the working copy the main repo is currently reviewing: the
  // user would be left on a detached/branch state with no way back.
  if ((await ctx.snapshot(task)).status === 'reviewing') {
    throw new TaskError('任务正在验收中，请先切回原分支再清理 worktree', 409)
  }
  // Validate branch deletion BEFORE touching the worktree, so a refusal never
  // leaves a half-cleaned task (worktree gone, branch still there).
  let branchMerged = false
  const hasBranch = await gitx.branchExists(ctx.gitPath, task.repoPath, task.branch)
  if (opts.deleteBranch && hasBranch) {
    if (!(await gitx.branchExists(ctx.gitPath, task.repoPath, task.baseBranch))) {
      throw new TaskError(`基线分支 ${task.baseBranch} 不存在，无法判断分支是否已合并；确认丢弃请勾选「强制删除分支」`, 409)
    }
    const ahead = await gitx.countCommits(ctx.gitPath, task.repoPath, `${task.baseBranch}..${task.branch}`)
    branchMerged = ahead === 0
    if (!branchMerged && !opts.forceDeleteBranch) {
      throw new TaskError(`分支还有 ${ahead} 个提交未合并到 ${task.baseBranch}；确认丢弃这些提交请勾选「强制删除分支」`, 409)
    }
  }
  const wtExists = await fs.stat(task.worktreePath).then((s) => s.isDirectory()).catch(() => false)
  if (wtExists) {
    if (!opts.force) await refuseDirty(ctx, task.worktreePath, 'worktree')
    await gitx.worktreeRemove(ctx.gitPath, task.repoPath, task.worktreePath, !!opts.force)
  }
  if (opts.deleteBranch && hasBranch) {
    const cur = await gitx.currentBranch(ctx.gitPath, task.repoPath)
    if (cur === task.branch) {
      const fallback = task.originalBranch && (await gitx.branchExists(ctx.gitPath, task.repoPath, task.originalBranch))
        ? task.originalBranch
        : task.baseBranch
      if (fallback && fallback !== task.branch && (await gitx.branchExists(ctx.gitPath, task.repoPath, fallback))) {
        await gitx.switchBranch(ctx.gitPath, task.repoPath, fallback)
      } else {
        throw new TaskError('主仓库仍在任务分支且没有可切回的分支，请先切回后再删除分支', 409)
      }
    }
    // -D is safe when the branch is fully merged; only an explicit force may
    // discard unmerged commits.
    await gitx.removeBranch(ctx.gitPath, task.repoPath, task.branch, !!opts.forceDeleteBranch || branchMerged)
  }
  task.cleanedAt = Date.now()
  ctx.store.putTask(task)
  return task
}

export async function archiveTask(ctx: RuntimeContext, id: string): Promise<WorktreeTask> {
  const task = needTask(ctx, id)
  if (task.archivedAt) return task
  const status = (await ctx.snapshot(task)).status
  if (status !== 'merged' && status !== 'cleaned') {
    throw new TaskError('只有已合并或已清理的任务可以归档')
  }
  task.archivedAt = Date.now()
  ctx.store.putTask(task)
  return task
}

export function unarchiveTask(ctx: RuntimeContext, id: string): WorktreeTask {
  const task = needTask(ctx, id)
  if (!task.archivedAt) return task
  task.archivedAt = undefined
  ctx.store.putTask(task)
  return task
}

export async function deleteTask(ctx: RuntimeContext, id: string): Promise<void> {
  const task = needTask(ctx, id)
  // Deleting only drops the record, which would orphan a session that is still
  // working in the worktree — same gate as checkout/merge/cleanup.
  assertAgentIdle(ctx, task)
  if ((await ctx.snapshot(task)).status === 'reviewing') {
    throw new TaskError('任务正在验收中，请先切回原分支再删除记录', 409)
  }
  if ((task.pendingStashes || []).length) throw new TaskError('任务还有未处理的暂存，请先恢复或丢弃后再删除记录', 409, 'pending-stash')
  ctx.store.deleteTask(id)
}

export function bindTask(ctx: RuntimeContext, id: string, sessionId: string): WorktreeTask {
  const task = needTask(ctx, id)
  task.sessionId = sessionId
  task.startOnBind = false
  ctx.store.putTask(task)
  return task
}

export function unbindTaskBySession(ctx: RuntimeContext, sessionId: string): WorktreeTask | null {
  const task = ctx.store.listTasks().find((t) => t.sessionId === sessionId)
  if (!task) return null
  task.sessionId = null
  task.startOnBind = false // the user removed the conversation; do not resurrect it
  ctx.store.putTask(task)
  return task
}
