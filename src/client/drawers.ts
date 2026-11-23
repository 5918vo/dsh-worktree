/**
 * Narrow-layout drawer bookkeeping.
 *
 * At <=720px the rail and the inspector become overlay sheets. Only one may be
 * open at a time: the inspector is the task-scoped surface and wins, so opening
 * the rail closes it and vice versa. The rules are pure so they can be tested
 * without laying anything out.
 */

export interface DrawerState {
  railHidden: boolean
  inspectorHidden: boolean
}

export type DrawerSide = 'rail' | 'inspector'

/** Toggle one side; on narrow containers the other side closes first. */
export function toggleDrawer(state: DrawerState, side: DrawerSide, narrow: boolean): DrawerState {
  if (side === 'rail') {
    const railHidden = !state.railHidden
    return { railHidden, inspectorHidden: narrow && !railHidden ? true : state.inspectorHidden }
  }
  const inspectorHidden = !state.inspectorHidden
  return { inspectorHidden, railHidden: narrow && !inspectorHidden ? true : state.railHidden }
}

/** Close one side, leaving the other untouched. */
export function closeDrawer(state: DrawerState, side: DrawerSide): DrawerState {
  return side === 'rail' ? { ...state, railHidden: true } : { ...state, inspectorHidden: true }
}

/** Close both; used when the container stops being narrow. */
export function closeAllDrawers(state: DrawerState): DrawerState {
  return { ...state, railHidden: true, inspectorHidden: true }
}

/**
 * The sheet that owns the scrim. `hasInspector=false` (no selected task) means
 * the rail is the only possible sheet; a selected task prefers the inspector.
 */
export function activeDrawer(state: DrawerState, narrow: boolean, hasInspector: boolean): DrawerSide | null {
  if (!narrow) return null
  // The inspector paints above the rail, so it owns the scrim whenever both
  // happen to be visible.
  if (hasInspector && !state.inspectorHidden) return 'inspector'
  if (!state.railHidden) return 'rail'
  return null
}

/**
 * The sheet that may own a Tab trap. `narrow` is only a layout fact: the trap
 * follows the *active* sheet, never a hidden one, and an open modal owns focus
 * entirely (it also owns Escape).
 */
export function drawerFocusTrap(
  state: DrawerState,
  narrow: boolean,
  hasInspector: boolean,
  modalOpen: boolean,
): DrawerSide | null {
  if (modalOpen) return null
  return activeDrawer(state, narrow, hasInspector)
}

/** Escape/scrim click closes the visible sheet and reports which one it was. */
export function dismissDrawer(state: DrawerState, narrow: boolean, hasInspector: boolean): { state: DrawerState; closed: DrawerSide | null } {
  const side = activeDrawer(state, narrow, hasInspector)
  if (!side) return { state, closed: null }
  return { state: closeDrawer(state, side), closed: side }
}
