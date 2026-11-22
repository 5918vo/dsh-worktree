import test from 'node:test'
import assert from 'node:assert/strict'
import { agentRunState, probeSessionState } from '../src/index.js'
import { TaskError } from '../src/runtime.js'
import { assertAgentIdle } from '../src/runtime/types.js'

/** Minimal host context: `get(name)` answers only the injected services. */
function hostWith(services: Record<string, any>): any {
  return {
    get(name: string) {
      return services[name]
    },
  }
}

function registry(map: Record<string, any>): any {
  return { get: (id: string) => map[id] }
}

test('agentRunState only trusts an explicit running/idle status', () => {
  assert.equal(agentRunState({ status: 'running' }), 'running')
  assert.equal(agentRunState({ status: 'idle' }), 'idle')
  assert.equal(agentRunState({}), 'unknown')
  assert.equal(agentRunState(null), 'unknown')
})

test('probeSessionState reads the host agent registry', () => {
  const host = hostWith({ agents: registry({ run: { status: 'running' }, idle: { status: 'idle' } }) })
  assert.equal(probeSessionState(host, 'run'), 'running')
  assert.equal(probeSessionState(host, 'idle'), 'idle')
  // No live agent for this session: it cannot be running, so it is idle.
  assert.equal(probeSessionState(host, 'gone'), 'idle')
})

test('a registry that throws stays unknown instead of guessing idle', () => {
  const host = hostWith({
    agents: {
      get() {
        throw new Error('registry closed')
      },
    },
  })
  assert.equal(probeSessionState(host, 'x'), 'unknown')
})

test('the legacy uiSession probe is only a fallback and misses unknown sessions', () => {
  const uiSession = { sessionStatus: { getSnapshot: () => new Map([['known', { running: false }]]) } }
  const host = hostWith({ uiSession })
  assert.equal(probeSessionState(host, 'known'), 'idle')
  // This is exactly the old behaviour that blocked every operation: the host
  // context never had this service, so every session answered 'unknown'.
  assert.equal(probeSessionState(host, 'missing'), 'unknown')
  assert.equal(probeSessionState(hostWith({}), 'anything'), 'unknown')
})

test('the registry wins over a stale uiSession snapshot', () => {
  const host = hostWith({
    uiSession: { sessionStatus: { getSnapshot: () => new Map([['s1', { running: true }]]) } },
    agents: registry({}),
  })
  assert.equal(probeSessionState(host, 's1'), 'idle')
})

test('assertAgentIdle: idle agent passes, running agent is a 409', () => {
  const host = hostWith({ agents: registry({ run: { status: 'running' } }) })
  const ctx: any = { sessionState: (id: string) => probeSessionState(host, id) }

  assert.doesNotThrow(() => assertAgentIdle(ctx, { sessionId: 'unbound-but-live' } as any))
  assert.doesNotThrow(() => assertAgentIdle(ctx, { sessionId: null } as any))
  assert.throws(
    () => assertAgentIdle(ctx, { sessionId: 'run' } as any),
    (error: any) => error instanceof TaskError && error.status === 409 && error.code === 'agent-running',
  )
})

test('assertAgentIdle still refuses when the state cannot be verified', () => {
  const ctx: any = { sessionState: () => 'unknown' }
  assert.throws(
    () => assertAgentIdle(ctx, { sessionId: 's1' } as any),
    (error: any) => error instanceof TaskError && error.status === 409 && error.code === 'agent-unknown',
  )
})
