import test from 'node:test'
import assert from 'node:assert/strict'
import { attachFocusTrap } from '../src/client/dialog-focus.js'
import { drawerFocusTrap } from '../src/client/drawers.js'

/**
 * The narrow rail/inspector are overlay sheets but not modals: they need Tab
 * containment without owning Escape. These use the same fake document as
 * `client-dialog-focus.test.ts`, never a real browser.
 */

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

/** Rail and inspector scopes with distinct stops, so a leak is visible. */
function scopes() {
  doc = fakeDoc()
  const opener = el('opener')
  doc.activeElement = opener
  const railClose = el('rail-close')
  const railSearch = el('rail-search')
  const railPublish = el('rail-publish')
  const inspClose = el('insp-close')
  const inspCopy = el('insp-copy')
  const inspDelete = el('insp-delete')
  const stageButton = el('stage-button')
  const rail = {
    items: [railClose, railSearch, railPublish],
    querySelectorAll() { return [railClose, railSearch, railPublish] },
  }
  const inspector = {
    items: [inspClose, inspCopy, inspDelete],
    querySelectorAll() { return [inspClose, inspCopy, inspDelete] },
  }
  return { opener, rail, inspector, railClose, railSearch, railPublish, inspClose, inspCopy, inspDelete, stageButton }
}

function press(key: string, shift = false) {
  let prevented = 0
  doc.fire({ key, shiftKey: shift, preventDefault() { prevented += 1 } })
  return prevented
}

test('the active rail sheet contains Tab and Shift+Tab, never a neighbouring scope', () => {
  const s = scopes()
  assert.equal(drawerFocusTrap({ railHidden: false, inspectorHidden: true }, true, true, false), 'rail')
  const cleanup = attachFocusTrap({ doc, root: s.rail })
  assert.equal(doc.listening(), 1)

  // Last stop + Tab wraps to the first rail stop, not to the inspector/stage.
  doc.activeElement = s.railPublish
  assert.equal(press('Tab'), 1)
  assert.equal(doc.activeElement, s.railClose)
  // First stop + Shift+Tab wraps to the last rail stop.
  assert.equal(press('Tab', true), 1)
  assert.equal(doc.activeElement, s.railPublish)
  // Interior moves stay native so the browser's own order is untouched.
  doc.activeElement = s.railSearch
  assert.equal(press('Tab'), 0)
  assert.equal(press('Tab', true), 0)
  // Focus that escaped the sheet is recovered on the next Tab.
  doc.activeElement = s.stageButton
  assert.equal(press('Tab'), 1)
  assert.equal(doc.activeElement, s.railClose)
  cleanup()
})

test('the active inspector sheet contains Tab and wins over the rail', () => {
  const s = scopes()
  const state = { railHidden: false, inspectorHidden: false }
  assert.equal(drawerFocusTrap(state, true, true, false), 'inspector')
  const cleanup = attachFocusTrap({ doc, root: s.inspector })

  doc.activeElement = s.inspDelete
  assert.equal(press('Tab'), 1)
  assert.equal(doc.activeElement, s.inspClose)
  assert.equal(press('Tab', true), 1)
  assert.equal(doc.activeElement, s.inspDelete)
  // A stop from the other sheet is outside this root: Tab pulls focus back in.
  doc.activeElement = s.railSearch
  assert.equal(press('Tab'), 1)
  assert.equal(doc.activeElement, s.inspClose)
  cleanup()
})

test('no active drawer means no trap, and a narrow layout alone is not enough', () => {
  const closed = { railHidden: true, inspectorHidden: true }
  assert.equal(drawerFocusTrap(closed, true, true, false), null)
  // Wide containers keep the rail visible without making it a sheet.
  assert.equal(drawerFocusTrap({ railHidden: false, inspectorHidden: true }, false, true, false), null)
  // A stray inspector flag without a selected task cannot trap.
  assert.equal(drawerFocusTrap({ railHidden: true, inspectorHidden: false }, true, false, false), null)

  const s = scopes()
  assert.equal(drawerFocusTrap(closed, true, true, false), null)
  doc.activeElement = s.stageButton
  assert.equal(press('Tab'), 0)
  assert.equal(doc.listening(), 0)
})

test('focus parked outside the owner (host chat) is not pulled back into the sheet', () => {
  const s = scopes()
  const board = new Set([s.railClose, s.railSearch, s.railPublish, s.stageButton])
  const cleanup = attachFocusTrap({ doc, root: s.rail, owns: (active: any) => board.has(active) })
  // Stage is still ours: recovery is expected.
  doc.activeElement = s.stageButton
  assert.equal(press('Tab'), 1)
  assert.equal(doc.activeElement, s.railClose)
  // A host widget/modals outside the board keep Tab for themselves.
  const hostComposer = el('host-composer')
  doc.activeElement = hostComposer
  assert.equal(press('Tab'), 0)
  assert.equal(doc.activeElement, hostComposer)
  cleanup()
})

test('an open modal owns focus: no drawer trap is attached', () => {
  const state = { railHidden: false, inspectorHidden: true }
  assert.equal(drawerFocusTrap(state, true, true, true), null)
  const s = scopes()
  doc.activeElement = s.stageButton
  assert.equal(press('Tab'), 0, 'the modal keeps its own tab order')
  assert.equal(doc.listening(), 0)
})

test('the trap never consumes Escape: the board handler stays the only closer', () => {
  const s = scopes()
  const cleanup = attachFocusTrap({ doc, root: s.rail })
  let closed = 0
  // The board-level listener this scenario keeps outside the trap.
  doc.addEventListener('keydown', (event: any) => { if (event.key === 'Escape') closed += 1 })

  const prevented = press('Escape')
  assert.equal(prevented, 0, 'Escape is not swallowed or re-dispatched')
  assert.equal(closed, 1, 'exactly one owner closes the drawer')
  assert.equal(doc.listening(), 2, 'the trap is still attached')
  cleanup()
})

test('hiding or switching the sheet cleans the trap up without moving focus', () => {
  const s = scopes()
  // Open rail.
  const cleanupRail = attachFocusTrap({ doc, root: s.rail })
  doc.activeElement = s.railPublish
  assert.equal(press('Tab'), 1)
  assert.equal(doc.activeElement, s.railClose)
  // The rail hides and the inspector opens: React would run this cleanup first.
  cleanupRail()
  assert.equal(doc.listening(), 0)
  const parked = s.inspClose
  doc.activeElement = parked
  assert.equal(press('Tab'), 0, 'a hidden sheet must not keep trapping')
  assert.equal(doc.activeElement, parked, 'cleanup does not steal focus from the new sheet')

  // The inspector trap then takes over and contains only its own stops.
  const cleanupInspector = attachFocusTrap({ doc, root: s.inspector })
  doc.activeElement = s.inspDelete
  assert.equal(press('Tab'), 1)
  assert.equal(doc.activeElement, s.inspClose)
  cleanupInspector()
  assert.equal(doc.listening(), 0)
})
