import test from 'node:test'
import assert from 'node:assert/strict'
import { bindSession } from '../src/client/context.js'

// The client modules run in the host page; provide the minimum browser globals
// bindSession touches (window timers) plus a controllable fetch.
;(globalThis as any).window = {
  setTimeout: (fn: any, ms: number) => (globalThis as any).setTimeout(fn, ms),
  clearTimeout: (id: any) => (globalThis as any).clearTimeout(id),
}

function jsonRes(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

interface FetchedCall {
  url: string
  init: any
}

function installFetch(routes: Record<string, (init: any) => any>): { calls: FetchedCall[] } {
  const calls: FetchedCall[] = []
  ;(globalThis as any).fetch = async (url: string, init: any) => {
    const u = String(url)
    calls.push({ url: u, init })
    for (const key of Object.keys(routes)) {
      // Longest prefix first so '/bind/claim' is not swallowed by '/bind'.
      if (u.endsWith(key)) return routes[key](init)
    }
    return jsonRes({})
  }
  return { calls }
}

function makeTask(over: any = {}) {
  return {
    id: 'task-1',
    title: '实现登录',
    description: 'desc',
    repoPath: 'C:/repo',
    worktreePath: 'C:/repo/.dsh-worktrees/abc123',
    firstPrompt: 'DO THE WORK',
    startOnBind: true,
    ...over,
  }
}

function makeRemotes(over: any = {}) {
  const calls: any = {
    workspaceCreate: [],
    workspaceRename: [],
    sessionCreate: [],
    sessionRename: [],
    sessionDeleted: [],
    selectModel: [],
    prompt: [],
  }
  let created = 0
  const remotes = {
    workspace: {
      async create(arg: any) {
        calls.workspaceCreate.push(arg)
        if (over.workspaceCreate) return over.workspaceCreate(arg)
        return { ok: true, value: { workspace: { workspaceId: 'ws-1' } } }
      },
      async rename(arg: any) {
        calls.workspaceRename.push(arg)
        return { ok: true }
      },
    },
    session: {
      async create(arg: any) {
        calls.sessionCreate.push(arg)
        if (over.sessionCreate) return over.sessionCreate(arg)
        created += 1
        return { ok: true, value: { sessionId: `sess-${created}`, cwd: arg.cwd } }
      },
      async rename(arg: any) {
        calls.sessionRename.push(arg)
        return { ok: true }
      },
      async selectModel(arg: any) {
        calls.selectModel.push(arg)
        return { ok: true }
      },
      async prompt(arg: any) {
        calls.prompt.push(arg)
        if (over.prompt) return over.prompt(arg)
        return { ok: true }
      },
      async delete(arg: any) {
        calls.sessionDeleted.push(arg)
        if (over.sessionDelete) return over.sessionDelete(arg)
        return { ok: true }
      },
    },
  }
  return { remotes, calls }
}

/**
 * Stateful stand-in for the board's binding endpoints, so the client is tested
 * against the same lease protocol the store implements (claim → bind → release).
 *
 * Bindings that land are recorded in `bound` and served by GET tasks, which is
 * what the client reads back after a lost bind response; a `bind` override that
 * wants the write to land must call `land(body)` before losing the response.
 */
function boardServer(over: any = {}) {
  const state: any = {
    lease: null as null | { token: string; owner: string },
    claimCalls: [] as any[],
    bindCalls: [] as any[],
    releaseCalls: [] as any[],
    tasksCalls: [] as any[],
    bound: {} as Record<string, string>,
    issued: 0,
  }
  const land = (body: any) => {
    state.bound[body.id] = body.sessionId
    state.lease = null
  }
  installFetch({
    '/session': () => jsonRes({ token: 'tok' }),
    '/bind/claim': (init: any) => {
      const body = JSON.parse(init.body)
      state.claimCalls.push(body)
      if (state.lease && state.lease.owner !== body.owner) {
        return jsonRes({ error: '另一个窗口正在启动该任务', code: 'lease-held' }, 409)
      }
      if (!state.lease) {
        state.issued += 1
        state.lease = { token: `lease-${state.issued}`, owner: body.owner }
      }
      return jsonRes({ ok: true, lease: { token: state.lease.token } })
    },
    '/bind/release': (init: any) => {
      const body = JSON.parse(init.body)
      state.releaseCalls.push(body)
      if (state.lease && state.lease.token === body.lease) state.lease = null
      return jsonRes({ ok: true })
    },
    // GET tasks: the same read model the real board serves ({ tasks: views }).
    '/tasks': (init: any) => {
      state.tasksCalls.push(init)
      if (over.tasks) return over.tasks(state)
      const tasks = Object.entries(state.bound).map(([id, sessionId]) => ({ task: { id, sessionId }, snapshot: null }))
      return jsonRes({ tasks })
    },
    '/bind': (init: any) => {
      const body = JSON.parse(init.body)
      state.bindCalls.push(body)
      if (over.bind) return over.bind(body, state, land)
      if (!state.lease || state.lease.token !== body.lease) {
        return jsonRes({ error: '租约已失效', code: 'lease-lost' }, 409)
      }
      land(body)
      return jsonRes({ ok: true })
    },
  })
  return state
}

test('bindSession claims, creates the session in the worktree, prompts and binds', async () => {
  const srv = boardServer()
  const { remotes, calls: svc } = makeRemotes()

  const sessionId = await bindSession(remotes, makeTask(), '项目A')

  assert.equal(sessionId, 'sess-1')
  assert.deepEqual(svc.workspaceCreate[0], { path: 'C:/repo' })
  // Grouping is preserved, but the cwd override is what decides where the agent runs.
  assert.deepEqual(svc.sessionCreate[0], { workspaceId: 'ws-1', cwd: 'C:/repo/.dsh-worktrees/abc123' })
  assert.equal(svc.sessionRename[0].title, '实现登录')
  assert.equal(svc.prompt.length, 1)
  assert.equal(svc.prompt[0].content[0].text, 'DO THE WORK')
  assert.deepEqual(srv.bindCalls[0], { id: 'task-1', sessionId: 'sess-1', lease: 'lease-1' })
  assert.equal(srv.releaseCalls.length, 0, 'a successful bind keeps the lease consumed, not released')
  assert.equal(svc.sessionDeleted.length, 0)
})

test('bindSession refuses to start when another window holds the claim', async () => {
  const srv = boardServer()
  srv.lease = { token: 'lease-other', owner: 'window-a' }
  const { remotes, calls: svc } = makeRemotes()

  await assert.rejects(
    () => bindSession(remotes, makeTask(), '项目A'),
    (error: any) => error.status === 409 && error.code === 'lease-held',
  )
  assert.equal(svc.sessionCreate.length, 0, 'the loser must not create a session')
  assert.equal(svc.prompt.length, 0)
  assert.equal(srv.bindCalls.length, 0)
})

test('bindSession discards a grouped session the host ran outside the worktree', async () => {
  const srv = boardServer()
  const { remotes, calls: svc } = makeRemotes({
    sessionCreate: (arg: any) =>
      arg.workspaceId
        ? { ok: true, value: { sessionId: 'sess-grouped', cwd: 'C:/repo' } }
        : { ok: true, value: { sessionId: 'sess-plain', cwd: arg.cwd } },
  })

  const sessionId = await bindSession(remotes, makeTask(), '项目A')

  assert.equal(sessionId, 'sess-plain', 'must fall back to the worktree-bound session')
  assert.deepEqual(svc.sessionDeleted, [{ sessionId: 'sess-grouped' }])
  assert.deepEqual(svc.sessionCreate[1], { cwd: 'C:/repo/.dsh-worktrees/abc123' })
  assert.deepEqual(srv.bindCalls[0], { id: 'task-1', sessionId: 'sess-plain', lease: 'lease-1' })
})

test('bindSession fails loudly when no session can be created in the worktree', async () => {
  const srv = boardServer()
  let n = 0
  const { remotes, calls: svc } = makeRemotes({
    // The host ignores the cwd override on every attempt: one grouped session,
    // then one plain session, both in the main repo.
    sessionCreate: () => {
      n += 1
      return { ok: true, value: { sessionId: `sess-main-${n}`, cwd: 'C:/repo' } }
    },
  })

  await assert.rejects(() => bindSession(remotes, makeTask(), '项目A'), /工作目录.*C:\/repo/)
  assert.equal(srv.bindCalls.length, 0, 'never bind a session that runs in the main repo')
  assert.equal(svc.prompt.length, 0)
  assert.deepEqual(svc.sessionDeleted, [{ sessionId: 'sess-main-1' }, { sessionId: 'sess-main-2' }], 'both orphan sessions are cleaned up')
  assert.equal(srv.releaseCalls.length, 1, 'the claim is handed back')
  assert.equal(srv.lease, null)
})

test('bindSession does NOT bind when the first prompt fails (task stays startable)', async () => {
  const srv = boardServer()
  const { remotes, calls: svc } = makeRemotes({ prompt: () => ({ ok: false, error: { message: 'model unavailable' } }) })

  await assert.rejects(() => bindSession(remotes, makeTask(), '项目A'), /model unavailable/)
  assert.equal(srv.bindCalls.length, 0, 'must not persist a binding for a session whose prompt never ran')
  assert.deepEqual(svc.sessionDeleted, [{ sessionId: 'sess-1' }])
  assert.equal(srv.releaseCalls.length, 1)
  assert.equal(srv.lease, null, 'another window can start the task right away')
})

test('bindSession does NOT bind when session creation fails', async () => {
  const srv = boardServer()
  const { remotes } = makeRemotes({ sessionCreate: () => ({ ok: false, error: { message: 'cwd missing' } }) })

  await assert.rejects(() => bindSession(remotes, makeTask(), '项目A'), /cwd missing/)
  assert.equal(srv.bindCalls.length, 0)
  assert.equal(srv.releaseCalls.length, 1)
})

test('bindSession falls back to a cwd-bound session when the workspace call throws', async () => {
  boardServer()
  const { remotes, calls: svc } = makeRemotes({
    workspaceCreate: () => {
      throw new Error('workspace service down')
    },
  })
  const task = makeTask()

  const sessionId = await bindSession(remotes, task, '项目A')

  assert.equal(sessionId, 'sess-1')
  assert.deepEqual(svc.sessionCreate[0], { cwd: task.worktreePath })
  assert.equal(svc.prompt.length, 1)
})

test('bindSession with start=false binds without sending a prompt', async () => {
  const srv = boardServer()
  const { remotes, calls: svc } = makeRemotes()

  const sessionId = await bindSession(remotes, makeTask(), '项目A', false)

  assert.equal(sessionId, 'sess-1')
  assert.equal(svc.prompt.length, 0)
  assert.equal(srv.bindCalls.length, 1)
})

test('bindSession reports a lost lease and cleans up when another window takes over', async () => {
  const srv = boardServer()
  const { remotes, calls: svc } = makeRemotes({
    prompt: (_arg: any) => {
      // Simulate a takeover between claim and bind (e.g. this window stalled).
      srv.lease = { token: 'lease-other', owner: 'window-b' }
      return { ok: true }
    },
  })

  await assert.rejects(
    () => bindSession(remotes, makeTask(), '项目A'),
    (error: any) => error.status === 409 && error.code === 'lease-lost',
  )
  assert.deepEqual(svc.sessionDeleted, [{ sessionId: 'sess-1' }])
  assert.equal(srv.tasksCalls.length, 0, 'a 4xx is a refusal, not an unknown outcome: no readback')
})

test('bindSession retries a lost bind response instead of orphaning the session', async () => {
  let first = true
  const srv = boardServer({
    bind: (body: any, _state: any, land: (b: any) => void) => {
      if (first) {
        // The write landed, but the client never saw the response.
        first = false
        land(body)
        throw new TypeError('fetch failed')
      }
      return jsonRes({ ok: true })
    },
  })
  const { remotes, calls: svc } = makeRemotes()

  const sessionId = await bindSession(remotes, makeTask(), '项目A')

  assert.equal(sessionId, 'sess-1')
  assert.equal(srv.bindCalls.length, 2, 'the retry makes the bind a no-op instead of failing')
  assert.equal(svc.sessionDeleted.length, 0)
})

test('bindSession reads the ledger back when both bind responses are lost but the write landed', async () => {
  const srv = boardServer({
    bind: (body: any, _state: any, land: (b: any) => void) => {
      // Both attempts write the binding (the store's bind is idempotent) and both
      // responses are lost on the way back.
      land(body)
      throw new TypeError('fetch failed')
    },
  })
  const { remotes, calls: svc } = makeRemotes()

  const sessionId = await bindSession(remotes, makeTask(), '项目A')

  assert.equal(sessionId, 'sess-1')
  assert.equal(srv.bindCalls.length, 2)
  assert.equal(srv.tasksCalls.length, 1, 'the uncertain outcome is resolved by one readback')
  assert.deepEqual(srv.bound, { 'task-1': 'sess-1' })
  assert.equal(svc.sessionDeleted.length, 0, 'a bound session must not be deleted')
  assert.equal(srv.releaseCalls.length, 0, 'a consumed lease must not be released')
})

test('bindSession cleans up once when both bind attempts fail and nothing landed', async () => {
  const srv = boardServer({
    bind: () => { throw new TypeError('fetch failed') },
  })
  const { remotes, calls: svc } = makeRemotes()

  await assert.rejects(() => bindSession(remotes, makeTask(), '项目A'), /fetch failed/)
  assert.equal(srv.bindCalls.length, 2)
  assert.equal(srv.tasksCalls.length, 1)
  assert.deepEqual(srv.bound, {}, 'the fixture never wrote the binding')
  assert.deepEqual(svc.sessionDeleted, [{ sessionId: 'sess-1' }], 'the orphan session is removed exactly once')
  assert.equal(srv.releaseCalls.length, 1)
  assert.equal(srv.lease, null)
})

test('bindSession keeps the session when the readback itself fails', async () => {
  const srv = boardServer({
    bind: () => { throw new TypeError('fetch failed') },
    tasks: () => { throw new TypeError('readback failed') },
  })
  const { remotes, calls: svc } = makeRemotes()

  await assert.rejects(
    () => bindSession(remotes, makeTask(), '项目A'),
    (error: any) => /fetch failed/.test(String(error.message)) && /刷新看板/.test(String(error.message)) && /readback failed/.test(String(error.readbackError)),
  )
  assert.equal(srv.tasksCalls.length, 1)
  assert.equal(svc.sessionDeleted.length, 0, 'an unreadable ledger must not turn into a deleted session')
  assert.equal(srv.releaseCalls.length, 0, 'the possibly consumed lease is left to its TTL')
})

test('bindSession cleans up when the readback shows the task bound to another session', async () => {
  const srv = boardServer({
    bind: () => { throw new TypeError('fetch failed') },
    // Another window (or an older attempt) owns a different session on this task.
    tasks: () => jsonRes({ tasks: [{ task: { id: 'task-1', sessionId: 'sess-other' }, snapshot: null }] }),
  })
  const { remotes, calls: svc } = makeRemotes()

  await assert.rejects(() => bindSession(remotes, makeTask(), '项目A'), /fetch failed/)
  assert.equal(srv.tasksCalls.length, 1)
  assert.deepEqual(svc.sessionDeleted, [{ sessionId: 'sess-1' }], 'the unmatched session is still an orphan')
  assert.equal(srv.releaseCalls.length, 1)
})

test('bindSession cleans up when the readback does not contain this task', async () => {
  const srv = boardServer({
    bind: () => { throw new TypeError('fetch failed') },
    tasks: () => jsonRes({ tasks: [{ task: { id: 'task-2', sessionId: 'sess-1' }, snapshot: null }] }),
  })
  const { remotes, calls: svc } = makeRemotes()

  await assert.rejects(() => bindSession(remotes, makeTask(), '项目A'), /fetch failed/)
  assert.equal(srv.tasksCalls.length, 1)
  assert.deepEqual(svc.sessionDeleted, [{ sessionId: 'sess-1' }], 'id and session must both match to keep it')
  assert.equal(srv.releaseCalls.length, 1)
})

test('bindSession reports the bind failure even when cleanup also fails', async () => {
  const srv = boardServer({
    bind: () => { throw new TypeError('fetch failed') },
  })
  const { remotes, calls: svc } = makeRemotes({
    // The host may already have dropped the session, or the delete RPC may be
    // the thing that is broken. Either way it is secondary to the lost bind.
    sessionDelete: () => { throw new Error('delete rpc unavailable') },
  })

  await assert.rejects(() => bindSession(remotes, makeTask(), '项目A'), /fetch failed/)
  assert.equal(srv.bindCalls.length, 2)
  assert.deepEqual(svc.sessionDeleted, [{ sessionId: 'sess-1' }], 'cleanup is still attempted exactly once')
})

test('bindSession requires a host reload rather than bypassing a missing claim endpoint', async () => {
  installFetch({
    '/session': () => jsonRes({ token: 'tok' }),
    '/bind/claim': () => jsonRes({ error: 'not found' }, 404),
  })
  const { remotes, calls: svc } = makeRemotes()

  await assert.rejects(() => bindSession(remotes, makeTask(), '项目A'), /刷新页面/)
  assert.equal(svc.sessionCreate.length, 0)
  assert.equal(svc.prompt.length, 0)
})
