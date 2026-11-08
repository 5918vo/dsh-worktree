import { apply } from '../../src/index.js'

export interface HostHarness {
  ctx: any
  tools: any[]
  routes: any[]
}

/**
 * Boot the real host plugin against a fake Cordis context and capture everything
 * it registers. The effect callbacks are intentionally not executed: tests drive
 * the store directly, and skipping `store.load()` avoids clobbering data mid-test.
 */
export function makeCtx(): { ctx: any; tools: any[]; routes: any[] } {
  const tools: any[] = []
  const routes: any[] = []
  const host: any = {
    tools: {
      register(def: any) {
        tools.push(def)
        return () => {}
      },
    },
    webServer: {
      register(route: any) {
        routes.push(route)
        return () => {}
      },
    },
    sessions: { on: () => () => {} },
  }
  const ctx = {
    effect(_fn: () => unknown) {
      return () => {}
    },
    on() {
      return () => {}
    },
    get() {
      return undefined
    },
    inject(deps: string[], cb: (h: any) => any) {
      const h: any = {}
      for (const dep of deps) h[dep] = host[dep]
      const result = cb(h)
      return typeof result === 'function' ? result : () => {}
    },
    provide() {
      return () => {}
    },
  }
  return { ctx, tools, routes }
}

/** Boot the host plugin (registers tools + HTTP routes) and return the harness. */
export function bootHost(rawConfig?: unknown): HostHarness {
  const { ctx, tools, routes } = makeCtx()
  apply(ctx, rawConfig)
  return { ctx, tools, routes }
}
