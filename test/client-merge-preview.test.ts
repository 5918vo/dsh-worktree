import test from 'node:test'
import assert from 'node:assert/strict'
import { createPreviewController, shouldPollPreview } from '../src/client/merge-preview'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: any) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const preview = (tip: string, base: string, extra: Record<string, any> = {}) => ({
  expectedTip: tip,
  expectedBase: base,
  applicable: true,
  baseAhead: 1,
  overlapFiles: [],
  conflictFiles: [],
  conflict: false,
  checked: true,
  supported: true,
  ...extra,
})

test('force waits for the in-flight request then issues exactly one fresh request', async () => {
  const calls: boolean[] = []
  const first = deferred<any>()
  const controller = createPreviewController({
    taskId: 't1',
    request: (force) => {
      calls.push(force)
      if (calls.length === 1) return first.promise
      return Promise.resolve(preview('new-tip', 'new-base'))
    },
  })

  const background = controller.load()
  const forced = controller.load({ force: true })
  // The forced call must not start a second request while the first is running.
  assert.equal(calls.length, 1)

  first.resolve(preview('old-tip', 'old-base'))
  await background
  await forced

  assert.deepEqual(calls, [false, true])
  const state: any = controller.getState()
  assert.equal(state.phase, 'ready')
  assert.equal(state.tipSha, 'new-tip')
})

test('a failed request is retried immediately on the next load', async () => {
  let n = 0
  const controller = createPreviewController({
    taskId: 't2',
    request: async () => {
      n += 1
      if (n === 1) throw new Error('boom')
      return preview('tip', 'base')
    },
  })

  await controller.load().catch(() => {})
  assert.equal(controller.getState().phase, 'error')

  await controller.load()
  assert.equal(n, 2)
  assert.equal(controller.getState().phase, 'ready')
})

test('a late response from a disposed controller never becomes ready', async () => {
  const d = deferred<any>()
  const controller = createPreviewController({ taskId: 'old', request: () => d.promise })
  const seen: string[] = []
  controller.subscribe((s) => seen.push(s.phase))

  const pending = controller.load()
  controller.dispose()
  d.resolve(preview('t', 'b'))
  await pending

  assert.equal(controller.getState().phase, 'checking')
  assert.equal(seen.includes('ready'), false)
})

test('a background poll started before a force check cannot overwrite the forced result', async () => {
  const calls: boolean[] = []
  const backgroundResult = deferred<any>()
  const controller = createPreviewController({
    taskId: 't4',
    request: (force) => {
      calls.push(force)
      return force ? Promise.resolve(preview('new-tip', 'new-base')) : backgroundResult.promise
    },
  })

  const bg = controller.load()
  const forced = controller.load({ force: true })
  backgroundResult.resolve(preview('old-tip', 'old-base'))

  await Promise.all([bg, forced])
  const state: any = controller.getState()
  assert.equal(state.phase, 'ready')
  assert.equal(state.tipSha, 'new-tip')
  assert.deepEqual(calls, [false, true])
})

test('a plain call while a request is running awaits it instead of starting another', async () => {
  let calls = 0
  const d = deferred<any>()
  const controller = createPreviewController({
    taskId: 't5',
    request: () => {
      calls += 1
      return d.promise
    },
  })

  const first = controller.load()
  const second = controller.load()
  assert.equal(calls, 1)
  d.resolve(preview('tip', 'base'))
  await Promise.all([first, second])
  assert.equal(calls, 1)
  assert.equal(controller.getState().phase, 'ready')
})

test('poll gating stops when nothing is mergeable and resumes for post-merge commits', () => {
  // Something to merge -> poll.
  assert.equal(shouldPollPreview({ status: 'review', branchExists: true, ahead: 1 }), true)
  // Nothing ahead and no post-merge commits -> stop.
  assert.equal(shouldPollPreview({ status: 'review', branchExists: true, ahead: 0, postMergeAhead: 0 }), false)
  // Merged but the old branch moved on -> keep polling (not keyed on status).
  assert.equal(shouldPollPreview({ status: 'merged', branchExists: true, ahead: 0, postMergeAhead: 2 }), true)
  // A cleaned task whose branch still has unmerged commits -> keep polling.
  assert.equal(shouldPollPreview({ status: 'cleaned', branchExists: true, ahead: 2 }), true)
  // Broken/absent branch or a running git op -> stop.
  assert.equal(shouldPollPreview({ status: 'broken', branchExists: true, ahead: 1 }), false)
  assert.equal(shouldPollPreview({ status: 'review', branchExists: false, ahead: 1 }), false)
  assert.equal(shouldPollPreview({ status: 'review', branchExists: true, ahead: 1, repoBusy: true }), false)
  // Hidden page -> stop.
  assert.equal(shouldPollPreview({ hidden: true, status: 'review', branchExists: true, ahead: 1 }), false)
})
