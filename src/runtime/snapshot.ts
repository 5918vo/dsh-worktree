/**
 * Live Git snapshot aggregation and lifecycle status derivation.
 */

import { promises as fs } from 'node:fs'
import * as gitx from '../gitx.js'
import { TaskSnapshot, TaskStatus, WorktreeTask } from '../models.js'
import { RuntimeContext } from './types.js'

/**
 * Git state is the source of truth; the record only carries metadata.
 * Precedence: cleaned → broken → merged → reviewing → developing/review/ready.
 */
export function statusOf(task: WorktreeTask, snap: TaskSnapshot): TaskStatus {
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

export async function computeSnapshot(ctx: RuntimeContext, task: WorktreeTask): Promise<TaskSnapshot> {
  const snap: TaskSnapshot = {
    worktree: { exists: false, branch: null, dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
    repo: { exists: false, currentBranch: null, dirtyCount: 0 },
    branchExists: false,
    merged: false,
    status: 'broken',
  }
  try {
    const [repoIsRepo, wtStat] = await Promise.all([
      gitx.isRepo(ctx.gitPath, task.repoPath),
      fs.stat(task.worktreePath).then((s) => s.isDirectory()).catch(() => false),
    ])
    snap.repo.exists = repoIsRepo
    snap.worktree.exists = wtStat
    snap.branchExists = repoIsRepo ? await gitx.branchExists(ctx.gitPath, task.repoPath, task.branch) : false
    // Reviewing an older commit than the branch tip: surface how far behind.
    if (task.reviewSha && snap.branchExists) {
      const branchTip = await gitx.revParse(ctx.gitPath, task.repoPath, task.branch)
      if (branchTip && branchTip !== task.reviewSha) {
        snap.reviewBehind = await gitx.countCommits(ctx.gitPath, task.repoPath, `${task.reviewSha}..${task.branch}`)
      }
    }

    if (repoIsRepo) {
      const [cur, headSha, dirty] = await Promise.all([
        gitx.currentBranch(ctx.gitPath, task.repoPath),
        gitx.revParse(ctx.gitPath, task.repoPath, 'HEAD'),
        // Untracked files in the main repo do not belong to the task branch and
        // must not block checkout or merge. Tracked edits still do.
        gitx.isDirty(ctx.gitPath, task.repoPath, false),
      ])
      snap.repo.currentBranch = cur
      snap.repo.headSha = headSha
      snap.repo.dirtyCount = dirty
      snap.repo.inProgress = await gitx.inProgress(ctx.gitPath, task.repoPath)
      if (task.originalBranch) {
        snap.repo.originalBranchExists = await gitx.branchExists(ctx.gitPath, task.repoPath, task.originalBranch)
      }
      if (cur && snap.branchExists) {
        // Merged means the branch tip is an ancestor of base AND the branch
        // actually diverged (a freshly created branch points at base itself).
        const [anc, same] = await Promise.all([
          gitx.isAncestor(ctx.gitPath, task.repoPath, task.branch, task.baseBranch),
          gitx.sameCommit(ctx.gitPath, task.repoPath, task.branch, task.baseBranch),
        ])
        if (anc && !same) {
          if (task.mergedAt) {
            snap.merged = true
          } else {
            // A branch that only points at an older base commit is behind,
            // not merged. A merged branch has a task commit newer than the
            // task record.
            const tipTime = await gitx.commitTime(ctx.gitPath, task.repoPath, task.branch)
            snap.merged = tipTime !== null && tipTime * 1000 > (task.createdAt || 0)
          }
        } else if (!anc && task.mergedAt) {
          // Merged through the workbench, but newer commits landed on the old
          // branch afterwards. Keep the task `merged` and count those patches.
          const aheadOfBase = await gitx.countCommits(ctx.gitPath, task.repoPath, `${task.baseBranch}..${task.branch}`)
          if (aheadOfBase > 0) {
            snap.merged = true
            snap.postMergeAhead = aheadOfBase
          }
        }
      }
    }

    if (wtStat) {
      const [wtBranch, wtDirty, ahead, commits, lastAt] = await Promise.all([
        gitx.currentBranch(ctx.gitPath, task.worktreePath),
        gitx.isDirty(ctx.gitPath, task.worktreePath),
        gitx.countCommits(ctx.gitPath, task.worktreePath, `${task.baseBranch}..HEAD`),
        gitx.logOneline(ctx.gitPath, task.worktreePath, `${task.baseBranch}..HEAD`, 20),
        gitx.lastCommitTime(ctx.gitPath, task.worktreePath),
      ])
      snap.worktree.branch = wtBranch
      snap.worktree.dirtyCount = wtDirty
      snap.worktree.ahead = ahead
      snap.worktree.commits = commits
      snap.worktree.lastCommitAt = lastAt
    }

    snap.status = statusOf(task, snap)
  } catch (error) {
    snap.status = 'broken'
    snap.error = error instanceof Error ? error.message : String(error)
  }
  return snap
}
