import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activeDrawer,
  closeAllDrawers,
  closeDrawer,
  dismissDrawer,
  toggleDrawer,
} from '../src/client/drawers.js'

const bothClosed = { railHidden: true, inspectorHidden: true }

test('narrow toggles are exclusive: opening one sheet closes the other', () => {
  const rail = toggleDrawer(bothClosed, 'rail', true)
  assert.deepEqual(rail, { railHidden: false, inspectorHidden: true })
  const inspector = toggleDrawer(rail, 'inspector', true)
  assert.deepEqual(inspector, { railHidden: true, inspectorHidden: false })
  const back = toggleDrawer(inspector, 'rail', true)
  assert.deepEqual(back, { railHidden: false, inspectorHidden: true })
})

test('wide toggles stay independent', () => {
  const rail = toggleDrawer(bothClosed, 'rail', false)
  assert.deepEqual(rail, { railHidden: false, inspectorHidden: true })
  const inspector = toggleDrawer(rail, 'inspector', false)
  assert.deepEqual(inspector, { railHidden: false, inspectorHidden: false })
})

test('closing one sheet never touches the other; closeAll clears both', () => {
  const open = { railHidden: false, inspectorHidden: false }
  assert.deepEqual(closeDrawer(open, 'rail'), { railHidden: true, inspectorHidden: false })
  assert.deepEqual(closeDrawer(open, 'inspector'), { railHidden: false, inspectorHidden: true })
  assert.deepEqual(closeAllDrawers(open), { railHidden: true, inspectorHidden: true })
})

test('activeDrawer only reports sheets in the narrow layout', () => {
  assert.equal(activeDrawer({ railHidden: false, inspectorHidden: false }, false, true), null)
  assert.equal(activeDrawer(bothClosed, true, true), null)
  assert.equal(activeDrawer({ railHidden: false, inspectorHidden: true }, true, true), 'rail')
  assert.equal(activeDrawer({ railHidden: true, inspectorHidden: false }, true, true), 'inspector')
  // Without a selected task the inspector cannot be a sheet even if its flag says otherwise.
  assert.equal(activeDrawer({ railHidden: true, inspectorHidden: false }, true, false), null)
})

test('the inspector wins the scrim when both flags are visible', () => {
  const both = { railHidden: false, inspectorHidden: false }
  assert.equal(activeDrawer(both, true, true), 'inspector')
  const dismissed = dismissDrawer(both, true, true)
  assert.equal(dismissed.closed, 'inspector')
  assert.deepEqual(dismissed.state, { railHidden: false, inspectorHidden: true })
})

test('dismissDrawer is a no-op when nothing is open or the layout is wide', () => {
  assert.deepEqual(dismissDrawer(bothClosed, true, true), { state: bothClosed, closed: null })
  const wide = { railHidden: false, inspectorHidden: false }
  assert.deepEqual(dismissDrawer(wide, false, true), { state: wide, closed: null })
})
