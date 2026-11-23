import { Ctx, SessionsLike } from './types.js'
import { normalizeConfig } from './config.js'
import { Store } from './store.js'
import { Runtime } from './runtime.js'
import { AgentRunState } from './runtime/types.js'
import { WorktreeTask } from './models.js'
import { App } from './app.js'
import { registerTools } from './tools.js'
import { registerHttp } from './http.js'

/** Optional dependency overrides. Tests use this to keep host state isolated. */
export interface ApplyOptions {
  /**
   * Store to use instead of the default global ledger (`~/.dsh/worktree-tasks`).
   * Production never passes this, so the shared multi-instance ledger stays the
   * default; tests pass a temp-dir Store so they never leak projects or tasks
   * into the user's real board.
   */
  store?: Store
  /**
   * Override the session run-state probe. Production reads the host UI session
   * service; tests pass a deterministic probe (e.g. always 'idle').
   */
  sessionState?: (sessionId: string, task?: WorktreeTask) => AgentRunState
}

/**
 * Run state of one live agent, as reported by the host registry.
 * Anything other than an explicit `running`/`idle` stays 'unknown'.
 */
export function agentRunState(agent: any): 'running' | 'idle' | 'unknown' {
  const status = agent && typeof agent === 'object' ? agent.status : undefined
  if (status === 'running') return 'running'
  if (status === 'idle') return 'idle'
  return 'unknown'
}

/**
 * Legacy probe: the host UI-session service keeps a running flag per session.
 * Only used when the agent registry is unavailable (older hosts, tests).
 */
export function uiSessionRunState(service: any, sessionId: string): 'running' | 'idle' | 'unknown' {
  const snapshot = service && service.sessionStatus && typeof service.sessionStatus.getSnapshot === 'function'
    ? service.sessionStatus.getSnapshot()
    : null
  if (!snapshot) return 'unknown'
  const state = snapshot instanceof Map ? snapshot.get(sessionId) : snapshot && snapshot[sessionId]
  if (!state) return 'unknown'
  if (state.running === true) return 'running'
  if (state.running === false) return 'idle'
  return 'unknown'
}

/**
 * Agent object state for one session, plus whether this process can see the
 * session at all. `found: false` means "not in this process's registry", which
 * is *not* the same as "not running": another DSH window may own it.
 */
export function localAgentState(host: any, sessionId: string): { found: boolean; state: AgentRunState } {
  const get = (name: string) => {
    try {
      return typeof host.get === 'function' ? host.get(name) : undefined
    } catch {
      return undefined
    }
  }
  const agents: any = get('agents')
  if (agents && typeof agents.get === 'function') {
    try {
      const agent = agents.get(sessionId)
      return agent ? { found: true, state: agentRunState(agent) } : { found: false, state: 'unknown' }
    } catch {
      // A registry that throws leaves us without an answer, not with "idle".
      return { found: true, state: 'unknown' }
    }
  }
  return { found: false, state: 'unknown' }
}

/** Whether the host exposes an agent registry at all (older hosts may not). */
export function hasAgentRegistry(host: any): boolean {
  try {
    const agents: any = typeof host.get === 'function' ? host.get('agents') : undefined
    return !!agents && typeof agents.get === 'function'
  } catch {
    return false
  }
}

/**
 * Probe one task session's run state.
 *
 * The authoritative source is the host agent registry (`agents.get(sessionId)`),
 * which is *process-local*: a miss means this window cannot see the agent, not
 * that it is idle. Multiple DSH windows share the task ledger, so a miss is
 * resolved against the instance heartbeats (each live process publishes the
 * sessions it runs). Only when no live peer can be running the session do we
 * answer 'idle' — otherwise 'unknown', which refuses mutations instead of
 * merging a worktree out from under a running agent.
 *
 * Recovery paths for a binding no peer will ever confirm:
 * - the owning process ends the conversation → `sessions.on('session/disposed')`
 *   clears the binding in the shared ledger;
 * - the owning process crashes or exits → its heartbeat goes stale, peers stop
 *   claiming the session and it reads as idle again;
 * - the owning process is alive but frozen → explicit `session/reset`
 *   (`POST session/reset`) clears the binding by hand.
 */
