/* --------------------------------------------------------------------------
 * Palette — the single source of truth for every colour in the workbench.
 *
 * Design language: "Instrument panel" (mirrors docs/ui-prototype.html).
 *   Dark  — near-black paper (#0b0b0c) with a darker shell for rail/terminal;
 *           a single copper accent marks liveness and primary action; the
 *           primary button inverts to ink so it reads as a stamp, not a chip.
 *   Light — warm paper (#f8f5ef) with a slightly darker shell; the same copper
 *           accent, darkened for contrast. Colour is reserved for Git state,
 *           agent vitals and the accent — never for chrome.
 *
 * Rules of the system:
 *   · Every hairline is rgba over paper, never a solid grey — it disappears
 *     into the background instead of drawing boxes.
 *   · --dshw-text-3 is metadata ink; it must stay >= 4.5:1 on bg (AA, 11–12px).
 *   · Shadows are for overlays only; inline chrome uses rules.
 *
 * To re-skin the plugin, edit only this object. Every rule below consumes
 * --dshw-* variables generated from these tokens; no colour literals should
 * appear in any other part of the stylesheet.
 *
 * Two shapes are generated from this object, and both are derived — never
 * hand-written:
 *   · paletteVars(p)      → --dshw-* (legacy .dshw-scope surfaces)
 *   · workbenchVars(theme)→ --bg-* / --text-* / --line-* / --accent* / --ok /
 *                           --warn / --err / --cta* / --toast-err* / --code-bg /
 *                           --diff-* (workbench shell)
 * A token that exists only on the workbench shell (its modal well, its code
 * well, its hairline highlight) is named `board*` here so the shell never keeps
 * a private hex literal.
 * ------------------------------------------------------------------------ */

