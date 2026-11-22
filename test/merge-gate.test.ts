import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { Runtime, TaskError } from '../src/runtime.js'
import { Store } from '../src/store.js'
import { commitFile, git, initRepo, mkTempDir, rmrf } from './helpers/git.js'

const CONFIG = { dirName: '.dsh-worktrees', branchPrefix: 'dsh-wt/', gitPath: 'git' }

interface Fixture {
  root: string
  repo: string
  store: Store
  runtime: Runtime
}

async function fixture(): Promise<Fixture> {
  const root = await mkTempDir('dshw-gate-')
  const repo = join(root, 'repo')
  await fs.mkdir(repo, { recursive: true })
  await initRepo(repo)
  const store = new Store(join(root, 'state'))
  await store.load()
  const runtime = new Runtime({ store, config: CONFIG, sessionState: () => 'idle' })
  return { root, repo, store, runtime }
}

async function teardown(f: Fixture): Promise<void> {
  f.store.dispose()
  await f.store.flush()
  await new Promise((resolve) => setTimeout(resolve, 80))
  await rmrf(f.root)
}

const codes = (pf: any) => pf.blockers.map((b: any) => b.code)

test('project merge gate blocks preflight while criteria are unchecked', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({
      repoPath: f.repo,
      title: 'gated',
      description: 'd',
      acceptanceCriteria: ['first', 'second'],
    })
    await commitFile(task.worktreePath, 'src/a.txt', 'a\n', 'feat: a')

    // Gate off (absent) by default: the task is mergeable.
    const open = await f.runtime.mergePreflight(task.id, { switchToBase: false })
    assert.equal(codes(open).includes('criteria-incomplete'), false)

    await f.runtime.updateProject(task.projectId, { mergeGate: 'criteria' })
    const blocked = await f.runtime.mergePreflight(task.id, { switchToBase: false })
    assert.equal(blocked.canMerge, false)
    const gate = blocked.blockers.find((b: any) => b.code === 'criteria-incomplete')
    assert.ok(gate, 'expected a criteria-incomplete blocker')
    assert.match(gate.message, /2 项验收标准未核对/)

    // merge() reruns the same preflight inside the lock and refuses.
    await assert.rejects(
      () => f.runtime.merge(task.id),
      (e: any) => e instanceof TaskError && e.code === 'criteria-incomplete',
    )

    // One checkbox is not enough; both are required.
    f.runtime.setCriterionChecked(task.id, 'first', true)
    const partly = await f.runtime.mergePreflight(task.id, { switchToBase: false })
    assert.equal(partly.canMerge, false)
    assert.match(partly.blockers.find((b: any) => b.code === 'criteria-incomplete').message, /1 项/)

    f.runtime.setCriterionChecked(task.id, 'second', true)
    const ready = await f.runtime.mergePreflight(task.id, { switchToBase: false })
    assert.equal(ready.canMerge, true)
    assert.equal(codes(ready).includes('criteria-incomplete'), false)
  } finally {
    await teardown(f)
  }
})

test('merge gate ignores tasks without acceptance criteria and can be turned off', async () => {
  const f = await fixture()
  try {
    const bare = await f.runtime.publish({ repoPath: f.repo, title: 'bare', description: 'd' })
    await commitFile(bare.worktreePath, 'src/b.txt', 'b\n', 'feat: b')
    await f.runtime.updateProject(bare.projectId, { mergeGate: 'criteria' })
    const pf = await f.runtime.mergePreflight(bare.id, { switchToBase: false })
    assert.equal(pf.canMerge, true)

    const gated = await f.runtime.publish({
      repoPath: f.repo,
      title: 'gated',
      description: 'd',
      acceptanceCriteria: ['one'],
    })
    await commitFile(gated.worktreePath, 'src/g.txt', 'g\n', 'feat: g')
    const before = await f.runtime.mergePreflight(gated.id, { switchToBase: false })
    assert.equal(before.canMerge, false)

    await f.runtime.updateProject(gated.projectId, { mergeGate: 'off' })
    const after = await f.runtime.mergePreflight(gated.id, { switchToBase: false })
    assert.equal(after.canMerge, true)
  } finally {
    await teardown(f)
  }
})

test('project merge gate rejects unknown values', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({ repoPath: f.repo, title: 't', description: 'd' })
    await assert.rejects(
      () => f.runtime.updateProject(task.projectId, { mergeGate: 'yes' as any }),
      (e: any) => e instanceof TaskError && e.status === 400,
    )
    assert.equal(f.store.getProject(task.projectId)?.mergeGate, undefined)
  } finally {
    await teardown(f)
  }
})

test('merged task stays mergeable regardless of unchecked criteria when re-checked', async () => {
  const f = await fixture()
  try {
    const task = await f.runtime.publish({
      repoPath: f.repo,
      title: 'merge then gate',
      description: 'd',
      acceptanceCriteria: ['x'],
    })
    await commitFile(task.worktreePath, 'src/x.txt', 'x\n', 'feat: x')
    const pf = await f.runtime.mergePreflight(task.id, { switchToBase: false })
    await f.runtime.merge(task.id, { expectedTip: pf.tipSha || undefined, expectedBase: pf.baseSha || undefined })
    await f.runtime.updateProject(task.projectId, { mergeGate: 'criteria' })
    const after = await f.runtime.mergePreflight(task.id, { switchToBase: false })
    assert.equal(codes(after).includes('criteria-incomplete'), false)

    // A quick sanity check that the repo really is on the base branch.
    assert.equal((await git(f.repo, ['branch', '--show-current'])).trim(), 'main')
  } finally {
    await teardown(f)
  }
})
