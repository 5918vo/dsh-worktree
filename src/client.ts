import { initReact, React, h } from './client/ui'
import { setAppCtx } from './client/context'
import { FALLBACK, pickDict } from './client/i18n'
import { BoardIcon, BoardPage } from './client/board-page'
import { SettingsPage } from './client/settings-page'

export const MODULE_ID = '@5318vo/dsh-worktree'

type Req = (m: string) => any

/** factory(require) is called by window.__ModuleLoader__ with a module resolver. */
export function factory(require: Req) {
  initReact(require('react'))

  return {
    inject: ['slots', 'locale', 'remote', 'remote.session', 'remote.directoryPicker', 'remote.workspace', 'uiSession'],
    apply(ctx: any) {
      setAppCtx(ctx)
      const localeSvc = (() => {
        try {
          return ctx.get ? ctx.get('locale') : undefined
        } catch {
          return undefined
        }
      })()
      const dict = pickDict(localeSvc)
      try {
        if (localeSvc && typeof localeSvc.register === 'function') {
          try {
            localeSvc.register(MODULE_ID, { en: FALLBACK.en, zh: FALLBACK.zh })
          } catch {
            /* noop */
          }
        }
      } catch {
        /* noop */
      }
      // Resolve the dictionary on every render and re-render when the host
      // locale changes, so switching the GUI language updates live instead of
      // freezing the language that was active when the plugin was applied.
      const withT = (C: any) => (props: any) => {
        const [, force] = React.useState(0)
        React.useEffect(() => {
          if (!localeSvc || typeof localeSvc.subscribe !== 'function') return undefined
          let off: any
          try {
            off = localeSvc.subscribe(() => force((n: number) => n + 1))
          } catch {
            off = undefined
          }
          return () => {
            if (typeof off === 'function') off()
          }
        }, [])
        return h(C, Object.assign({}, props, { __t: pickDict(localeSvc) }))
      }
      ctx.effect(() => {
        const offs: Array<() => void> = []
        const reg = (slot: string, make: () => any) => {
          try {
            offs.push(ctx.slots.inject(slot, make))
          } catch {
            /* slot not available */
          }
        }
        reg('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'deepseek-worktree-settings', order: 61, label: dict.title }, withT(SettingsPage)))
        reg('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'worktree-board', order: 41, label: dict.title }, withT(BoardIcon)))
        reg('main', function* () { yield ctx.slots.register({ name: 'main', key: 'worktree-board', label: dict.title }, withT(BoardPage)) })
        return () => {
          for (const off of offs) {
            try {
              off()
            } catch {
              /* noop */
            }
          }
        }
      }, 'deepseek-worktree: slots')
    },
  }
}