export const PALETTE = {
  light: {
    bg: '#f8f5ef', // --bg-canvas  (paper)
    surface: '#f8f5ef', // --bg-stage   (same paper: no cards, only rules)
    surface2: '#f3efe6', // panels / code wells
    surface3: '#ebe6dc', // sunken wells
    treeBg: '#f1ede4', // --bg-rail (shell)
    elevated: '#fffdf8', // raised chips / active rows / inputs
    hover: 'rgba(23,21,15,.045)', // --bg-hover
    active: 'rgba(23,21,15,.08)', // --bg-active
    modalBg: '#fffdf8', // --bg-modal (same paper as an elevated row)

    border: 'rgba(23,21,15,.14)', // --line
    borderSoft: 'rgba(23,21,15,.07)', // --line-soft
    borderStrong: 'rgba(23,21,15,.26)', // --line-strong
    specular: 'inset 0 1px 0 rgba(255,255,255,.7)', // --specular
    boardSpecular: 'inset 0 1px 0 rgba(255,255,255,.9)', // --specular inside the workbench shell

    text: '#17150f', // --text-1
    text2: '#4d4a42', // --text-2
    text3: '#6b6659', // --text-3  (4.60:1 on surface-3, 4.90:1 on tree-bg — AA for 11–12px)

    brand: '#9a5619', // --accent (copper, darkened for light paper)
    brandStrong: '#7a4314',
    brandSolid: '#17150f', // --cta-bg (ink stamp)
    brandSolidHover: '#2b2820', // --cta-hover
    brandSoft: 'rgba(154,86,25,.10)', // --accent-soft
    brandBorder: 'rgba(154,86,25,.30)', // --accent-line
    onBrand: '#f8f5ef', // --cta-text

    success: '#3f7a4a', // --ok
    successSoft: 'rgba(63,122,74,.10)',
    successBorder: 'rgba(63,122,74,.28)',

    warn: '#8a5a12', // --warn
    warnSoft: 'rgba(138,90,18,.10)',
    warnBorder: 'rgba(138,90,18,.28)',

    danger: '#a83a34', // --err
    dangerSoft: 'rgba(168,58,52,.08)',
    dangerBorder: 'rgba(168,58,52,.26)',

    purple: '#6b4a7a',
    purpleSoft: 'rgba(107,74,122,.09)',
    purpleBorder: 'rgba(107,74,122,.26)',

    folderBlueBg: '#e8edf3',
    folderBlueFg: '#3d5a80',
    folderPurpleBg: '#efe9f4',
    folderPurpleFg: '#6b4a7a',
    folderGreenBg: '#e6efe7',
    folderGreenFg: '#3f7a4a',
    folderOrangeBg: '#f7eedd',
    folderOrangeFg: '#8a5a12',

    shadow: '0 1px 0 rgba(23,21,15,.04)',
    shadowLg: '0 20px 48px rgba(23,21,15,.14), 0 0 0 1px rgba(23,21,15,.10)',
    modalShadow: '0 20px 48px rgba(23,21,15,.14), 0 0 0 1px rgba(23,21,15,.10)',
    brandShadow: '0 1px 0 rgba(23,21,15,.18)',
    focusRing: '0 0 0 3px rgba(154,86,25,.25)',

    overlay: 'rgba(23,21,15,.32)',
    backdrop: 'rgba(23,21,15,.32)',
    boardModalShadow: '0 24px 60px rgba(20,20,19,.16), 0 0 0 1px rgba(20,20,19,.09)',
    toastBg: '#17150f',
    toastFg: '#f8f5ef',
    toastErrorBg: '#fbe9e7',
    toastErrorText: '#7a1f1a',
    toastErrorBorder: '#a8625d',

    codeBg: '#f3efe6',
    boardCodeBg: '#f6f5f0', // --code-bg: the workbench diff / block well
    diffAddBg: 'rgba(63,122,74,.10)',
    diffDelBg: 'rgba(168,58,52,.09)',
    // Legacy board values, kept byte-identical by the token move; the palette
    // pair above is the intended ink and is aligned in a separate commit.
    boardDiffAddBg: 'rgba(16,185,129,.10)',
    boardDiffDelBg: 'rgba(220,38,38,.08)',

    termBg: '#141310',
    termBorder: '#26231d',
    termText: '#e8e6e1',
    termMuted: '#9a958a',
    termBar: '#9a958a',
    termGutter: '#8b877f',
    termUser: '#d8c39a',
    termTool: '#9dc2a2',
    termWarn: '#d9a93f',
    termError: '#e0776f',

    meterFrom: '#9a5619',
    meterTo: '#3f7a4a',

    selectArrow:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b6659\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
  },
  dark: {
    bg: '#0b0b0c', // paper
    surface: '#0b0b0c',
    surface2: '#121214',
    surface3: '#17171a',
    treeBg: '#070708', // shell: rail + terminal
    elevated: '#131315',
    hover: 'rgba(242,240,236,.05)',
    active: 'rgba(242,240,236,.085)',
    modalBg: '#0f0f11', // --bg-modal (a step above elevated, below the gutter)

    border: 'rgba(242,240,236,.11)',
    borderSoft: 'rgba(242,240,236,.06)',
    borderStrong: 'rgba(242,240,236,.20)',
    specular: 'inset 0 1px 0 rgba(242,240,236,.045)',
    boardSpecular: 'inset 0 1px 0 rgba(242,240,236,.045)', // --specular inside the workbench shell

    text: '#f2f0ec',
    text2: '#a9a59d',
    text3: '#8b877f', // 5.00:1 on surface-3, 5.19:1 on elevated — metadata AA

    brand: '#e0a256', // copper
    brandStrong: '#eab877',
    brandSolid: '#f2f0ec',
    brandSolidHover: '#ffffff',
    brandSoft: 'rgba(224,162,86,.12)',
    brandBorder: 'rgba(224,162,86,.30)',
    onBrand: '#0b0b0c',

    success: '#8fbf94',
    successSoft: 'rgba(143,191,148,.12)',
    successBorder: 'rgba(143,191,148,.28)',

    warn: '#d9a93f',
    warnSoft: 'rgba(217,169,63,.12)',
    warnBorder: 'rgba(217,169,63,.28)',

    danger: '#e0776f',
    dangerSoft: 'rgba(224,119,111,.12)',
    dangerBorder: 'rgba(224,119,111,.28)',

    purple: '#bfa8d0',
    purpleSoft: 'rgba(191,168,208,.12)',
    purpleBorder: 'rgba(191,168,208,.28)',

    folderBlueBg: '#1a1e26',
    folderBlueFg: '#9fb3d1',
    folderPurpleBg: '#221c2a',
    folderPurpleFg: '#bfa8d0',
    folderGreenBg: '#182420',
    folderGreenFg: '#9dc2a2',
    folderOrangeBg: '#2a2418',
    folderOrangeFg: '#dfb277',

    shadow: '0 1px 0 rgba(0,0,0,.5)',
    shadowLg: '0 24px 64px rgba(0,0,0,.62), 0 0 0 1px rgba(242,240,236,.09)',
    modalShadow: '0 24px 64px rgba(0,0,0,.62), 0 0 0 1px rgba(242,240,236,.09)',
    brandShadow: '0 1px 0 rgba(0,0,0,.4)',
    focusRing: '0 0 0 3px rgba(224,162,86,.28)',

    overlay: 'rgba(4,4,5,.74)',
    backdrop: 'rgba(4,4,5,.74)',
    boardModalShadow: '0 24px 64px rgba(0,0,0,.62), 0 0 0 1px rgba(242,240,236,.09)',
    toastBg: '#f2f0ec',
    toastFg: '#0b0b0c',
    toastErrorBg: '#2a1413',
    toastErrorText: '#ffd9d5',
    toastErrorBorder: '#a8544e',

    codeBg: '#070708',
    boardCodeBg: '#070708', // --code-bg: the workbench diff / block well
    diffAddBg: 'rgba(143,191,148,.12)',
    diffDelBg: 'rgba(224,119,111,.12)',
    boardDiffAddBg: 'rgba(143,191,148,.12)',
    boardDiffDelBg: 'rgba(224,119,111,.12)',

    termBg: '#070708',
    termBorder: '#1c1c1e',
    termText: '#e8e6e1',
    termMuted: '#8b877f',
    termBar: '#8b877f',
    termGutter: '#8b877f',
    termUser: '#d8c39a',
    termTool: '#9dc2a2',
    termWarn: '#d9a93f',
    termError: '#e0776f',

    meterFrom: '#e0a256',
    meterTo: '#8fbf94',

    selectArrow:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238b877f\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
  },
}

