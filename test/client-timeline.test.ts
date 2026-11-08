import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHistoryEntries, fallbackEntries } from '../src/client/timeline.js'

const T = {
  resultRead: '{lines} lines / {chars} chars',
  resultMatch: '{n} matches',
  resultWrite: 'written',
  todoUpdate: 'todos updated',
  contentSize: '{n} bytes',
}

function rec(type: string, time: number, data: any) {
  return { event: { type, time, data } }
}

const records = [
  rec('user/message', 1000, { source: { kind: 'user' }, content: [{ type: 'text', text: 'hello world' }] }),
  rec('user/message', 1001, { source: { kind: 'runtime' }, content: [{ type: 'text', text: 'IGNORED runtime context' }] }),
  rec('assistant/message', 1002, {
    message: { source: { provider: 'p', model: 'm' }, content: [{ type: 'reasoning', text: 'thinking' }, { type: 'text', text: 'the answer' }] },
  }),
  rec('tool/call', 1003, { name: 'read', arguments: '{"file_path":"C:/w/a.ts"}', callId: 'c1' }),
  rec('tool/result', 1005, { message: { source: { callId: 'c1' }, content: [{ type: 'text', text: 'l1\nl2' }] } }),
]

test('buildHistoryEntries renders user, think, agent and tool rows in order', () => {
  const entries = buildHistoryEntries(records, 50, T, 'C:/w')
  assert.deepEqual(entries.map((e) => e.kind), ['user', 'think', 'agent', 'tool'])
  assert.equal(entries[0].detail, 'hello world')
  // the non-user runtime context message is filtered out
  assert.ok(!entries.some((e) => e.detail.includes('IGNORED')))
  assert.equal(entries[3].tool, 'read')
  assert.equal(entries[3].status, 'ok')
  assert.equal(entries[3].durationMs, 2)
})

test('timeline ids are stable when new events are appended', () => {
  const before = buildHistoryEntries(records.slice(0, 4), 50, T, 'C:/w').map((e) => e.id)
  const after = buildHistoryEntries(records, 50, T, 'C:/w').map((e) => e.id)
  assert.deepEqual(after.slice(0, before.length), before)
})

test('step/start + step/end give the reasoning row a duration', () => {
  const withSteps = [
    rec('step/start', 10, { turn: 0, step: 0 }),
    rec('assistant/message', 15, { turn: 0, step: 0, message: { content: [{ type: 'reasoning', text: 'ponder' }, { type: 'text', text: 'done' }] } }),
    rec('step/end', 30, { turn: 0, step: 0 }),
  ]
  const entries = buildHistoryEntries(withSteps, 50, T)
  const think = entries.find((e) => e.kind === 'think')!
  assert.equal(think.durationMs, 20)
})

test('limit keeps only the newest rows', () => {
  const entries = buildHistoryEntries(records, 2, T, 'C:/w')
  assert.equal(entries.length, 2)
  assert.equal(entries[entries.length - 1].kind, 'tool')
})

test('fallbackEntries maps prompts and responses', () => {
  const entries = fallbackEntries([{ prompt: 'do it', response: 'done' }])
  assert.deepEqual(entries.map((e) => e.kind), ['user', 'agent'])
})
