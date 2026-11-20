/* --------------------------------------------------------------------------
 * Palette — the single source of truth for every colour in the workbench.
 *
 * Design language: "Optical Precision".
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
    bg: '#f2f1ec',
    surface: '#fcfbf8',
    surface2: '#f5f3ee',
    surface3: '#ece9e1',
    treeBg: '#f7f6f1',

    border: '#e3ded4',
    borderSoft: '#eae6dd',
    borderStrong: '#d3cec1',

    text: '#141413',
    text2: '#565550',
    text3: '#8a887f',

    brand: '#4f46e5',
    brandStrong: '#4338ca',
    brandSolid: '#141413',
    brandSolidHover: '#2b2b28',
    brandSoft: '#eceafc',
    brandBorder: '#d8d3f7',
    onBrand: '#fcfbf8',

    success: '#067a57',
    successSoft: '#e5f3ec',
    successBorder: '#bfe0d0',

    warn: '#a35a12',
    warnSoft: '#f8efe0',
    warnBorder: '#ecd3ab',

    danger: '#c02626',
    dangerSoft: '#fbe8e7',
    dangerBorder: '#efc3c1',

    purple: '#7c3aed',
    purpleSoft: '#f1e9fd',
    purpleBorder: '#ddcefb',

    folderBlueBg: '#e7ecf8',
    folderBlueFg: '#3b5bdb',
    folderPurpleBg: '#f1e9fd',
    folderPurpleFg: '#7c3aed',
    folderGreenBg: '#e5f2ea',
    folderGreenFg: '#2f855a',
    folderOrangeBg: '#f8efdd',
    folderOrangeFg: '#b7791f',

    shadow: '0 1px 2px rgba(20,20,19,.05),0 1px 3px rgba(20,20,19,.04)',
    shadowLg: '0 24px 60px -20px rgba(20,20,19,.22)',
    brandShadow: '0 1px 2px rgba(20,20,19,.22)',
    focusRing: '0 0 0 3px rgba(79,70,229,.22)',

    overlay: 'rgba(20,20,19,.38)',
    toastBg: '#141413',
    toastFg: '#fcfbf8',

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
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238a887f\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
  },
  dark: {
    bg: '#09090b',
    surface: '#16181d',
    surface2: '#1b1e24',
    surface3: '#23262d',
    treeBg: '#0d0e11',

    border: '#24272e',
    borderSoft: '#1b1e24',
    borderStrong: '#33373f',

    text: '#f4f4f5',
    text2: '#a1a1aa',
    text3: '#6b6b74',

    brand: '#818cf8',
    brandStrong: '#a5b4fc',
    brandSolid: '#f4f4f5',
    brandSolidHover: '#ffffff',
    brandSoft: '#1c1f2e',
    brandBorder: '#2c3350',
    onBrand: '#09090b',

    success: '#34d399',
    successSoft: '#10241c',
    successBorder: '#1f4635',

    warn: '#fbbf24',
    warnSoft: '#2a2012',
    warnBorder: '#49391a',

    danger: '#f87171',
    dangerSoft: '#2a1618',
    dangerBorder: '#532426',

    purple: '#a78bfa',
    purpleSoft: '#1e1a30',
    purpleBorder: '#362d55',

    folderBlueBg: '#1a2138',
    folderBlueFg: '#8fb0ff',
    folderPurpleBg: '#1e1a30',
    folderPurpleFg: '#b9a2ff',
    folderGreenBg: '#12261d',
    folderGreenFg: '#49d793',
    folderOrangeBg: '#2a2012',
    folderOrangeFg: '#f0b354',

    shadow: '0 1px 2px rgba(0,0,0,.5)',
    shadowLg: '0 30px 72px -22px rgba(0,0,0,.85)',
    brandShadow: '0 1px 2px rgba(0,0,0,.4)',
    focusRing: '0 0 0 3px rgba(129,140,248,.30)',

    overlay: 'rgba(4,4,6,.72)',
    toastBg: '#f4f4f5',
    toastFg: '#09090b',

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
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b6b74\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
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
