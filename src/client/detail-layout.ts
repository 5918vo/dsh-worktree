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
