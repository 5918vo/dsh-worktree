/** Domain models for the worktree task plugin. */

export interface WorktreeConfig {
  /** Worktree parent directory name, relative to the target repo root. */
  dirName: string
  /** Prefix for auto-generated task branches. */
  branchPrefix: string
  /** Git executable. */
  gitPath: string
}

/** A target repository registered on the board; tasks hang off it. */
export interface Project {
  id: string
  /** Display name; defaults to the repo directory basename. */
  name: string
  /** Absolute path of the main repo working tree (unique key). */
  repoPath: string
  /** Default base branch, prefilled when publishing a task. */
  baseBranch: string
  /** Project-level overrides; empty falls back to the global config. */
  dirName?: string
  branchPrefix?: string
  createdAt: number
}

export type TaskStatus =
  | 'ready' // worktree + branch created, session not bound yet
  | 'developing' // bound session exists, work in progress (running or no commits yet)
  | 'review' // work done, waiting for acceptance
  | 'reviewing' // main repo checked out on the task branch
  | 'merged' // task branch merged into base
  | 'cleaned' // worktree removed
  | 'broken' // git state could not be read

export interface WorktreeTask {
  id: string
  /** Owning project; legacy rows may be empty and get grouped by repoPath. */
  projectId: string
  title: string
  description: string
  /** The main repo (target directory) the user published against. */
  repoPath: string
  baseBranch: string
  branch: string
  worktreePath: string
  /** Bound DSH session id (client-created conversation bound to the worktree). */
  sessionId: string | null
  /** First message sent into the session when it is created. */
  firstPrompt: string
  /** Auto-create the session on the next workbench mount (tool-publish path). */
  startOnBind: boolean
  /** Branch the main repo was on before switching to the task branch. */
  originalBranch?: string
  /** Set when the worktree has been removed. */
  cleanedAt?: number
  createdAt: number
  updatedAt: number
}

/** Per-task git snapshot; the source of truth for board status. */
export interface TaskSnapshot {
  worktree: {
    exists: boolean
    branch: string | null
    dirtyCount: number
    ahead: number
    commits: Array<{ hash: string; subject: string }>
    lastCommitAt: number | null
  }
  repo: {
    exists: boolean
    currentBranch: string | null
    dirtyCount: number
  }
  branchExists: boolean
  merged: boolean
  status: TaskStatus
  error?: string
}

export interface SessionSummary {
  sessionId: string
  running: boolean
  title?: string
  updatedAt?: number
}

/** A published task with its snapshot, as returned to the client and tools. */
export interface TaskView {
  task: WorktreeTask
  snapshot: TaskSnapshot
}

/** Per-project aggregate for the board's left column. */
export interface ProjectStats {
  tasks: number
  byStatus: Partial<Record<TaskStatus, number>>
  running: number
}

export interface ProjectView {
  project: Project
  stats: ProjectStats
  tasks: TaskView[]
}
