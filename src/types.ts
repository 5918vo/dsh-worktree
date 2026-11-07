/**
 * Local structural types. No @deepseek-ai imports (not resolvable in the bundle
 * workspace and they drift across Harness versions). Only the members this
 * plugin actually uses are described.
 */

export type Json = unknown

/** A Cordis-style disposable. */
export type Disposer = () => void

/** A context with the small surface this plugin relies on. */
export interface Ctx {
  effect(fn: () => void | Disposer, label?: string): Disposer
  on(event: string, listener: (...args: any[]) => any): Disposer
  get(name: string): any
  inject(deps: string[], callback: (host: any) => void): Disposer
  provide?(name: string, value: unknown): Disposer
  fiber?: { entry?: any }
}

export interface AgentLike {
  id: string
  status?: string
}

export interface SessionLike {
  id?: string
  events?: any[]
}

export interface SessionsLike {
  get?(id: string): SessionLike | undefined
  list?(): any[]
  on?(event: string, listener: (...a: any[]) => void): Disposer
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: {
    schema: Record<string, unknown>
    render(args: unknown, value: Json): Array<{ type: 'text'; text: string }>
  }
  execute(args: any, exec: { agent?: AgentLike; signal?: AbortSignal; callId?: string }): Promise<Json>
}

export interface ToolsLike {
  register(def: ToolDefinition, options?: { when?: (c: { agent?: AgentLike }) => boolean }): Disposer
}

export interface WebRoute {
  kind: 'exact'
  path: string
  handler: (req: any, res: any) => void | Promise<void>
}

export interface WebServerLike {
  register(route: WebRoute): Disposer
}
