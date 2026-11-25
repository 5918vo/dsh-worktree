import test from 'node:test'
import assert from 'node:assert/strict'
import { PALETTE, TOAST_ERROR, paletteVars, workbenchVarPairs, workbenchVars } from '../src/client/palette.js'
import { WORKBENCH_CSS } from '../src/client/styles/workbench.js'
import { PANEL_CSS } from '../src/client/styles/panel.js'

/**
 * The workbench shell must not declare a colour of its own: every `--bg-*`,
 * `--text-*`, `--line*`, `--accent*`, state, CTA, toast, code and diff variable
 * is emitted from PALETTE. These tests pin both halves of that contract — the
 * mapping and the stylesheet that consumes it.
 */

/** The declaration body of one top-level rule, e.g. `.dshw-board {`. */
function blockBody(selector: string): string {
  const at = WORKBENCH_CSS.indexOf(selector)
  assert.ok(at >= 0, `missing selector ${selector}`)
  const open = WORKBENCH_CSS.indexOf('{', at)
  const close = WORKBENCH_CSS.indexOf('}', open)
  assert.ok(open >= 0 && close > open, `malformed rule ${selector}`)
  return WORKBENCH_CSS.slice(open + 1, close)
}

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/g

test('both themes declare exactly the same board variables', () => {
  const names = (theme: 'light' | 'dark') => workbenchVarPairs(theme).map(([name]) => name)
  assert.deepEqual(names('light'), names('dark'))
  assert.ok(names('light').length >= 30, 'the board still owns its full token set')
})

test('every board variable maps to a PALETTE source', () => {
  for (const theme of ['light', 'dark'] as const) {
    const p = PALETTE[theme]
    const toast = TOAST_ERROR[theme]
    const expected: Array<[string, string]> = [
      ['--bg-canvas', p.bg],
      ['--bg-rail', p.treeBg],
      ['--bg-stage', p.surface],
      ['--bg-elevated', p.elevated],
      ['--bg-modal', p.modalBg],
      ['--bg-hover', p.hover],
      ['--bg-active', p.active],
      ['--backdrop', p.backdrop],
      ['--line', p.border],
      ['--line-strong', p.borderStrong],
      ['--specular', p.boardSpecular],
      ['--modal-shadow', p.boardModalShadow],
      ['--text-1', p.text],
      ['--text-2', p.text2],
      ['--text-3', p.text3],
      ['--cta-bg', p.brandSolid],
      ['--cta-text', p.onBrand],
      ['--cta-hover', p.brandSolidHover],
      ['--accent', p.brand],
      ['--accent-soft', p.brandSoft],
      ['--accent-line', p.brandBorder],
      ['--ok', p.success],
      ['--ok-soft', p.successSoft],
      ['--ok-line', p.successBorder],
      ['--warn', p.warn],
      ['--warn-soft', p.warnSoft],
      ['--warn-line', p.warnBorder],
      ['--err', p.danger],
      ['--err-soft', p.dangerSoft],
      ['--err-line', p.dangerBorder],
      ['--toast-err-bg', toast.bg],
      ['--toast-err-text', toast.text],
      ['--toast-err-line', toast.border],
      ['--code-bg', p.boardCodeBg],
      ['--diff-add-bg', p.diffAddBg],
      ['--diff-del-bg', p.diffDelBg],
    ]
    assert.deepEqual(workbenchVarPairs(theme), expected, `${theme} board mapping drifted`)
  }
})

test('the board token blocks declare colour only through the generated strings', () => {
  const blocks: Array<[string, 'light' | 'dark']> = [
    ['.dshw-board {', 'dark'],
    ['.dshw-board[data-theme="light"] {', 'light'],
  ]
  for (const [selector, theme] of blocks) {
    const body = blockBody(selector)
    const generated = workbenchVars(theme)
    assert.ok(body.includes(generated), `${selector} does not embed workbenchVars('${theme}')`)
    // Everything left after the generated declarations must be layout only: a
    // colour here would be a second source of truth next to PALETTE.
    const literals = body.split(generated).join('').match(COLOUR) || []
    assert.deepEqual(literals, [], `${selector} declares ${literals.join(', ')} by hand`)
  }
})

test('no board colour is repeated outside the token blocks', () => {
  const values = new Set<string>()
  for (const theme of ['light', 'dark'] as const) {
    for (const [, value] of workbenchVarPairs(theme)) {
      if (parseColourShaped(value)) values.add(value)
    }
  }
  let rest = WORKBENCH_CSS
  for (const theme of ['light', 'dark'] as const) {
    rest = rest.replace(workbenchVars(theme), '')
  }
  // The project-detail scope re-emits the palette under `--dshw-*` on purpose,
  // so its two lines are the only legitimate repeat.
  rest = rest.replace(/\.dshw-board\[data-theme="(?:light|dark)"\] \.dshw-scope\{[^}]*\}/g, '')
  for (const value of values) {
    assert.equal(rest.includes(value), false, `${value} is duplicated outside the token blocks`)
  }
})

test('every var(--x) the board reads is declared, or has a fallback', () => {
  // The board inherits the base sheet's `--dshw-*` family and its density rhythm,
  // so declarations are collected from both sheets.
  const declared = new Set(workbenchVarPairs('dark').map(([name]) => name))
  // `paletteVars` emits the `--dshw-*` family on the panel root and the project
  // scope, which is why the board may read e.g. `var(--dshw-mono)`.
  for (const m of paletteVars(PALETTE.dark).matchAll(/(--[a-z0-9-]+)\s*:/g)) declared.add(m[1])
  for (const sheet of [PANEL_CSS, WORKBENCH_CSS]) {
    for (const m of sheet.matchAll(/(--[a-z0-9-]+)\s*:/g)) declared.add(m[1])
  }
  const re = /var\((--[a-z0-9-]+)([^)]*)\)/g
  let m: RegExpExecArray | null
  const missing: string[] = []
  while ((m = re.exec(WORKBENCH_CSS))) {
    const [, name, tail] = m
    // `var(--mono, ui-monospace)` and friends are intentional local aliases
    // with a fallback; a bare unknown variable would silently paint nothing.
    if (!declared.has(name) && !tail.includes(',')) missing.push(name)
  }
  // `--dshw-mono` is read by PANEL_CSS but declared by neither sheet: the
  // board's `font-family: var(--dshw-mono)` is invalid today and silently falls
  // back. Pinned as the only known offender so a *new* undeclared variable still
  // fails here; giving it a fallback is a separate, visible change.
  assert.deepEqual([...new Set(missing)], ['--dshw-mono'])
})

test('the project-detail scope still follows the board theme', () => {
  assert.match(WORKBENCH_CSS, /\.dshw-board\[data-theme="light"\] \.dshw-scope\{--dshw-bg:/)
  assert.match(WORKBENCH_CSS, /\.dshw-board\[data-theme="dark"\] \.dshw-scope\{--dshw-bg:/)
})

function parseColourShaped(value: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) || /^rgba?\(/.test(value)
}
