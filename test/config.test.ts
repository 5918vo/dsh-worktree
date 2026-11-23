import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConfig } from '../src/config.js'

const DEFAULTS = { dirName: '~/.dsh/worktrees', branchPrefix: 'dsh-wt/', gitPath: 'git' }

test('normalizeConfig falls back to defaults for missing input', () => {
  assert.deepEqual(normalizeConfig(undefined), DEFAULTS)
  assert.deepEqual(normalizeConfig(null), DEFAULTS)
  assert.deepEqual(normalizeConfig({}), DEFAULTS)
  assert.deepEqual(normalizeConfig([] as any), DEFAULTS)
})

test('normalizeConfig trims valid overrides', () => {
  assert.deepEqual(normalizeConfig({ dirName: '  wt ', branchPrefix: ' feat/', gitPath: ' C:/Program Files/git.exe ' }), {
    dirName: 'wt',
    branchPrefix: 'feat/',
    gitPath: 'C:/Program Files/git.exe',
  })
})

test('normalizeConfig ignores blank and non-string values', () => {
  assert.deepEqual(normalizeConfig({ dirName: '   ', branchPrefix: 42, gitPath: null }), DEFAULTS)
})
