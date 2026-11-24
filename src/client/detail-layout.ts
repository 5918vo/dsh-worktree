/**
 * Class composition for the detail panes.
 *
 * The project detail reuses the board's `inspectorHidden` state, so its topbar
 * toggle really collapses the side panel instead of leaving an empty grid
 * column (and an unreachable "close" affordance) behind. Kept framework-free so
 * the composition can be unit-tested without a DOM.
 */
export function stageGridClass(inspectorHidden: boolean): string {
  return 'dshw-detail-inner dshw-stage-grid' + (inspectorHidden ? ' dshw-inspector-hidden' : '')
}

/**
 * Attributes for a panel toggle. The label describes what a click does (not the
 * current state) and `aria-expanded` reports the state, so screen readers and
 * tooltips agree with the button the user is about to press.
 */
export function panelToggleAttrs(hidden: boolean, t: { expand: string; collapse: string }) {
  return {
    title: hidden ? t.expand : t.collapse,
    'aria-label': hidden ? t.expand : t.collapse,
    'aria-expanded': hidden ? 'false' : 'true',
  }
}
