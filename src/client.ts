import { initReact, h } from './client/ui'
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
      let dict = FALLBACK.zh
      try {
        const locale = ctx.get ? ctx.get('locale') : undefined
        dict = pickDict(locale)
        if (locale && typeof locale.register === 'function') {
          try {
            locale.register(MODULE_ID, { en: FALLBACK.en, zh: FALLBACK.zh })
          } catch {
            /* noop */
          }
        }
      } catch {
        /* noop */
      }
      const withT = (C: any) => (props: any) => h(C, Object.assign({}, props, { __t: dict }))
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
