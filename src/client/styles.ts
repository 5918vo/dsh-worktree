/**
 * Client stylesheet barrel.
 * Submodules live under './styles/*':
 * - panel: shared instrument-panel overrides
 * - legacy: .dshw-scope surface (project detail, settings, modals)
 * - workbench: three-zone workbench surface (.dshw-demo)
 */

export { PANEL_CSS } from './styles/panel'
export { CSS } from './styles/legacy'
export { WORKBENCH_CSS, WORKBENCH_CSS as DEMO_CSS } from './styles/workbench'
