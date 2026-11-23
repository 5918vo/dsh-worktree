import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SAVED_VIEW_LIMIT,
  SAVED_VIEW_NAME_MAX,
  createSavedView,
  isViewState,
  normalizeViewName,
  parseSavedViews,
  removeSavedView,
  sameViewState,
  sanitizeSavedViews,
  serializeSavedViews,
  upsertSavedView,
  type SavedView,
} from '../src/client/saved-views.js'

function state(over: Record<string, any> = {}) {
  return { query: '', filter: 'all' as const, tag: '', showArchived: false, ...over }
}

function view(over: Record<string, any> = {}): SavedView {
  return { id: 'v1', name: 'View', createdAt: 1, ...state(), ...over }
}

test('normalizeViewName trims and rejects empty or over-long names', () => {
  assert.equal(normalizeViewName('  逾期 + 前端  '), '逾期 + 前端')
  assert.equal(normalizeViewName('x'.repeat(SAVED_VIEW_NAME_MAX)), 'x'.repeat(SAVED_VIEW_NAME_MAX))
  assert.equal(normalizeViewName('   '), null)
  assert.equal(normalizeViewName(''), null)
  assert.equal(normalizeViewName(null), null)
  assert.equal(normalizeViewName(undefined), null)
  assert.equal(normalizeViewName('x'.repeat(SAVED_VIEW_NAME_MAX + 1)), null)
  // Length is counted in characters, not UTF-16 units.
  assert.equal(normalizeViewName('字'.repeat(SAVED_VIEW_NAME_MAX)), '字'.repeat(SAVED_VIEW_NAME_MAX))
})

test('isViewState accepts only the four typed filter fields', () => {
  assert.equal(isViewState(state()), true)
  assert.equal(isViewState(state({ filter: 'review' })), true)
  assert.equal(isViewState(state({ filter: 'merged' })), false)
  assert.equal(isViewState(state({ showArchived: 'yes' })), false)
  assert.equal(isViewState(state({ query: 1 })), false)
  assert.equal(isViewState(state({ tag: null })), false)
  assert.equal(isViewState(null), false)
  assert.equal(isViewState('all'), false)
  assert.equal(isViewState([]), false)
})

test('createSavedView validates the name and state, then normalizes', () => {
  const created = createSavedView(state({ query: '  login  ', tag: 'api', filter: 'review' }), '  My view  ', { now: 42, id: 'fixed' })
  assert.equal(created.ok, true)
  if (!created.ok) return
  assert.deepEqual(created.view, {
    id: 'fixed',
    name: 'My view',
    createdAt: 42,
    query: '  login  ',
    filter: 'review',
    tag: 'api',
    showArchived: false,
  })

  // Long query/tag are clamped, not rejected.
  const clamped = createSavedView(state({ query: 'q'.repeat(200), tag: 't'.repeat(24) }), 'Clamped')
  assert.equal(clamped.ok, true)
  if (clamped.ok) {
    assert.equal(clamped.view.query.length, 200)
    assert.equal(clamped.view.tag.length, 24)
  }

  assert.deepEqual(createSavedView(state(), '   '), { ok: false, reason: 'name-empty' })
  assert.deepEqual(createSavedView(state(), 'x'.repeat(SAVED_VIEW_NAME_MAX + 1)), { ok: false, reason: 'name-too-long' })
  assert.deepEqual(createSavedView(state({ filter: 'merged' }) as any, 'ok'), { ok: false, reason: 'state-invalid' })

  // A generated id is unique enough and still a non-empty string.
  const first = createSavedView(state(), 'one')
  const second = createSavedView(state(), 'two')
  assert.equal(first.ok && second.ok && first.view.id !== second.view.id, true)
})

