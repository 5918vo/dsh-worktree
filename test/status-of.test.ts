import test from 'node:test'
import assert from 'node:assert/strict'
import { Runtime } from '../src/runtime.js'
import { Store } from '../src/store.js'
import { TaskSnapshot, WorktreeTask } from '../src/models.js'

const runtime = new Runtime({
  store: new Store('C:/tmp/dshw-unused'),
  config: { dirName: '.dsh-worktrees', branchPrefix: 'dsh-wt/', gitPath: 'git' },
})

function task(over: Partial<WorktreeTask> = {}): WorktreeTask {
  return {
    id: 't',
    projectId: 'p',
    title: 'T',
    description: 'D',
    repoPath: 'C:/repo',
    baseBranch: 'main',
    branch: 'feat',
    worktreePath: 'C:/repo/.dsh-worktrees/t',
    sessionId: null,
    firstPrompt: '',
    startOnBind: true,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  }
}

function snapshot(over: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    worktree: { exists: true, branch: 'feat', dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
    repo: { exists: true, currentBranch: 'main', dirtyCount: 0 },
    branchExists: true,
    merged: false,
    status: 'ready',
    ...over,
  }
}

test('statusOf: cleaned wins over every other signal', () => {
  assert.equal(runtime.statusOf(task({ cleanedAt: 123 }), snapshot({ merged: true })), 'cleaned')
})

test('statusOf: broken wins over merged/reviewing', () => {
  assert.equal(runtime.statusOf(task(), snapshot({ error: 'boom', merged: true })), 'broken')
})

test('statusOf: merged wins over reviewing/review', () => {
  assert.equal(runtime.statusOf(task(), snapshot({ merged: true, repo: { exists: true, currentBranch: 'feat', dirtyCount: 0 } })), 'merged')
})

test('statusOf: reviewing when the main repo checks out the task branch', () => {
  assert.equal(runtime.statusOf(task(), snapshot({ repo: { exists: true, currentBranch: 'feat', dirtyCount: 0 } })), 'reviewing')
})

test('statusOf: review when the worktree has commits ahead', () => {
  assert.equal(
    runtime.statusOf(task(), snapshot({ worktree: { exists: true, branch: 'feat', dirtyCount: 0, ahead: 2, commits: [], lastCommitAt: null } })),
    'review',
  )
})

test('statusOf: review when the worktree has uncommitted changes', () => {
  assert.equal(
    runtime.statusOf(task(), snapshot({ worktree: { exists: true, branch: 'feat', dirtyCount: 3, ahead: 0, commits: [], lastCommitAt: null } })),
    'review',
  )
})

test('statusOf: developing once a session is bound (no commits yet)', () => {
  assert.equal(runtime.statusOf(task({ sessionId: 's1' }), snapshot()), 'developing')
})

test('statusOf: ready before any session is bound', () => {
  assert.equal(runtime.statusOf(task(), snapshot()), 'ready')
})
