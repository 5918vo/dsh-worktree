import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_WORKTREE_DIR,
  isExternalWorktreeDir,
  worktreeProjectSegment,
  worktreePreviewRoot,
} from '../src/worktree-layout.js'

test('isExternalWorktreeDir recognizes roots and keeps legacy names in-repo', () => {
  assert.equal(isExternalWorktreeDir(DEFAULT_WORKTREE_DIR), true)
  assert.equal(isExternalWorktreeDir('~/.dsh/worktrees'), true)
  assert.equal(isExternalWorktreeDir('/srv/worktrees'), true)
  assert.equal(isExternalWorktreeDir('C:\\worktrees'), true)
  assert.equal(isExternalWorktreeDir('C:/worktrees'), true)
  assert.equal(isExternalWorktreeDir('\\\\server\\share\\worktrees'), true)
  assert.equal(isExternalWorktreeDir('.dsh-worktrees'), false)
  assert.equal(isExternalWorktreeDir('wt'), false)
  assert.equal(isExternalWorktreeDir(''), false)
  assert.equal(isExternalWorktreeDir('   '), false)
})

test('worktreeProjectSegment keeps project names filesystem-safe', () => {
  assert.equal(worktreeProjectSegment('dsh-worktree'), 'dsh-worktree')
  assert.equal(worktreeProjectSegment('我的 项目'), '我的 项目')
  assert.equal(worktreeProjectSegment('a/b:c*?"<>|'), 'a-b-c------')
  assert.equal(worktreeProjectSegment('..hidden'), 'hidden')
  assert.equal(worktreeProjectSegment('trailing. '), 'trailing')
  assert.equal(worktreeProjectSegment('CON'), 'CON-wt')
  assert.equal(worktreeProjectSegment(''), 'project')
  assert.equal(worktreeProjectSegment('   '), 'project')
})

test('worktreePreviewRoot appends the project only for external roots', () => {
  assert.equal(worktreePreviewRoot({ name: 'repo', dirName: '~/.dsh/worktrees' }), '~/.dsh/worktrees/repo')
  assert.equal(worktreePreviewRoot({ name: 'repo' }), '~/.dsh/worktrees/repo')
  assert.equal(worktreePreviewRoot({ name: 'repo', dirName: '.wt' }), '.wt')
  assert.equal(worktreePreviewRoot({ name: 'repo', dirName: 'C:\\wt\\' }), 'C:/wt/repo')
  assert.equal(worktreePreviewRoot({ name: 'a/b', dirName: '~/wt/' }), '~/wt/a-b')
  assert.equal(worktreePreviewRoot(null), '~/.dsh/worktrees/project')
})
