import { React } from './ui'

/**
 * One dialog focus implementation for every overlay that renders its own shell
 * (confirm, stash diff, publish, add project). The host Matrix Modal owns focus
 * when it is available; these helpers cover the built-in fallback.
 *
 * The decision and DOM plumbing live in plain functions so keyboard behaviour
 * can be tested without a browser; `useDialogFocus` is a thin React wrapper.
 */

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]',
].join(',')

interface FocusableLike {
  disabled?: boolean
  hidden?: boolean
  tabIndex?: number
  getClientRects?: () => ArrayLike<unknown>
  focus?: () => void
}

export interface FocusDoc {
  activeElement: any
  addEventListener: (type: string, listener: any, capture?: boolean) => void
  removeEventListener: (type: string, listener: any, capture?: boolean) => void
}

export interface FocusRoot {
  focus?: () => void
  querySelectorAll: (selector: string) => ArrayLike<FocusableLike>
}

function isTabbable(el: FocusableLike): boolean {
  if (!el || el.disabled || el.hidden) return false
  if (typeof el.tabIndex === 'number' && el.tabIndex < 0) return false
  // `display:none` and collapsed containers return no rects; a fake element
  // without the method is assumed visible.
  if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false
  return true
}

/** Tabbable elements under `root`, in DOM order. */
export function focusablesIn(root: FocusRoot | null | undefined): FocusableLike[] {
  if (!root || typeof root.querySelectorAll !== 'function') return []
  const list = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))
  return list.filter(isTabbable)
}

export interface DialogKeyInput {
  key: string
  shift?: boolean
  busy?: boolean
  /** Index of the focused element inside the tab order; -1 when focus escaped. */
  activeIndex: number
  /** Number of tabbable elements. */
  count: number
}

export type DialogKeyPlan = { type: 'close' } | { type: 'focus'; index: number } | null

/**
 * Pure keyboard decision. Escape closes unless a submit is in flight; Tab and
 * Shift+Tab stay inside the tab order and recover focus that escaped the root.
 */
export function planDialogKey(input: DialogKeyInput): DialogKeyPlan {
  if (input.key === 'Escape') return input.busy ? null : { type: 'close' }
  if (input.key !== 'Tab' || input.count <= 0) return null
  const last = input.count - 1
  const active = input.activeIndex
  if (input.shift) {
    if (active <= 0) return { type: 'focus', index: last }
    return null
  }
  if (active < 0 || active >= last) return { type: 'focus', index: 0 }
  return null
}

/** Index of the element to focus when opening; -1 keeps the root itself. */
export function initialFocusIndex(list: FocusableLike[], preferred?: FocusableLike | null): number {
  if (preferred) {
    const index = list.indexOf(preferred)
    if (index >= 0) return index
  }
  return list.length > 0 ? 0 : -1
}

export interface AttachDialogFocusOptions {
  doc: FocusDoc
  root: FocusRoot | null | undefined
  /** Preferred first stop, usually the title or the cancel button. */
  initial?: FocusableLike | null
  /** Read live: a busy dialog swallows Escape so a submit is not lost. */
  busy?: () => boolean
  onClose: () => void
}

/**
 * Wire initial focus, Tab/Shift+Tab containment, Escape, and focus restore.
 * Returns the cleanup that removes the listener and restores the opener.
 */
export function attachDialogFocus(options: AttachDialogFocusOptions): () => void {
  const { doc } = options
  const saved = doc.activeElement || null
  const focus = (el: any) => {
    if (el && typeof el.focus === 'function') {
      try {
        el.focus()
      } catch {
        /* focus can throw on detached nodes; nothing to recover */
      }
    }
  }
  const order = () => focusablesIn(options.root)
  const list = order()
  const index = initialFocusIndex(list, options.initial)
  focus(index >= 0 ? list[index] : options.root)

  const onKey = (event: any) => {
    const items = order()
    const active = items.indexOf(doc.activeElement)
    const plan = planDialogKey({
      key: event && event.key,
      shift: !!(event && event.shiftKey),
      busy: options.busy ? options.busy() : false,
      activeIndex: active,
      count: items.length,
    })
    if (!plan) return
    if (typeof event.preventDefault === 'function') event.preventDefault()
    if (plan.type === 'close') {
      options.onClose()
      return
    }
    focus(items[plan.index])
  }
  doc.addEventListener('keydown', onKey, true)
  return () => {
    doc.removeEventListener('keydown', onKey, true)
    focus(saved)
  }
}

export interface UseDialogFocusOptions {
  rootRef: { current: FocusRoot | null }
  initialRef?: { current: FocusableLike | null }
  busyRef?: { current: boolean }
  onClose: () => void
}

/** React glue: mount = trap, unmount = restore. Re-reads `onClose` each render. */
export function useDialogFocus(options: UseDialogFocusOptions) {
  const closeRef = React.useRef(options.onClose)
  closeRef.current = options.onClose
  const busyRef = options.busyRef
  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined
    return attachDialogFocus({
      doc: document as any,
      root: options.rootRef.current,
      initial: options.initialRef ? options.initialRef.current : null,
      busy: () => !!(busyRef && busyRef.current),
      onClose: () => closeRef.current(),
    })
    // Mount/unmount only: the dialog owns its lifetime, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
