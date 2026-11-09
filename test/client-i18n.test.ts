import test from 'node:test'
import assert from 'node:assert/strict'
import { FALLBACK, pickDict } from '../src/client/i18n'

test('pickDict falls back to zh for unknown/absent locale', () => {
  assert.equal(pickDict(undefined).title, FALLBACK.zh.title)
  assert.equal(pickDict(null).title, FALLBACK.zh.title)
  assert.equal(pickDict('fr').title, FALLBACK.zh.title)
})

test('pickDict reads a plain language string', () => {
  assert.equal(pickDict('en').title, FALLBACK.en.title)
  assert.equal(pickDict('en-US').title, FALLBACK.en.title)
})

test('pickDict understands the host LocaleFace snapshot', () => {
  assert.equal(pickDict({ getSnapshot: () => ({ active: 'en', revision: 2 }) }).title, FALLBACK.en.title)
  assert.equal(pickDict({ getSnapshot: () => ({ active: 'zh', revision: 3 }) }).title, FALLBACK.zh.title)
})

test('pickDict still supports current()/locale/language shapes', () => {
  assert.equal(pickDict({ current: () => 'en' }).title, FALLBACK.en.title)
  assert.equal(pickDict({ locale: 'en' }).title, FALLBACK.en.title)
  assert.equal(pickDict({ language: 'en' }).title, FALLBACK.en.title)
})
