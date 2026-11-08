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
  const calls: any = { workspaceCreate: [], workspaceRename: [], sessionCreate: [], sessionRename: [], prompt: [] }
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
        return { ok: true, value: { sessionId: 'sess-1' } }
      },
      async rename(arg: any) {
        calls.sessionRename.push(arg)
        return { ok: true }
      },
      async prompt(arg: any) {
        calls.prompt.push(arg)
        if (over.prompt) return over.prompt(arg)
        return { ok: true }
      },
    },
  }
  return { remotes, calls }
}

test('bindSession creates workspace session, sends first prompt and binds the task', async () => {
  const { calls } = installFetch({ session: () => jsonRes({ token: 'tok' }), bind: () => jsonRes({ ok: true }) })
  const { remotes, calls: svc } = makeRemotes()
  const task = makeTask()

  const sessionId = await bindSession(remotes, task, '项目A')

  assert.equal(sessionId, 'sess-1')
  assert.deepEqual(svc.workspaceCreate[0], { path: 'C:/repo' })
  assert.deepEqual(svc.sessionCreate[0], { workspaceId: 'ws-1' })
  assert.equal(svc.prompt.length, 1)
  assert.equal(svc.prompt[0].content[0].text, 'DO THE WORK')
  assert.equal(svc.sessionRename[0].title, '实现登录')

  const bindCall = calls.find((c) => c.url.endsWith('/bind'))!
  assert.deepEqual(JSON.parse(bindCall.init.body), { id: 'task-1', sessionId: 'sess-1' })
})

test('bindSession does NOT bind when the first prompt fails (task stays startable)', async () => {
  const { calls } = installFetch({
    session: () => jsonRes({ token: 'tok' }),
    bind: () => jsonRes({ ok: true }),
  })
  const { remotes } = makeRemotes({ prompt: () => ({ ok: false, error: { message: 'model unavailable' } }) })

  await assert.rejects(() => bindSession(remotes, makeTask(), '项目A'), /model unavailable/)
  assert.equal(calls.some((c) => c.url.endsWith('/bind')), false, 'must not persist a binding for a session whose prompt never ran')
})

test('bindSession does NOT bind when session creation fails', async () => {
  const { calls } = installFetch({ session: () => jsonRes({ token: 'tok' }), bind: () => jsonRes({ ok: true }) })
  const { remotes } = makeRemotes({ sessionCreate: () => ({ ok: false, error: { message: 'cwd missing' } }) })

  await assert.rejects(() => bindSession(remotes, makeTask(), '项目A'), /cwd missing/)
  assert.equal(calls.some((c) => c.url.endsWith('/bind')), false)
})

test('bindSession falls back to a cwd-bound session when the workspace call throws', async () => {
  installFetch({ session: () => jsonRes({ token: 'tok' }), bind: () => jsonRes({ ok: true }) })
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
  const { calls } = installFetch({ session: () => jsonRes({ token: 'tok' }), bind: () => jsonRes({ ok: true }) })
  const { remotes, calls: svc } = makeRemotes()

  const sessionId = await bindSession(remotes, makeTask(), '项目A', false)

  assert.equal(sessionId, 'sess-1')
  assert.equal(svc.prompt.length, 0)
  assert.equal(calls.some((c) => c.url.endsWith('/bind')), true)
})
