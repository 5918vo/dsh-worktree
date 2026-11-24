import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stageGridClass } from '../src/client/detail-layout.js'

/**
 * The project overview and the task stage share one board inspector toggle.
 * These tests pin the two halves of that contract: the class the project detail
 * renders, and the stylesheet rule that turns it into a real close (no empty
 * column, no panel left behind).
 */

test('stageGridClass adds the hidden flag only when the inspector is closed', () => {
  assert.equal(stageGridClass(false), 'dshw-detail-inner dshw-stage-grid')
  assert.equal(stageGridClass(true), 'dshw-detail-inner dshw-stage-grid dshw-inspector-hidden')
})

test('the project detail stylesheet collapses the column and hides the panel', () => {
  const css = readFileSync(new URL('../src/client/styles/workbench.ts', import.meta.url), 'utf8')
  const management = '.dshw-board .dshwd-management .dshw-detail-inner.dshw-stage-grid'
  // Same specificity family as the grid rules the board already ships; the
  // legacy `.dshw-inspector-hidden` rule only matches an ancestor, so the
  // project pane needs its own selectors.
  assert.ok(css.includes(`${management}.dshw-inspector-hidden { grid-template-columns: minmax(0, 1fr); }`))
  assert.ok(css.includes(`${management}.dshw-inspector-hidden .dshw-inspector { display: none; }`))
})

test('the project inspector never becomes an overlay', () => {
  const css = readFileSync(new URL('../src/client/styles/workbench.ts', import.meta.url), 'utf8')
  // A positioned panel over the stage is what makes report buttons unclickable;
  // the project pane stays in flow (column when wide, stacked block when
  // narrow) and is closed by the toggle instead.
  assert.ok(css.includes('.dshw-board .dshwd-management .dshw-inspector { position: static;'))
  const projectRules = css.split('\n').filter((line) => line.includes('.dshw-management') && line.includes('.dshw-inspector'))
  for (const rule of projectRules) {
    assert.equal(/position:\s*(absolute|sticky|fixed)/.test(rule), false, rule)
  }
})

test('the project stage sizes to its content so the stacked inspector starts below it', () => {
  const css = readFileSync(new URL('../src/client/styles/workbench.ts', import.meta.url), 'utf8')
  // `min-height: 100%` made the stage row claim the pane height while its body
  // kept overflowing, which put the inspector on top of the report card.
  assert.ok(css.includes('.dshw-board .dshwd-management .dshw-detail-inner.dshw-stage-grid .dshw-stage { min-height: auto; }'))
})
