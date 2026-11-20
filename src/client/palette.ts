/* --------------------------------------------------------------------------
 * Palette — the single source of truth for every colour in the workbench.
 *
 * Design language: "Optical Precision" (mirrors demo.html one-to-one).
 *   Dark  — obsidian carbon greys with a 1px specular top highlight; the
 *           primary action is a near-white "ink" button.
 *   Light — warm alabaster paper tones; the primary action is deep ink black.
 *           Colour is reserved for Git state and agent vitals, never chrome.
 *
 * To re-skin the plugin, edit only this object. Every rule below consumes
 * --dshw-* variables generated from these tokens; no colour literals should
 * appear in any other part of the stylesheet.
 * ------------------------------------------------------------------------ */

export const PALETTE = {
  light: {
    bg: '#f2f1ec', // --bg-canvas
    surface: '#fcfbf8', // --bg-stage
    surface2: '#f6f5f0', // panels / code / stat wells (= --bg-rail family)
    surface3: '#ece9e1',
    treeBg: '#f6f5f0', // --bg-rail
    elevated: '#ffffff', // --bg-elevated (raised chips / active rows / buttons)
    hover: 'rgba(20,20,19,.04)', // --bg-hover
    active: 'rgba(20,20,19,.075)', // --bg-active

    border: 'rgba(20,20,19,.085)', // --line
    borderSoft: 'rgba(20,20,19,.055)',
    borderStrong: 'rgba(20,20,19,.18)', // --line-strong
    specular: 'inset 0 1px 0 rgba(255,255,255,.9)', // --specular

    text: '#141413', // --text-1
    text2: '#575652', // --text-2
    text3: '#8c8a82', // --text-3

    brand: '#4f46e5', // --accent
    brandStrong: '#4338ca',
    brandSolid: '#141413', // --cta-bg
    brandSolidHover: '#2a2a28', // --cta-hover
    brandSoft: 'rgba(79,70,229,.09)', // --accent-soft
    brandBorder: 'rgba(79,70,229,.24)', // --accent-line
    onBrand: '#fcfbf8', // --cta-text

    success: '#059669', // --ok
    successSoft: 'rgba(5,150,105,.09)',
    successBorder: 'rgba(5,150,105,.24)',

    warn: '#b45309', // --warn
    warnSoft: 'rgba(180,83,9,.09)',
    warnBorder: 'rgba(180,83,9,.24)',

    danger: '#dc2626', // --err
    dangerSoft: 'rgba(220,38,38,.08)',
    dangerBorder: 'rgba(220,38,38,.22)',

    purple: '#7c3aed',
    purpleSoft: 'rgba(124,58,237,.09)',
    purpleBorder: 'rgba(124,58,237,.24)',

    folderBlueBg: '#e7ecf8',
    folderBlueFg: '#3b5bdb',
    folderPurpleBg: '#f1e9fd',
    folderPurpleFg: '#7c3aed',
    folderGreenBg: '#e5f2ea',
    folderGreenFg: '#2f855a',
    folderOrangeBg: '#f8efdd',
    folderOrangeFg: '#b7791f',

    shadow: '0 1px 2px rgba(20,20,19,.05),0 1px 3px rgba(20,20,19,.04)',
    shadowLg: '0 24px 60px rgba(20,20,19,.16), 0 0 0 1px rgba(20,20,19,.09)',
    modalShadow: '0 24px 60px rgba(20,20,19,.16), 0 0 0 1px rgba(20,20,19,.09)',
    brandShadow: '0 1px 2px rgba(20,20,19,.22)',
    focusRing: '0 0 0 3px rgba(79,70,229,.22)',

    overlay: 'rgba(20,20,19,.36)',
    backdrop: 'rgba(20,20,19,.36)',
    toastBg: '#141413',
    toastFg: '#fcfbf8',

    codeBg: '#f6f5f0',
    diffAddBg: 'rgba(16,185,129,.10)',
    diffDelBg: 'rgba(220,38,38,.08)',

    termBg: '#1a1a15',
    termBorder: '#2c2b24',
    termText: '#e7e4d9',
    termMuted: '#9a968a',
    termBar: '#9a968a',
    termGutter: '#6f6b60',
    termUser: '#a5b4fc',
    termTool: '#6ee7b7',
    termWarn: '#fcd34d',
    termError: '#fca5a5',

    meterFrom: '#6366f1',
    meterTo: '#34d399',

    selectArrow:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238c8a82\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
  },
  dark: {
    bg: '#09090b',
    surface: '#101114',
    surface2: '#16181d',
    surface3: '#1f222a',
    treeBg: '#0d0e11',
    elevated: '#16181d',
    hover: 'rgba(255,255,255,.045)',
    active: 'rgba(255,255,255,.075)',

    border: 'rgba(255,255,255,.08)',
    borderSoft: 'rgba(255,255,255,.05)',
    borderStrong: 'rgba(255,255,255,.16)',
    specular: 'inset 0 1px 0 rgba(255,255,255,.07)',

    text: '#f4f4f5',
    text2: '#a1a1aa',
    text3: '#63636e',

    brand: '#818cf8',
    brandStrong: '#a5b4fc',
    brandSolid: '#f4f4f5',
    brandSolidHover: '#ffffff',
    brandSoft: 'rgba(129,140,248,.12)',
    brandBorder: 'rgba(129,140,248,.28)',
    onBrand: '#09090b',

    success: '#34d399',
    successSoft: 'rgba(52,211,153,.11)',
    successBorder: 'rgba(52,211,153,.25)',

    warn: '#fbbf24',
    warnSoft: 'rgba(251,191,36,.11)',
    warnBorder: 'rgba(251,191,36,.26)',

    danger: '#f87171',
    dangerSoft: 'rgba(248,113,113,.11)',
    dangerBorder: 'rgba(248,113,113,.26)',

    purple: '#a78bfa',
    purpleSoft: 'rgba(167,139,250,.13)',
    purpleBorder: 'rgba(167,139,250,.28)',

    folderBlueBg: '#1a2138',
    folderBlueFg: '#8fb0ff',
    folderPurpleBg: '#1e1a30',
    folderPurpleFg: '#b9a2ff',
    folderGreenBg: '#12261d',
    folderGreenFg: '#49d793',
    folderOrangeBg: '#2a2012',
    folderOrangeFg: '#f0b354',

    shadow: '0 1px 2px rgba(0,0,0,.5)',
    shadowLg: '0 24px 64px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08)',
    modalShadow: '0 24px 64px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08)',
    brandShadow: '0 1px 2px rgba(0,0,0,.4)',
    focusRing: '0 0 0 3px rgba(129,140,248,.30)',

    overlay: 'rgba(4,4,6,.72)',
    backdrop: 'rgba(4,4,6,.72)',
    toastBg: '#f4f4f5',
    toastFg: '#09090b',

    codeBg: '#0b0c0f',
    diffAddBg: 'rgba(16,185,129,.11)',
    diffDelBg: 'rgba(244,63,94,.12)',

    termBg: '#0b0c0f',
    termBorder: '#1f222a',
    termText: '#d4d4d8',
    termMuted: '#8b8b93',
    termBar: '#8b8b93',
    termGutter: '#6b6b74',
    termUser: '#a5b4fc',
    termTool: '#6ee7b7',
    termWarn: '#fcd34d',
    termError: '#fca5a5',

    meterFrom: '#818cf8',
    meterTo: '#34d399',

    selectArrow:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2363636e\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
  },
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