/** Error toast colours, also available as `--dshw-toast-error-*` variables. */
export const TOAST_ERROR = {
  light: {
    bg: PALETTE.light.toastErrorBg,
    text: PALETTE.light.toastErrorText,
    border: PALETTE.light.toastErrorBorder,
  },
  dark: {
    bg: PALETTE.dark.toastErrorBg,
    text: PALETTE.dark.toastErrorText,
    border: PALETTE.dark.toastErrorBorder,
  },
}

export type ThemeName = 'light' | 'dark'

/**
 * Board-shell variables, in stylesheet order. Every value comes from PALETTE
 * (or the toast colours derived from it), so the workbench stylesheet declares
 * no colour of its own.
 */
export function workbenchVarPairs(theme: ThemeName): Array<[string, string]> {
  const p = PALETTE[theme]
  const toast = TOAST_ERROR[theme]
  return [
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
    ['--diff-add-bg', p.boardDiffAddBg],
    ['--diff-del-bg', p.boardDiffDelBg],
  ]
}

/** The same pairs as a declaration list, for `WORKBENCH_CSS`. */
export function workbenchVars(theme: ThemeName): string {
  return workbenchVarPairs(theme)
    .map(([name, value]) => name + ':' + value + ';')
    .join('')
}

export function paletteVars(p: Record<string, string>): string {
  return Object.keys(p)
    .map((key) => {
      const name = key
        .replace(/([A-Z])/g, '-$1')
        .replace(/([a-zA-Z])(\d)/g, '$1-$2')
        .toLowerCase()
      return '--dshw-' + name + ':' + p[key] + ';'
    })
    .join('')
}
