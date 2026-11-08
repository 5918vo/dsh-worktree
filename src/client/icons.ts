/* --------------------------------------------------------------------------
 * Icon set (single inline sprite, no extra dependency)
 * ------------------------------------------------------------------------ */

export const ICONS: Record<string, any[]> = {
  layers: [
    ['path', { d: 'm12 3 9 5-9 5-9-5 9-5Z' }],
    ['path', { d: 'm3 12 9 5 9-5' }],
    ['path', { d: 'm3 16 9 5 9-5' }],
  ],
  folder: [['path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z' }]],
  branch: [
    ['line', { x1: 6, y1: 3, x2: 6, y2: 15 }],
    ['circle', { cx: 18, cy: 6, r: 3 }],
    ['circle', { cx: 6, cy: 18, r: 3 }],
    ['path', { d: 'M18 9a9 9 0 0 1-9 9' }],
  ],
  merge: [
    ['circle', { cx: 18, cy: 18, r: 3 }],
    ['circle', { cx: 6, cy: 6, r: 3 }],
    ['path', { d: 'M6 9a6 6 0 0 0 6 6h3' }],
  ],
  grid: [
    ['rect', { x: 3, y: 3, width: 7, height: 7, rx: 1.6 }],
    ['rect', { x: 14, y: 3, width: 7, height: 7, rx: 1.6 }],
    ['rect', { x: 3, y: 14, width: 7, height: 7, rx: 1.6 }],
    ['rect', { x: 14, y: 14, width: 7, height: 7, rx: 1.6 }],
  ],
  settings: [
    ['circle', { cx: 12, cy: 12, r: 3 }],
    ['path', { d: 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z' }],
  ],
  search: [
    ['circle', { cx: 11, cy: 11, r: 7 }],
    ['path', { d: 'm20 20-3.5-3.5' }],
  ],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  chevronDown: [['path', { d: 'm6 9 6 6 6-6' }]],
  arrowLeft: [
    ['path', { d: 'M19 12H5' }],
    ['path', { d: 'm11 18-6-6 6-6' }],
  ],
  arrowUp: [
    ['path', { d: 'M12 19V5' }],
    ['path', { d: 'm6 11 6-6 6 6' }],
  ],
  external: [
    ['path', { d: 'M14 4h6v6' }],
    ['path', { d: 'M20 4 11 13' }],
    ['path', { d: 'M18 14v5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h5' }],
  ],
  copy: [
    ['rect', { x: 9, y: 9, width: 12, height: 12, rx: 2 }],
    ['path', { d: 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1' }],
  ],
  alert: [
    ['path', { d: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z' }],
    ['line', { x1: 12, y1: 9, x2: 12, y2: 13 }],
    ['line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }],
  ],
  trash: [
    ['path', { d: 'M3 6h18' }],
    ['path', { d: 'M8 6V4h8v2' }],
    ['path', { d: 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' }],
    ['path', { d: 'M10 11v6M14 11v6' }],
  ],
  check: [['path', { d: 'm5 12 4.5 4.5L19 7' }]],
  checkCircle: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'm8.5 12 2.5 2.5 4.5-5' }],
  ],
  x: [['path', { d: 'M6 6l12 12M18 6 6 18' }]],
  xCircle: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'm9 9 6 6M15 9l-6 6' }],
  ],
  clock: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'M12 7v5l3 2' }],
  ],
  terminal: [
    ['rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }],
    ['path', { d: 'm7 9 3 3-3 3' }],
    ['path', { d: 'M13 15h4' }],
  ],
  message: [['path', { d: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l2-3a8.5 8.5 0 1 1 15-5.5Z' }]],
  file: [
    ['path', { d: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z' }],
    ['path', { d: 'M14 3v6h6' }],
    ['path', { d: 'M8 13h8M8 17h5' }],
  ],
  refresh: [
    ['path', { d: 'M3 12a9 9 0 1 0 3-6.7L3 8' }],
    ['path', { d: 'M3 3v5h5' }],
  ],
  more: [
    ['circle', { cx: 5, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 12, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 19, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }],
  ],
  circle: [['circle', { cx: 12, cy: 12, r: 8 }]],
  play: [['path', { d: 'm8 5 11 7-11 7Z' }]],
  info: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'M12 11v5M12 8h.01' }],
  ],
  sliders: [
    ['path', { d: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2' }],
    ['circle', { cx: 16, cy: 6, r: 2 }],
    ['circle', { cx: 10, cy: 12, r: 2 }],
    ['circle', { cx: 16, cy: 18, r: 2 }],
  ],
  database: [
    ['ellipse', { cx: 12, cy: 5, rx: 8, ry: 3 }],
    ['path', { d: 'M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5' }],
    ['path', { d: 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3' }],
  ],
}

