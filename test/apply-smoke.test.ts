import test from 'node:test'
import assert from 'node:assert/strict'
import { bootHost } from './helpers/host.js'
import { factory } from '../src/client.js'

test('host apply() registers all tools and HTTP routes without throwing', () => {
  const { tools, routes } = bootHost({})
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    ['worktree_act', 'worktree_projects', 'worktree_publish', 'worktree_tasks'],
  )
  const paths = routes.map((r) => r.path)
  for (const p of [
    'session',
    'config',
    'recents',
    'recents/clear',
    'branches',
    'publish',
    'projects',
    'projects/add',
    'projects/update',
    'projects/delete',
    'tasks',
    'bind',
    'task/checkout',
    'task/back',
    'task/merge',
    'task/cleanup',
    'task/delete',
  ]) {
    assert.ok(paths.includes('/dsh-worktree/api/' + p), 'missing HTTP route: ' + p)
  }
  assert.ok(routes.every((r) => r.kind === 'exact' && typeof r.handler === 'function'))
})

test('client factory apply() registers slots without throwing', () => {
  const fakeReact = {
    createElement: (type: any, props: any, ...children: any[]) => ({ type, props: props || {}, children }),
    useState: (initial: any) => [initial, () => {}],
    useEffect: () => {},
    useRef: (v: any) => ({ current: v }),
    useCallback: (f: any) => f,
    useMemo: (f: any) => f(),
    useLayoutEffect: () => {},
    Fragment: Symbol('Fragment'),
  }
  const mod = factory(() => fakeReact)
  assert.ok(Array.isArray(mod.inject))
  assert.ok(mod.inject.includes('slots'))

  const registered: any[] = []
  const ctx = {
    get(name: string) {
      if (name === 'locale') return { register() {}, current: () => 'zh' }
      return undefined
    },
    effect(fn: () => any) {
      const cleanup = fn()
      return typeof cleanup === 'function' ? cleanup : () => {}
    },
    slots: {
      inject(_slot: string, make: () => any) {
        try {
          make()
        } catch {
          /* the main slot's generator is intentionally not iterated */
        }
        return () => {}
      },
      register(def: any) {
        registered.push(def)
        return () => {}
      },
    },
  }

  assert.doesNotThrow(() => mod.apply(ctx))
  assert.deepEqual(
    registered.map((r) => r.id).sort(),
    ['deepseek-worktree-settings', 'worktree-board'],
  )
})
