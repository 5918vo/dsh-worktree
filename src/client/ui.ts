import { CSS } from './styles'

let hostReact: any = null

/** The host owns React; every component module reads it through this live proxy. */
export const React: any = new Proxy({}, {
  get(_target, key) {
    if (!hostReact) throw new Error('React is not initialized')
    return hostReact[key]
  },
})

export function initReact(react: any) {
  hostReact = react
}

export const PRIMITIVES_MODULE = '@deepseek-ai/dsh-client-ui-primitives'

/** Exports the board relies on; a host that lacks any of them keeps the legacy atoms. */
const REQUIRED_PRIMITIVES = [
  'Button',
  'Checkbox',
  'DisclosureRow',
  'Input',
  'Modal',
  'PathLabel',
  'Pill',
  'SegmentedControl',
  'SegmentedTabs',
  'StateDot',
  'Switch',
  'Tag',
  'Toast',
  'Tooltip',
]

let hostPrim: any = null

/**
 * The host registers its shared UI primitives as a static module, so this is a
 * synchronous require. Everything optional is probed at call time through
 * `prim()`; only the atoms the board cannot live without gate the whole switch.
 */
export function initPrimitives(require: (id: string) => any) {
  let mod: any
  try {
    mod = require(PRIMITIVES_MODULE)
  } catch (error) {
    console.warn('[dsh-worktree] UI primitives unavailable, using built-in controls', error)
    hostPrim = null
    return
  }
  const missing = REQUIRED_PRIMITIVES.filter((name) => mod == null || typeof mod[name] !== 'function')
  if (missing.length > 0) {
    console.warn('[dsh-worktree] UI primitives incomplete, using built-in controls; missing:', missing.join(', '))
    hostPrim = null
    return
  }
  hostPrim = mod
}

/** The host primitives module, or null when this host predates it. */
export function prim(): any {
  return hostPrim
}

/** One primitive export, or undefined so callers can fall back per component. */
export function primOf(name: string): any {
  const value = hostPrim ? hostPrim[name] : undefined
  return typeof value === 'function' ? value : undefined
}

export function h(type: any, props?: any, ...children: any[]): any {
  if (!hostReact) throw new Error('React is not initialized')
  return hostReact.createElement(type, props, ...children)
}

let styleRefs = 0
let sharedStyleEl: any = null

export function useStyles() {
  React.useEffect(() => {
    styleRefs += 1
    if (!sharedStyleEl || !sharedStyleEl.isConnected) {
      sharedStyleEl = document.createElement('style')
      sharedStyleEl.setAttribute('data-dshw', '1')
      sharedStyleEl.textContent = CSS
      document.head.appendChild(sharedStyleEl)
    }
    // Native <select> popups are painted by the OS: tell it which scheme to use.
    const applyScheme = () => {
      const probeEl = document.createElement('span')
      probeEl.style.cssText = 'position:fixed;left:-9999px;top:0;color:var(--dsw-alias-label-primary,#000)'
      document.body.appendChild(probeEl)
      const rgb = getComputedStyle(probeEl).color.match(/\d+/g)
      probeEl.remove()
      const lum = rgb ? (Number(rgb[0]) * 299 + Number(rgb[1]) * 587 + Number(rgb[2]) * 114) / 1000 : 0
      document.documentElement.classList.toggle('dshw-dark', lum > 140)
    }
    applyScheme()
    const mo = new MutationObserver(applyScheme)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
    mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const onScheme = () => applyScheme()
    if (media) {
      if (typeof (media as any).addEventListener === 'function') (media as any).addEventListener('change', onScheme)
      else if (typeof (media as any).addListener === 'function') (media as any).addListener(onScheme)
    }
    return () => {
      mo.disconnect()
      if (media) {
        if (typeof (media as any).removeEventListener === 'function') (media as any).removeEventListener('change', onScheme)
        else if (typeof (media as any).removeListener === 'function') (media as any).removeListener(onScheme)
      }
      styleRefs = Math.max(0, styleRefs - 1)
      if (styleRefs === 0 && sharedStyleEl) {
        try {
          sharedStyleEl.remove()
        } catch {
          /* noop */
        }
        sharedStyleEl = null
      }
    }
  }, [])
}