test('sanitizeSavedViews drops bad entries, dedupes ids, sorts and caps', () => {
  const raw = [
    view({ id: 'b', name: 'B', createdAt: 20 }),
    view({ id: 'a', name: 'A', createdAt: 10 }),
    view({ id: 'a', name: 'A duplicate', createdAt: 30 }),
    view({ id: '', name: 'No id' }),
    view({ id: 'c', name: '   ' }),
    view({ id: 'd', name: 'x'.repeat(SAVED_VIEW_NAME_MAX + 1) }),
    view({ id: 'e', name: 'Bad filter', filter: 'merged' }),
    view({ id: 'f', name: 'Bad bool', showArchived: 1 }),
    null,
    'nope',
    view({ id: 'g', name: 'Bad createdAt', createdAt: 'soon' }),
    view({ id: 'h', name: 'Clamp me', query: 'q'.repeat(400), tag: 't'.repeat(60) }),
  ]
  const clean = sanitizeSavedViews(raw)
  assert.deepEqual(clean.map((item) => item.id), ['g', 'h', 'a', 'b'])
  assert.equal(clean[0].createdAt, 0)
  assert.equal(clean[2].name, 'A')
  assert.equal(clean[1].query.length, 200)
  assert.equal(clean[1].tag.length, 24)

  assert.deepEqual(sanitizeSavedViews('not an array'), [])
  assert.deepEqual(sanitizeSavedViews(null), [])

  const many = Array.from({ length: SAVED_VIEW_LIMIT + 5 }, (_, index) => view({ id: 'id' + index, name: 'n' + index, createdAt: index }))
  const capped = sanitizeSavedViews(many)
  assert.equal(capped.length, SAVED_VIEW_LIMIT)
  assert.equal(capped[0].id, 'id0')
  assert.equal(capped[capped.length - 1].id, 'id' + (SAVED_VIEW_LIMIT - 1))
})

test('parse and serialize round-trip, and broken JSON reads as no views', () => {
  const views = [view({ id: 'a', name: 'A', createdAt: 1 }), view({ id: 'b', name: 'B', createdAt: 2, filter: 'overdue' as any })]
  assert.deepEqual(parseSavedViews(serializeSavedViews(views)), views)
  assert.deepEqual(parseSavedViews(''), [])
  assert.deepEqual(parseSavedViews(null), [])
  assert.deepEqual(parseSavedViews('{not json'), [])
  assert.deepEqual(parseSavedViews('{"a":1}'), [])
  assert.deepEqual(parseSavedViews('[1,2,3]'), [])
  // Serializing never writes an entry that would be dropped on read.
  assert.equal(JSON.parse(serializeSavedViews([view({ id: '' })])).length, 0)
})

test('sameViewState compares trimmed query and the other three fields exactly', () => {
  const saved = view({ query: 'login', filter: 'review', tag: 'api', showArchived: true })
  assert.equal(sameViewState(saved, state({ query: ' login ', filter: 'review', tag: 'api', showArchived: true })), true)
  assert.equal(sameViewState(saved, state({ query: 'login', filter: 'review', tag: 'api', showArchived: false })), false)
  assert.equal(sameViewState(saved, state({ query: 'login', filter: 'all', tag: 'api', showArchived: true })), false)
  assert.equal(sameViewState(saved, state({ query: 'login', filter: 'review', tag: 'web', showArchived: true })), false)
  assert.equal(sameViewState(saved, state({ query: 'other', filter: 'review', tag: 'api', showArchived: true })), false)
})

test('upsertSavedView adds, replaces by id, and updates a matching name in place', () => {
  const list = [view({ id: 'a', name: 'Alpha', createdAt: 1 }), view({ id: 'b', name: 'Beta', createdAt: 2 })]

  const added = upsertSavedView(list, view({ id: 'c', name: 'Gamma', createdAt: 3 }))
  assert.deepEqual(added.map((item) => item.id), ['a', 'b', 'c'])

  const byId = upsertSavedView(list, view({ id: 'a', name: 'Alpha renamed', createdAt: 9, query: 'x' }))
  assert.deepEqual(byId.map((item) => item.id), ['a', 'b'])
  assert.equal(byId[0].name, 'Alpha renamed')
  assert.equal(byId[0].createdAt, 9)
  assert.equal(byId[0].query, 'x')

  // Same name ignoring case and surrounding whitespace: keep id and createdAt.
  const byName = upsertSavedView(list, view({ id: 'fresh', name: '  alpha  ', createdAt: 99, filter: 'overdue' as any }))
  assert.deepEqual(byName.map((item) => item.id), ['a', 'b'])
  assert.equal(byName[0].name, 'alpha')
  assert.equal(byName[0].createdAt, 1)
  assert.equal(byName[0].filter, 'overdue')

  const capped = upsertSavedView(
    Array.from({ length: SAVED_VIEW_LIMIT }, (_, index) => view({ id: 'id' + index, name: 'n' + index, createdAt: index })),
    view({ id: 'new', name: 'New', createdAt: 1000 }),
  )
  assert.equal(capped.length, SAVED_VIEW_LIMIT)
})

test('removeSavedView drops only the matching id', () => {
  const list = [view({ id: 'a' }), view({ id: 'b' })]
  assert.deepEqual(removeSavedView(list, 'a').map((item) => item.id), ['b'])
  assert.deepEqual(removeSavedView(list, 'missing').map((item) => item.id), ['a', 'b'])
  assert.deepEqual(removeSavedView([], 'a'), [])
})
