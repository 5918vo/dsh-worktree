import test from 'node:test'
import assert from 'node:assert/strict'
import {
  entryTag,
  entryTitle,
  liveStatsText,
  modelLabel,
  modelLabelFull,
  shortModelLabel,
  pressurePercent,
  readLive,
  stepStatusLabel,
  tokenSummary,
  toolTag,
} from '../src/client/live-session.js'

const T = {
  liveStats: '{turns} turns / {steps} steps',
  liveStepsOnly: '{steps} steps',
  liveTokensIn: 'in',
  liveTokensOut: 'out',
  duration: 'took {n}',
  durationSec: '{n}s',
  stepDone: 'done',
  stepFailed: 'failed',
  stepRunning: 'running',
  roleThinking: 'think',
  roleUser: 'me',
  roleAssistant: 'assistant',
  toolGeneric: 'tool',
  toolTerminal: 'term',
  toolRead: 'read',
  toolEdit: 'edit',
  toolFind: 'find',
  toolCd: 'cd',
  toolTodos: 'todos',
  toolQuestion: 'ask',
}

test('readLive unwraps JSON-encoded projection values', () => {
  const live = readLive({
    modelSelection: JSON.stringify({ current: { provider: 'p', model: 'm' } }),
    workingDirectory: JSON.stringify('C:/w/task'),
    contextPressure: JSON.stringify({ projectedTokens: 40, contextWindow: 100 }),
    tokenUsage: JSON.stringify({ uncachedInputTokens: 1200, outputTokens: 40, cacheReadTokens: 900 }),
    sessionStats: JSON.stringify({ turns: 3, steps: 7 }),
    todos: JSON.stringify([{ content: 'a', status: 'completed' }, { content: 'b', status: 'pending' }]),
    turnOutline: JSON.stringify([{ prompt: 'hi' }]),
    sessionListMetadata: JSON.stringify({ blank: false }),
  })
  assert.ok(live)
  assert.equal(live.cwd, 'C:/w/task')
  assert.equal(live.pressure.contextWindow, 100)
  assert.equal(live.tokens.outputTokens, 40)
  assert.equal(live.stats.turns, 3)
  assert.equal(live.todos.length, 2)
  assert.equal(live.turns.length, 1)
  assert.equal(live.meta.blank, false)
})

test('readLive accepts plain objects and defaults every missing field', () => {
  const live = readLive({
    modelSelection: { current: { model: 'm' } },
    workingDirectory: { path: 'C:/plain' },
    todos: [{ content: 'x' }],
  })
  assert.ok(live)
  assert.equal(live.cwd, 'C:/plain')
  assert.deepEqual(live.todos, [{ content: 'x' }])
  assert.deepEqual(live.turns, [])
  assert.equal(live.stats, null)
  assert.equal(live.tokens, null)
  assert.equal(readLive(null), null)
  assert.equal(readLive(undefined), null)
})

test('readLive survives malformed JSON and non-array todos', () => {
  const live = readLive({ workingDirectory: 'not json{', todos: '{"a":1}' })
  assert.ok(live)
  assert.equal(live.cwd, '')
  assert.deepEqual(live.todos, [])
})

test('modelLabel shows the short name while modelLabelFull keeps the raw id', () => {
  const pending = { current: { provider: 'a', model: 'b' }, next: { provider: 'c', model: 'd' } }
  assert.equal(modelLabel(pending), 'd')
  assert.equal(modelLabelFull(pending), 'c/d')
  assert.equal(modelLabel({ current: { provider: 'a', model: 'b' } }), 'b')
  assert.equal(modelLabel({ current: 'plain-model' }), 'plain-model')
  assert.equal(modelLabel({ current: { model: 'only' } }), 'only')
  assert.equal(modelLabel({ current: { provider: 'magpie', model: 'mm/auto/deepseek-v4.1-flash' } }), 'deepseek-v4.1-flash')
  assert.equal(modelLabel({ current: {} }), null)
  assert.equal(modelLabel(null), null)
  assert.equal(modelLabel(undefined), null)
  assert.equal(shortModelLabel('a/b/c'), 'c')
  assert.equal(shortModelLabel('solo'), 'solo')
  assert.equal(shortModelLabel('   '), null)
})

test('pressurePercent clamps to 0..100 and reports unknown windows as null', () => {
  assert.equal(pressurePercent({ projectedTokens: 0, contextWindow: 100 }), 0)
  assert.equal(pressurePercent({ projectedTokens: 100, contextWindow: 100 }), 100)
  assert.equal(pressurePercent({ projectedTokens: 400, contextWindow: 100 }), 100)
  assert.equal(pressurePercent({ projectedTokens: -50, contextWindow: 100 }), 0)
  assert.equal(pressurePercent({ projectedTokens: 512, contextWindow: 1000 }), 51)
  assert.equal(pressurePercent({ projectedTokens: 10 }), null)
  assert.equal(pressurePercent({ projectedTokens: 10, contextWindow: 0 }), null)
  assert.equal(pressurePercent(null), null)
})

test('tokenSummary lists only the counters that exist', () => {
  assert.equal(tokenSummary({ uncachedInputTokens: 1530, outputTokens: 12 }, T), '1.5k in · 12 out')
  assert.equal(tokenSummary({ outputTokens: 12 }, T), '12 out')
  assert.equal(tokenSummary({}, T), '')
  assert.equal(tokenSummary(null, T), '')
})

test('liveStatsText uses stats, then the history step count, then a dash', () => {
  assert.equal(liveStatsText({ turns: 2, steps: 5 }, 9, T), '2 turns / 5 steps')
  assert.equal(liveStatsText(null, 9, T), '9 steps')
  assert.equal(liveStatsText(null, 0, T), '—')
})

test('toolTag buckets tool names and keeps unknown ones verbatim', () => {
  assert.equal(toolTag('pwsh', T), 'term')
  assert.equal(toolTag('read', T), 'read')
  assert.equal(toolTag('write', T), 'edit')
  assert.equal(toolTag('grep', T), 'find')
  assert.equal(toolTag('working_directory', T), 'cd')
  assert.equal(toolTag('todo_write', T), 'todos')
  assert.equal(toolTag('ask_user_question', T), 'ask')
  assert.equal(toolTag('custom_tool', T), 'custom_tool')
  assert.equal(toolTag(undefined, T), 'tool')
})

test('entryTag and entryTitle pick the row label and title', () => {
  assert.equal(entryTag({ kind: 'think' }, T), 'think')
  assert.equal(entryTag({ kind: 'user' }, T), 'me')
  assert.equal(entryTag({ kind: 'agent' }, T), 'assistant')
  assert.equal(entryTag({ kind: 'tool', tool: 'read' }, T), 'read')
  assert.equal(entryTitle({ kind: 'agent', title: 'answer' }, T), 'answer')
  assert.equal(entryTitle({ kind: 'agent' }, T), '—')
  assert.equal(entryTitle({ kind: 'think', detail: 'reasoning here', durationMs: 3000 }, T), 'took 3s')
  assert.equal(entryTitle({ kind: 'think', detail: 'reasoning here' }, T), 'reasoning here')
})

test('stepStatusLabel maps completion states', () => {
  assert.equal(stepStatusLabel('error', T), 'failed')
  assert.equal(stepStatusLabel('running', T), 'running')
  assert.equal(stepStatusLabel('ok', T), 'done')
  assert.equal(stepStatusLabel(undefined, T), 'done')
})