export function probeSessionState(host: any, sessionId: string, deps?: { store?: Store }): AgentRunState {
  const local = localAgentState(host, sessionId)
  if (local.found) return local.state
  const registry = hasAgentRegistry(host)
  if (!registry) {
    // No agent registry at all: the UI-session snapshot is the only local hint.
    try {
      const legacy = uiSessionRunState(
        (() => {
          try {
            return typeof host.get === 'function' ? host.get('uiSession') : undefined
          } catch {
            return undefined
          }
        })(),
        sessionId,
      )
      if (legacy !== 'unknown') return legacy
    } catch {
      return 'unknown'
    }
  }
  const store = deps?.store
  // No ledger (unit tests, older hosts): a registry miss still means "no live
  // agent here", which is the historical single-process answer.
  if (!store) return registry ? 'idle' : 'unknown'
  if (!registry && store.hasOtherLiveInstance()) {
    // Blind here and someone else may be driving the session: do not guess.
    return 'unknown'
  }
  return store.lookupSessionRun(sessionId)
}

/**
 * Host half of the deepseek-worktree plugin: git worktree task lifecycle plus
 * a task board. Each task is a real DSH session bound to its worktree — the
 * client creates that session via remote.session; the host only records the
 * binding and does the git work.
 */
export function apply(ctx: Ctx, rawConfig: unknown, options?: ApplyOptions): App {
  const config = normalizeConfig(rawConfig)
  const store = options?.store ?? new Store()
  // Unknown (registry present but throwing) still refuses mutations rather
  // than guessing; a session with no live agent *and* no live peer owning it is
  // idle (see probeSessionState for the cross-instance rules).
  const sessionState = options?.sessionState
    ? options.sessionState
    : (sessionId: string, task?: WorktreeTask): AgentRunState => {
        void task
        const state = probeSessionState(ctx, sessionId, { store })
        // Our own running sessions must reach peers quickly: they gate merges
        // and checkouts made from another window.
        if (state === 'running') store.publishRunning(sessionId)
        return state
      }
  store.setRunningSessionsProvider(() => {
    const running: string[] = []
    for (const task of store.listTasks()) {
      const sessionId = task.sessionId
      if (!sessionId) continue
      const owner = task.sessionOwner
      if (owner && owner.instanceId && owner.instanceId !== store.instance().instanceId) {
        // A foreign instance owns this session. Mirror its live state rather
        // than publishing an empty list just because our registry cannot see it.
        const state = store.lookupSessionRun(sessionId)
        if (state === 'running') running.push(sessionId)
        continue
      }
      const local = localAgentState(ctx, sessionId)
      if (local.found && local.state === 'running') running.push(sessionId)
    }
    return running
  })
  const runtime = new Runtime({ store, config, sessionState })
  const logger = {
    info: (m: string) => {
      try {
        ctx.get('logger')?.info?.(m)
      } catch {
        /* noop */
      }
    },
    warn: (m: string) => {
      try {
        ctx.get('logger')?.warn?.(m)
      } catch {
        /* noop */
      }
    },
    error: (m: string) => {
      try {
        ctx.get('logger')?.error?.(m)
      } catch {
        /* noop */
      }
    },
  }

  const app: App = { ctx, store, config, runtime, tokens: new Map(), logger }

  ctx.effect(() => {
    void store
      .load()
      .then(() => {
        for (const warning of store.warnings()) logger.warn(warning)
      })
      .then(() => runtime.migrateLegacyStashes())
      .then(() => runtime.reconcilePendingOps())
      .then((results) => {
        for (const result of results) {
          if (result.status === 'needs-manual') logger.warn(`worktree pending operation needs manual handling: ${result.taskId} — ${result.message}`)
        }
      })
      .catch((error) =>
        logger.error(`worktree store load failed: ${error instanceof Error ? error.message : String(error)}`),
      )
    return () => store.dispose()
  }, 'deepseek-worktree: store')

  // A deleted conversation unbinds its task (the user removed it on purpose).
  ctx.inject(['sessions'], (host: any) => {
    const sessions: SessionsLike | undefined = host.sessions
    if (!sessions || typeof sessions.on !== 'function') return () => {}
    const off = sessions.on('session/disposed', (session: any) => {
      const id = session?.id
      if (!id) return
      const t = runtime.unbindBySession(String(id))
      if (t) logger.info(`worktree task unbound: ${t.id}`)
    })
    return () => {
      try {
        off()
      } catch {
        /* noop */
      }
    }
  })

  registerTools(app)
  registerHttp(app)

  try {
    if (typeof ctx.provide === 'function') ctx.provide('worktreeTasks', { app })
  } catch {
    /* noop */
  }
  return app
}
