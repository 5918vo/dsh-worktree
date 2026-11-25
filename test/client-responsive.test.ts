/**
 * Responsive and accessibility contract of the workbench stylesheet.
 *
 * These assertions are about the CSS text, not about pixels: they catch the
 * regressions that a pure-function test cannot see — a breakpoint dropped, the
 * scrim left hidden at phone width, or the motion/touch preferences quietly
 * losing their overrides. Real layout still needs a browser; the pending visual
 * checklist lives in docs/frontend-design.md.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { WORKBENCH_CSS } from '../src/client/styles/workbench.js'

/** Body of one `@container dshwboard (max-width: N)` block, by brace depth. */
function containerBlock(px: number): string {
  const head = `@container dshwboard (max-width: ${px}px) {`
  const at = WORKBENCH_CSS.indexOf(head)
  assert.ok(at >= 0, `missing container query ${px}px`)
  let depth = 0
  for (let i = at + head.length - 1; i < WORKBENCH_CSS.length; i++) {
    const ch = WORKBENCH_CSS[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return WORKBENCH_CSS.slice(at + head.length, i)
    }
  }
  throw new Error('unbalanced container block ' + px)
}

function mediaBlock(query: string): string {
  const head = `@media (${query}) {`
  const at = WORKBENCH_CSS.indexOf(head)
  assert.ok(at >= 0, `missing media query ${query}`)
  let depth = 0
  for (let i = at + head.length - 1; i < WORKBENCH_CSS.length; i++) {
    const ch = WORKBENCH_CSS[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return WORKBENCH_CSS.slice(at + head.length, i)
    }
  }
  throw new Error('unbalanced media block ' + query)
}

test('the three-column layout keeps its breakpoints', () => {
  for (const px of [980, 720, 480]) assert.ok(containerBlock(px).length > 0)
  // >980 is the three-column default; 980 narrows the rail and overlays the inspector.
  const wide = containerBlock(980)
  assert.match(wide, /grid-template-columns: 248px/)
  assert.match(wide, /\.dshwd-inspector \{ display: none; \}/)
  assert.match(wide, /\.dshwd-inspector \{ display: flex; position: absolute; right: 0; top: 46px;/)
})

test('at phone width both columns are exclusive overlay sheets', () => {
  const narrow = containerBlock(720)
  assert.match(narrow, /grid-template-columns: minmax\(0,1fr\)/)
  assert.match(narrow, /\.dshwd-rail \{ display: none; \}/)
  assert.match(narrow, /\.dshwd-rail \{ display: flex; position: absolute; left: 0; top: 0; bottom: 0; width: min\(300px, 88%\)/)
  assert.match(narrow, /\.dshwd-inspector \{ display: flex; position: absolute; left: 0; right: 0; top: 0; bottom: 0; width: 100%/)
  // The scrim is the shared backdrop behind whichever sheet is open.
  assert.match(narrow, /\.dshwd-scrim \{ display: block; position: absolute; inset: 0; z-index: 35;/)
  assert.ok(WORKBENCH_CSS.indexOf('.dshwd-scrim { display: none; }') < WORKBENCH_CSS.indexOf('@container dshwboard (max-width: 720px)'))
})

test('the stage keeps its content instead of becoming a card list', () => {
  const narrow = containerBlock(720)
  // Stage rules survive the single column: prose, tabs and kv rows reflow.
  assert.match(narrow, /\.dshwd-kv \{ flex-wrap: wrap;/)
  assert.match(narrow, /\.dshwd-tabs \{ overflow-x: auto; \}/)
  assert.doesNotMatch(narrow, /\.dshwd-measure \{ display: none/)
})

test('480px keeps the topbar to glyphs and the title readable', () => {
  const tiny = containerBlock(480)
  assert.match(tiny, /\.dshwd-topbar \.dshwd-btn-label \{ display: none; \}/)
  assert.match(tiny, /\.dshwd-stage-title \{ font-size: 16px; \}/)
})

test('reduced motion removes the pulse and the transitions, not the state', () => {
  const reduced = mediaBlock('prefers-reduced-motion: reduce')
  assert.match(reduced, /\.dshwd-dot\.dshwd-developing \{ animation: none; \}/)
  assert.match(reduced, /transition-duration: \.001ms/)
  // State is still conveyed: the dot keeps its colour, only the animation stops.
  assert.doesNotMatch(reduced, /opacity: 0/)
})

test('coarse pointers keep row actions discoverable and targets tappable', () => {
  const coarse = mediaBlock('pointer: coarse')
  assert.match(coarse, /\.dshwd-item-actions \{ opacity: 1; \}/)
  assert.match(coarse, /min-width: 24px; min-height: 24px/)
  assert.match(coarse, /\.dshwd-btn-mini \{ min-height: 24px; \}/)
})

test('new acceptance segments honour both preferences', () => {
  // The segment bar is flat colour, so it must never animate under reduced
  // motion; the chip row must keep wrapping at every width.
  assert.doesNotMatch(WORKBENCH_CSS, /dshwd-check-segment[^}]*animation:/)
  assert.match(WORKBENCH_CSS, /\.dshwd-item-chips \{ display: flex; flex-wrap: wrap;/)
  assert.match(WORKBENCH_CSS, /\.dshwd-check-segment \{ flex: 1 1 0; height: 3px;/)
})
