import type { ProjectView, TaskSnapshot, TaskStatus, TaskView, WorktreeTask } from '../models'

/**
 * Best-effort snapshot for a task the user just published. It is only shown
 * until the next `refresh()` replaces it with the real, Git-derived snapshot.
 */
export function provisionalSnapshot(task: WorktreeTask, status: TaskStatus): TaskSnapshot {
  return {
    worktree: { exists: true, branch: task.branch, dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
    repo: { exists: true, currentBranch: null, dirtyCount: 0 },
    branchExists: true,
    merged: false,
    status,
  }
}

/**
 * Insert a freshly published task into the board's left column immediately.
 *
 * Publishing is followed by an async `refresh()`, but that round-trip can lag or
 * briefly fail — the board is a polling page, and a slow in-flight poll can even
 * resolve after the publish and overwrite the fresh list. That is why the new
 * task used to appear only after leaving and re-entering the page. Merging the
 * task the publish request already returned makes the left tree reflect it at
 * once; the following `refresh()` reconciles the provisional snapshot with the
 * real Git state. Returns a new array and never mutates the input.
 */
export function upsertPublishedTask(
  views: ProjectView[],
  task: WorktreeTask,
  projectId: string | undefined,
  status: TaskStatus,
): ProjectView[] {
  if (!task || !task.id) return views
  const target =
    views.find((v) => v.project.id === projectId) ||
    views.find((v) => v.project.repoPath === task.repoPath)
  if (!target) return views
  const view: TaskView = {
    task: { ...task, projectId: target.project.id },
    snapshot: provisionalSnapshot(task, status),
  }
  return views.map((v) => {
    // Drop any stale duplicate (e.g. one a poll already delivered) before adding.
    const without = v.tasks.filter((t) => t.task.id !== task.id)
    if (v.project.id !== target.project.id) return { ...v, tasks: without }
    const tasks = [view, ...without].sort((a, b) => (b.task.createdAt || 0) - (a.task.createdAt || 0))
    return { ...v, tasks, stats: { ...v.stats, tasks: tasks.length } }
  })
}
