/**
 * Client stylesheet barrel.
 * Submodules live under './styles/*':
 * - panel: shared instrument-panel overrides
 * - legacy: .dshw-scope surface (project detail, settings, modals)
 * - workbench: three-zone workbench surface (.dshw-board)
 *
 * Colour is never declared here: `palette.ts` owns every value and emits the
 * variables these sheets consume (`workbenchVars(theme)` for the board shell,
 * `paletteVars(p)` for the legacy .dshw-scope surfaces).
 */

export { PANEL_CSS } from './styles/panel'
export { CSS } from './styles/legacy'
export { WORKBENCH_CSS } from './styles/workbench'
