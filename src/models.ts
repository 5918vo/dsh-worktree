/** Domain models for the worktree task plugin. */

import type { TaskPriority } from './task-meta.js'

export interface WorktreeConfig {
  /**
   * Worktree root. `~`/absolute: external layout `<root>/<project>/<id8>`;
   * relative: legacy in-repo layout `<repo>/<dirName>/<id8>`.
   */
  dirName: string
  /** Prefix for auto-generated task branches. */
  branchPrefix: string
  /** Git executable. */
  gitPath: string
}

/**
 * Exclusive, time-boxed right to create and bind a session for one task.
 *
 * The board is a browser app: two windows can try to start the same task at
 * once. Creating the session and sending the first prompt are remote calls
 * that cannot be undone, so the right to do them is claimed in the shared
 * ledger first. The lease is released by `bind` (success) or `bind/release`
 * (failure), and expires so a crashed window cannot block the task forever.
 */
export interface BindLease {
  token: string
  /** Client (window) that holds the lease; reused so retries are idempotent. */
  owner: string
  /** Store instance that wrote the lease. */
  instanceId: string
  pid: number
  at: number
  expiresAt: number
}

/**
 * Which DSH instance bound a task's session.
 *
 * Agent registries are per process, so another instance cannot see whether this
 * session is running. A live foreign owner therefore means "not visible", which
 * is different from "confirmed idle"; a dead owner means its agents are gone.
 */
export interface SessionOwner {
  instanceId: string
  pid: number
  at: number
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
  /**
   * Merge gate: `criteria` refuses to merge while acceptance criteria are
   * unchecked. Omitted/`off` keeps the historical behaviour.
   */
  mergeGate?: 'off' | 'criteria'
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
  /** Set while a client is creating the session for this task, then cleared by bind. */
  bindLease?: BindLease
  /** Instance that bound `sessionId`; drives cross-instance idle decisions. */
  sessionOwner?: SessionOwner
  /** First message sent into the session when it is created. */
  firstPrompt: string
  /** Optional free-form tags; normalized to at most 8, 24 chars each. */
  tags?: string[]
  /** Display order hint; omitted means normal. */
  priority?: TaskPriority
  /** Handover / acceptance notes shown in the detail view and reports. */
  notes?: string
  /** Optional prerequisite tasks (same project, at most 8) — display only. */
  dependsOn?: string[]
  /** Optional deadline as local calendar midnight (ms); absent means none. */
  dueAt?: number
  /** Optional per-task acceptance criteria (one trimmed line per item). */
  acceptanceCriteria?: string[]
  /** Verified criterion texts; intersected with acceptanceCriteria for display. */
  checkedCriteria?: string[]
  /** Auto-create the session on the next workbench mount (tool-publish path). */
  startOnBind: boolean
  /** Preferred model for the task session; applied right after the session is created. */
  model?: ModelSelection
  /** Branch the main repo was on before switching to the task branch. */
  originalBranch?: string
  /** Detached acceptance: the commit checked out in the main repo during review. */
  reviewSha?: string
  /** What the main repo had checked out before acceptance (branch name / tag / sha). */
  reviewOriginalRef?: string
  /** HEAD sha before acceptance; fallback when the original branch was deleted. */
  reviewOriginalSha?: string
  /** Stash message created when returning to the original branch with uncommitted work. */
  reviewStash?: string
  /** Recorded stashes (review or merge) waiting for a manual restore. Replaces reviewStash. */
  pendingStashes?: PendingStash[]
  /** In-flight merge journal; written before and after each mutating step. */
  pendingOp?: PendingOp
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
  /** Set when the task is pinned in the rail; pinned tasks sort first. */
  pinnedAt?: number
  createdAt: number
  updatedAt: number
}

/** A reusable publish template (title/description/criteria presets). */
export interface TaskTemplate {
  id: string
  name: string
  title: string
  description: string
  criteria: string[]
  createdAt: number
  updatedAt?: number
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
    /** HEAD sha of the main repo (works for detached review too). */
    headSha?: string | null
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
  /** Commits added to the task branch after the commit currently being reviewed.
   *  >0 means the review is looking at an older commit than the branch tip. */
  reviewBehind?: number
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
  /** Where the diff came from: the live branch, or the commit a merge created. */
  source?: 'merge-commit'
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
  /** Exact tips the preview was computed from; merge must pass them back. */
  expectedTip?: string | null
  expectedBase?: string | null
  /** Commits on base since the merge base. */
  baseAhead: number
  /** Files changed on both sides since the merge base. */
  overlapFiles: string[]
  /** Files git predicts as conflicts (merge-tree). */
  conflictFiles: string[]
  conflict: boolean
  /** Whether merge-tree actually ran. */
  checked: boolean
  /** When this dry-run was computed (ms since epoch); reused by the client. */
  checkedAt?: number
  /** True when this result came from the (task, tip, base) cache. */
  cached?: boolean
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

/** One reason a merge cannot proceed. */
export interface MergeBlocker {
  code: string
  message: string
}

/** A working-tree file that would block switching the main repo to the base. */
export interface MergeBlockingFile {
  path: string
  untracked: boolean
}

/** Conflict portion of a merge preflight (mirrors MergePreview). */
export interface MergeConflictInfo {
  applicable: boolean
  conflict: boolean
  conflictFiles: string[]
  checked: boolean
  supported: boolean
  checkedAt?: number
}

/** Everything the merge dialog needs to decide whether/how it can merge. */
export interface MergePreflight {
  canMerge: boolean
  blockers: MergeBlocker[]
  blockingFiles: MergeBlockingFile[]
  originalRef: { branch: string | null; sha: string | null }
  tipSha: string | null
  baseSha: string | null
  conflict: MergeConflictInfo
}

/** A stash recorded for later manual restore. */
export interface PendingStash {
  /** Stash commit SHA (not stash@{n}). Empty when an old record could not be matched. */
  sha: string
  source: 'review' | 'merge'
  ref: string
  createdAt: number
  files: string[]
  /** True when an old record could not be uniquely matched to a stash entry. */
  unverified?: boolean
}

export type PendingOpStep =
  | 'preflight'
  | 'stash'
  | 'switch'
  | 'verify'
  | 'merge'
  | 'merge-committed'
  | 'restore'
  | 'done'

/** Durable journal for an in-flight merge, so a crash can be reconciled. */
export interface PendingOp {
  operationId: string
  kind: 'merge'
  taskId: string
  /** Identifies the repo this journal belongs to (lets startup prove ownership). */
  repoIdentity: string
  step: PendingOpStep
  originalRef: { branch: string | null; sha: string | null }
  expectedTip: string | null
  expectedBase: string | null
  /** Set once the merge commit exists (merge-committed); a repeat must not re-merge. */
  mergeCommit?: string | null
  stashRef?: string
  recoveryStatus?: 'pending' | 'recovered' | 'needs-manual'
  startedAt: number
  updatedAt?: number
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
