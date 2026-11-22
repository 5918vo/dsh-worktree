import { Ctx, SessionsLike } from './types.js'
import { normalizeConfig } from './config.js'
import { Store } from './store.js'
import { Runtime } from './runtime.js'
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
  sessionState?: (sessionId: string) => 'running' | 'idle' | 'unknown'
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
 * Probe one task session's run state.
 *
 * The authoritative source is the host agent registry (`agents.get(sessionId)`):
 * `uiSession` is a *client* service, so the host's `ctx.get('uiSession')` is
 * always empty and the old probe answered 'unknown' forever, which in turn made
 * every checkout/merge/cleanup refuse with 409 agent-unknown. A session without
 * a live agent cannot be running, so a miss is 'idle' — not 'unknown'.
 */
export function probeSessionState(host: any, sessionId: string): 'running' | 'idle' | 'unknown' {
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
      return agent ? agentRunState(agent) : 'idle'
    } catch {
      return 'unknown'
    }
  }
  try {
    return uiSessionRunState(get('uiSession'), sessionId)
  } catch {
    return 'unknown'
  }
}

/**
 * Host half of the deepseek-worktree plugin: git worktree task lifecycle plus
 * a board board. Each task is a real DSH session bound to its worktree — the
 * client creates that session via remote.session; the host only records the
 * binding and does the git work.
 */
export function apply(ctx: Ctx, rawConfig: unknown, options?: ApplyOptions): App {
  const config = normalizeConfig(rawConfig)
  const store = options?.store ?? new Store()
  // Unknown (registry present but throwing) still refuses mutations rather
  // than guessing; a session with no live agent is idle.
  const sessionState = (sessionId: string): 'running' | 'idle' | 'unknown' => probeSessionState(ctx, sessionId)
  const runtime = new Runtime({ store, config, sessionState: options?.sessionState ?? sessionState })
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
      .then(() => runtime.migrateLegacyStashes())
      .then(() => runtime.reconcilePendingOps())
      .then((results) => {
        for (const result of results) {
          if (result.status === 'needs-manual') logger.warn(`worktree pending operation needs manual handling: ${result.taskId} — ${result.message}`)
        }
      })
      .catch(() => {})
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
