import test from 'node:test'
import assert from 'node:assert/strict'
import {
  attachDialogFocus,
  focusablesIn,
  initialFocusIndex,
  planDialogKey,
} from '../src/client/dialog-focus.js'

function el(name: string, overrides: Record<string, any> = {}) {
  const node: any = {
    name,
    tabIndex: 0,
    disabled: false,
    focused: 0,
    focus() { node.focused += 1; doc.activeElement = node },
    getClientRects: () => [{}],
    ...overrides,
  }
  return node
}

function fakeDoc() {
  const listeners: Array<{ type: string; fn: any }> = []
  const doc: any = {
    activeElement: null,
    addEventListener(type: string, fn: any) { listeners.push({ type, fn }) },
    removeEventListener(type: string, fn: any) {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn)
      if (i >= 0) listeners.splice(i, 1)
    },
    fire(event: any) {
      for (const l of listeners.slice()) l.fn(event)
    },
    listening: () => listeners.length,
  }
  return doc
}

let doc: any

function setup(extra: Array<any> = []) {
  doc = fakeDoc()
  const opener = el('opener')
  doc.activeElement = opener
  const cancel = el('cancel')
  const confirm = el('confirm')
  const hidden = el('hidden', { getClientRects: () => [] })
  const disabled = el('disabled', { disabled: true })
  const items = [cancel, confirm, hidden, disabled, ...extra]
  const visible = items.filter((n) => n !== hidden && n !== disabled)
  const root: any = {
    focused: 0,
    focus() { root.focused += 1; doc.activeElement = root },
    querySelectorAll() { return items },
  }
  return { opener, cancel, confirm, hidden, disabled, items, visible, root }
}

test('focusablesIn drops disabled, hidden and tabindex=-1 nodes but keeps DOM order', () => {
  const s = setup([el('negative', { tabIndex: -1 })])
  assert.deepEqual(focusablesIn(s.root).map((n: any) => n.name), ['cancel', 'confirm'])
  assert.deepEqual(focusablesIn(null), [])
})

test('initial focus prefers the requested node, else the first tabbable or the root', () => {
  const s = setup()
  assert.equal(initialFocusIndex(focusablesIn(s.root), s.confirm), 1)
  assert.equal(initialFocusIndex(focusablesIn(s.root), el('outside')), 0)
  assert.equal(initialFocusIndex([], s.confirm), -1)
})

test('Escape closes, but a busy dialog swallows it', () => {
  assert.deepEqual(planDialogKey({ key: 'Escape', activeIndex: 0, count: 3 }), { type: 'close' })
  assert.equal(planDialogKey({ key: 'Escape', busy: true, activeIndex: 0, count: 3 }), null)
})

test('Tab and Shift+Tab wrap at the edges and recover escaped focus', () => {
  assert.deepEqual(planDialogKey({ key: 'Tab', activeIndex: 2, count: 3 }), { type: 'focus', index: 0 })
  assert.deepEqual(planDialogKey({ key: 'Tab', activeIndex: -1, count: 3 }), { type: 'focus', index: 0 })
  assert.deepEqual(planDialogKey({ key: 'Tab', shift: true, activeIndex: 0, count: 3 }), { type: 'focus', index: 2 })
  assert.deepEqual(planDialogKey({ key: 'Tab', shift: true, activeIndex: -1, count: 3 }), { type: 'focus', index: 2 })
  // Interior moves are left to the browser so native tab order still works.
  assert.equal(planDialogKey({ key: 'Tab', activeIndex: 1, count: 3 }), null)
  assert.equal(planDialogKey({ key: 'Tab', shift: true, activeIndex: 1, count: 3 }), null)
  // No tabbable elements: never trap the user in a dead dialog.
  assert.equal(planDialogKey({ key: 'Tab', activeIndex: 0, count: 0 }), null)
  assert.equal(planDialogKey({ key: 'a', activeIndex: 0, count: 3 }), null)
})

test('attachDialogFocus focuses the preferred node, traps keys and restores the opener', () => {
  const s = setup()
  let closes = 0
  const cleanup = attachDialogFocus({ doc, root: s.root, initial: s.confirm, onClose: () => { closes += 1 } })
  assert.equal(doc.activeElement, s.confirm)
  assert.equal(doc.listening(), 1)

  doc.fire({ key: 'Tab', shiftKey: false, preventDefault() {} })
  assert.equal(doc.activeElement, s.cancel, 'Tab from the last stop wraps to the first')

  doc.fire({ key: 'Escape', preventDefault() {} })
  assert.equal(closes, 1)

  cleanup()
  assert.equal(doc.activeElement, s.opener)
  assert.equal(doc.listening(), 0)
  doc.fire({ key: 'Escape', preventDefault() {} })
  assert.equal(closes, 1, 'cleanup unsubscribes')
})

test('attachDialogFocus focuses the root when there is nothing tabbable, and honours busy', () => {
  doc = fakeDoc()
  const opener = el('opener')
  doc.activeElement = opener
  let busy = false
  const root: any = { focus() { doc.activeElement = root }, querySelectorAll: () => [] }
  const cleanup = attachDialogFocus({ doc, root, busy: () => busy, onClose: () => { busy = true } })
  assert.equal(doc.activeElement, root)
  busy = true
  doc.fire({ key: 'Escape', preventDefault() {} })
  assert.equal(doc.activeElement, root, 'busy Escape does not close or move focus')
  cleanup()
})
