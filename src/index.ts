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
  const runtime = new Runtime({ store, config })
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
    void store.load()
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
