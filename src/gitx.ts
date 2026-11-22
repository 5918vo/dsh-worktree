/**
 * Thin, Windows-safe git wrapper barrel.
 * Submodules live under `./gitx/*` grouped by concern:
 * - exec: process execution, GitError, config & version checks
 * - repo: repo discovery, branches, worktrees, checkout & restore
 * - history: commit log/ancestry, revParse, status & untracked files
 * - stash: SHA-addressed and legacy message-based stash operations
 * - merge: mergeNoFF, mergeAbort, dry-run merge-tree conflict checks
 * - diff: unified diff execution & per-file patch parsing
 */

export * from './gitx/exec.js'
export * from './gitx/repo.js'
export * from './gitx/history.js'
export * from './gitx/stash.js'
export * from './gitx/merge.js'
export * from './gitx/diff.js'
