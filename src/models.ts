/** Domain models for the worktree task plugin. */

export interface WorktreeConfig {
  /** Worktree parent directory name, relative to the target repo root. */
  dirName: string
  /** Prefix for auto-generated task branches. */
  branchPrefix: string
  /** Git executable. */
  gitPath: string
}

/** A provider/model route chosen for a task's session. */
export interface ModelSelection {
  provider: string
  model: string
  /** Adapter-owned reasoning effort id; omitted means the adapter default. */
  reasoningEffort?: string
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
  /** Preferred model for the task session; applied right after the session is created. */
  model?: ModelSelection
  /** Branch the main repo was on before switching to the task branch. */
  originalBranch?: string
  /** Set when this task branch was merged through the workbench. */
  mergedAt?: number
  /** Merge commit (base HEAD after the merge); used to derive merged commits/files. */
  mergedCommit?: string
  /** The task branch tip that was actually merged; used to verify the merge is in base
   *  even after newer commits land on the old branch. */
  mergedBranchTip?: string
  /** Preceding (already-merged) task this one continues from. */
  parentId?: string
  /** Set when the worktree has been removed. */
  cleanedAt?: number
  /** Set when the task is archived: hidden from the board by default, but not deleted. */
  archivedAt?: number
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
    /** An unfinished merge/rebase/cherry-pick/revert in the main repo, if any. */
    inProgress?: 'merge' | 'rebase' | 'cherry-pick' | 'revert' | null
    /** Whether the recorded originalBranch still exists (undefined when none recorded). */
    originalBranchExists?: boolean
  }
  branchExists: boolean
  merged: boolean
  /** Commits on the task branch after the recorded merge that are not yet in base.
   *  >0 means the task stays `merged` but has patches worth a follow-up. */
  postMergeAhead?: number
  status: TaskStatus
  error?: string
}

/** One file touched by a task branch, with its unified diff against the base. */
export interface DiffFile {
  /** New path (or the only path for non-renames). POSIX-style, repo-relative. */
  path: string
  /** Previous path before a rename/copy; absent otherwise. */
  oldPath?: string
  /** Lifecycle of the file within the diff. */
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'
  additions: number
  deletions: number
  /** Git treats the file as binary; `patch` only carries the marker line. */
  binary: boolean
  /** Unified diff block for this file (may be trimmed when huge). */
  patch: string
}

/** Everything the review screen needs to render a task's changes. */
export interface TaskDiff {
  /** Base branch the diff is computed against. */
  base: string
  /** Merge-base commit used, when it could be resolved. */
  mergeBase: string | null
  files: DiffFile[]
  totalAdditions: number
  totalDeletions: number
  /** True when the file list or a patch was trimmed for size. */
  truncated: boolean
  /** Machine reason when no diff could be produced. */
  reason?: 'worktree-missing' | 'no-merge-base' | 'error'
  /** Human hint (error text) paired with `reason`. */
  error?: string
}

export interface SessionSummary {
  sessionId: string
  running: boolean
  title?: string
  updatedAt?: number
}

/** Dry-run result for merging a task branch into its base branch. */
export interface MergePreview {
  applicable: boolean
  branch: string
  baseBranch: string
  /** Commits on base since the merge base. */
  baseAhead: number
  /** Files changed on both sides since the merge base. */
  overlapFiles: string[]
  /** Files git predicts as conflicts (merge-tree). */
  conflictFiles: string[]
  conflict: boolean
  /** Whether merge-tree actually ran. */
  checked: boolean
  /** Whether the local git supports merge-tree --write-tree (>= 2.38). */
  supported: boolean
  reason?: string
  error?: string
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
