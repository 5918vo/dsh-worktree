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
 * Host half of the deepseek-worktree plugin: git worktree task lifecycle plus
 * a board board. Each task is a real DSH session bound to its worktree — the
 * client creates that session via remote.session; the host only records the
 * binding and does the git work.
 */
export function apply(ctx: Ctx, rawConfig: unknown, options?: ApplyOptions): App {
  const config = normalizeConfig(rawConfig)
  const store = options?.store ?? new Store()
  // Probe a task session's run state from the host UI session service. Unknown
  // (service/session not resolvable) is reported as 'unknown' so mutations that
  // could clobber a running agent are refused rather than guessed.
  const sessionState = (sessionId: string): 'running' | 'idle' | 'unknown' => {
    try {
      const svc: any = ctx.get('uiSession')
      const snapshot = svc && svc.sessionStatus && typeof svc.sessionStatus.getSnapshot === 'function'
        ? svc.sessionStatus.getSnapshot()
        : null
      if (!snapshot) return 'unknown'
      const state = snapshot instanceof Map ? snapshot.get(sessionId) : snapshot && snapshot[sessionId]
      if (!state) return 'unknown'
      if (state.running === true) return 'running'
      if (state.running === false) return 'idle'
      return 'unknown'
    } catch {
      return 'unknown'
    }
  }
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
