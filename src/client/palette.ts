/* --------------------------------------------------------------------------
 * Palette — the single source of truth for every colour in the workbench.
 *
 * To re-skin the plugin, edit only this object. Every rule below consumes
 * --dshw-* variables generated from these tokens; no colour literals should
 * appear in any other part of the stylesheet.
 * ------------------------------------------------------------------------ */

export const PALETTE = {
  light: {
    bg: '#f4f6fa',
    surface: '#ffffff',
    surface2: '#f7f9fc',
    surface3: '#edf1f7',
    treeBg: '#fbfcfe',

    border: '#e4e8f0',
    borderSoft: '#eef1f6',
    borderStrong: '#d3d9e5',

    text: '#171b26',
    text2: '#5b6478',
    text3: '#5f687b',

    brand: '#2563eb',
    brandStrong: '#1d4ed8',
    brandSolid: '#2563eb',
    brandSolidHover: '#1d4ed8',
    brandSoft: '#eaf0ff',
    brandBorder: '#c9d8ff',
    onBrand: '#ffffff',

    success: '#146c33',
    successSoft: '#e8f7ee',
    successBorder: '#bfe8cf',

    warn: '#b45309',
    warnSoft: '#fff4e2',
    warnBorder: '#f4dcb4',

    danger: '#b91c1c',
    dangerSoft: '#fdecec',
    dangerBorder: '#f3c3c3',

    purple: '#6d4aff',
    purpleSoft: '#f1ecff',
    purpleBorder: '#dcd3ff',

    folderBlueBg: '#e9f0ff',
    folderBlueFg: '#2f6bff',
    folderPurpleBg: '#f1ecff',
    folderPurpleFg: '#6d4aff',
    folderGreenBg: '#e7f7ee',
    folderGreenFg: '#16a34a',
    folderOrangeBg: '#fff2e0',
    folderOrangeFg: '#d97706',

    shadow: '0 1px 2px rgba(16,24,40,.045),0 1px 3px rgba(16,24,40,.04)',
    shadowLg: '0 26px 64px -18px rgba(15,23,42,.34)',
    brandShadow: '0 1px 2px rgba(47,107,255,.32)',
    focusRing: '0 0 0 3px rgba(37,99,235,.22)',

    overlay: 'rgba(13,20,35,.56)',
    toastBg: '#1b2230',
    toastFg: '#f8fafc',

    termBg: '#101722',
    termBorder: '#1e2939',
    termText: '#c6d0de',
    termMuted: '#8fa0b8',
    termBar: '#8fa0b8',
    termGutter: '#6b7a92',
    termUser: '#8fb4ff',
    termTool: '#79d3a5',
    termWarn: '#f3c268',
    termError: '#ff8a8a',

    meterFrom: '#3f7dff',
    meterTo: '#79d3a5',

    selectArrow:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238b93a6\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
  },
  dark: {
    bg: '#0b0e14',
    surface: '#12161f',
    surface2: '#181d28',
    surface3: '#212734',
    treeBg: '#0f131b',

    border: '#232a38',
    borderSoft: '#1c2230',
    borderStrong: '#303849',

    text: '#edf1f7',
    text2: '#a6aebe',
    text3: '#8c96a8',

    brand: '#5c8dff',
    brandStrong: '#7aa4ff',
    brandSolid: '#2a63f0',
    brandSolidHover: '#2559dd',
    brandSoft: '#17264a',
    brandBorder: '#2a4272',
    onBrand: '#ffffff',

    success: '#3ddc97',
    successSoft: '#102b22',
    successBorder: '#1e4a39',

    warn: '#f0b354',
    warnSoft: '#2b2112',
    warnBorder: '#4a391b',

    danger: '#ff7b7b',
    dangerSoft: '#2e1519',
    dangerBorder: '#5a252b',

    purple: '#a78bfa',
    purpleSoft: '#241d3d',
    purpleBorder: '#3b3260',

    folderBlueBg: '#17264a',
    folderBlueFg: '#7ea6ff',
    folderPurpleBg: '#241d3d',
    folderPurpleFg: '#b09aff',
    folderGreenBg: '#12271d',
    folderGreenFg: '#49d793',
    folderOrangeBg: '#2c2114',
    folderOrangeFg: '#f0b354',

    shadow: '0 1px 2px rgba(0,0,0,.35)',
    shadowLg: '0 30px 72px -22px rgba(0,0,0,.8)',
    brandShadow: '0 1px 2px rgba(92,141,255,.35)',
    focusRing: '0 0 0 3px rgba(92,141,255,.28)',

    overlay: 'rgba(0,0,0,.62)',
    toastBg: '#eef2f9',
    toastFg: '#11151c',

    termBg: '#070a10',
    termBorder: '#1b2331',
    termText: '#cfd8e6',
    termMuted: '#8b9ab0',
    termBar: '#8b9ab0',
    termGutter: '#6b7a92',
    termUser: '#8fb4ff',
    termTool: '#79d3a5',
    termWarn: '#f3c268',
    termError: '#ff8a8a',

    meterFrom: '#3f7dff',
    meterTo: '#79d3a5',

    selectArrow:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23788294\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
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
