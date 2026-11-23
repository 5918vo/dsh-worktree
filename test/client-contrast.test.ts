import test from 'node:test'
import assert from 'node:assert/strict'
import { PALETTE, TOAST_ERROR } from '../src/client/palette.js'
import { composite, contrastOf, meetsAA, meetsNonTextAA, parseColor } from '../src/client/contrast.js'

// Real palette values, not synthetic gray pairs: these assertions are the
// regression net for "metadata ink stays readable on every raised surface".
const AA = 4.5
const NON_TEXT = 3

test('light text-3 clears AA on every workbench surface', () => {
  const p = PALETTE.light
  const surfaces: Array<[string, string]> = [
    ['bg', p.bg],
    ['surface2', p.surface2],
    ['surface3', p.surface3],
    ['treeBg (rail)', p.treeBg],
    ['elevated', p.elevated],
  ]
  for (const [name, bg] of surfaces) {
    assert.ok(meetsAA(p.text3, bg), `light text3 on ${name} ${bg} = ${contrastOf(p.text3, bg)} < ${AA}`)
  }
})

test('dark text-3 clears AA on every workbench surface', () => {
  const p = PALETTE.dark
  const surfaces: Array<[string, string]> = [
    ['bg', p.bg],
    ['surface2', p.surface2],
    ['surface3', p.surface3],
    ['treeBg (rail)', p.treeBg],
    ['elevated', p.elevated],
  ]
  for (const [name, bg] of surfaces) {
    assert.ok(meetsAA(p.text3, bg), `dark text3 on ${name} ${bg} = ${contrastOf(p.text3, bg)} < ${AA}`)
  }
})

test('terminal gutters and metadata stay AA in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const p = PALETTE[theme]
    assert.ok(meetsAA(p.termGutter, p.termBg), `${theme} termGutter = ${contrastOf(p.termGutter, p.termBg)}`)
    assert.ok(meetsAA(p.termMuted, p.termBg), `${theme} termMuted = ${contrastOf(p.termMuted, p.termBg)}`)
  }
})

test('error toast text is AA and its border is non-text visible in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const toast = TOAST_ERROR[theme]
    assert.ok(meetsAA(toast.text, toast.bg), `${theme} toast text = ${contrastOf(toast.text, toast.bg)}`)
    assert.ok(meetsNonTextAA(toast.border, toast.bg), `${theme} toast border = ${contrastOf(toast.border, toast.bg)}`)
    // The old bug paired near-white text with a light error fill.
    assert.ok(contrastOf('#ffffff', toast.bg) < AA || contrastOf(toast.text, toast.bg) > AA)
  }
  assert.deepEqual(TOAST_ERROR.light, {
    bg: PALETTE.light.toastErrorBg,
    text: PALETTE.light.toastErrorText,
    border: PALETTE.light.toastErrorBorder,
  })
  assert.deepEqual(TOAST_ERROR.dark, {
    bg: PALETTE.dark.toastErrorBg,
    text: PALETTE.dark.toastErrorText,
    border: PALETTE.dark.toastErrorBorder,
  })
})

test('parseColor understands the formats the palette uses', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 })
  assert.deepEqual(parseColor('#17150f'), { r: 23, g: 21, b: 15, a: 1 })
  assert.deepEqual(parseColor('#00000080'), { r: 0, g: 0, b: 0, a: 128 / 255 })
  assert.deepEqual(parseColor('rgba(23,21,15,.32)'), { r: 23, g: 21, b: 15, a: 0.32 })
  assert.equal(parseColor('transparent')!.a, 0)
  assert.equal(parseColor('not-a-colour'), null)
})

test('alpha is composited before measuring', () => {
  const half = composite({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 })
  assert.equal(half.r, 128)
  assert.equal(contrastOf('rgba(255,255,255,.5)', '#000000'), contrastOf('#808080', '#000000'))
  // Unknown colours degrade to a neutral ratio instead of throwing.
  assert.equal(contrastOf('nope', '#fff'), 1)
})

test('meetsAA distinguishes body text from large text thresholds', () => {
  assert.equal(meetsAA('#777777', '#ffffff'), false)
  assert.equal(meetsAA('#767676', '#ffffff'), true)
  assert.equal(meetsAA('#949494', '#ffffff', true), true)
})
