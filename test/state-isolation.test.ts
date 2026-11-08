import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { bootHost } from './helpers/host.js'
import { initRepo, mkTempDir, rmrf } from './helpers/git.js'
import { stateDir } from '../src/store.js'

// Regression guard for the unit-test leak: before this fix the HTTP integration
// test ran the real host against the shared `~/.dsh/worktree-tasks` ledger, so
// every run left a temp "project" and its subtasks on the user's board. The host
// must honour an injected Store so tests write to an isolated temp ledger only.
test('bootHost with stateDir keeps the task ledger isolated from the global one', async () => {
  const root = await mkTempDir('dshw-isolate-')
  try {
    const repo = join(root, 'repo')
    await fs.mkdir(repo, { recursive: true })
    await initRepo(repo)

    const isolated = join(root, 'state')
    const harness = bootHost({}, { stateDir: isolated })

    assert.equal(harness.app.store.directory(), isolated, 'host must use the injected store dir')
    assert.notEqual(isolated, stateDir(), 'isolated dir must differ from the global ledger')

    const project = await harness.app.runtime.addProject({ repoPath: repo })
    assert.ok(project.id)

    // The write landed in the temp ledger …
    const isolatedProjects = JSON.parse(await fs.readFile(join(isolated, 'projects.json'), 'utf8'))
    assert.ok(
      Object.values(isolatedProjects).some((p: any) => p.repoPath === repo),
      'project should be recorded in the isolated ledger',
    )

    // … and never in the shared global ledger.
    let globalText = ''
    try {
      globalText = await fs.readFile(join(stateDir(), 'projects.json'), 'utf8')
    } catch {
      /* no global ledger yet — nothing leaked by definition */
    }
    assert.equal(globalText.includes(repo), false, 'global ledger must not contain the test repo')
  } finally {
    await rmrf(root)
  }
})
