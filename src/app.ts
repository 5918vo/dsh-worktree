import { Ctx } from './types.js'
import { Store } from './store.js'
import { WorktreeConfig } from './models.js'
import { Runtime } from './runtime.js'

/** Shared application context handed to tools, http and the client bridge. */
export interface App {
  ctx: Ctx
  store: Store
  config: WorktreeConfig
  runtime: Runtime
  tokens: Map<string, string>
  logger: { info(msg: string): void; warn(msg: string): void; error(msg: string): void }
}
