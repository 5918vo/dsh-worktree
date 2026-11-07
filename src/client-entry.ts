import { factory, MODULE_ID } from './client.js'

declare global {
  interface Window {
    __ModuleLoader__: { load(def: { id: string; factory: (require: (m: string) => any) => any }): void }
  }
}

window.__ModuleLoader__.load({ id: MODULE_ID, factory })
