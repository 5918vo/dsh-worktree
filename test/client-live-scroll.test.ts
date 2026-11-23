import test from 'node:test'
import assert from 'node:assert/strict'
import { LIVE_FOLLOW_THRESHOLD, nearBottom, shouldFollowLive } from '../src/client/live-session.js'

test('a log pinned to the bottom counts as following', () => {
  assert.equal(nearBottom({ scrollTop: 900, scrollHeight: 1000, clientHeight: 100 }), true)
})

test('reading upward stops the follow once past the threshold', () => {
  const base = { scrollHeight: 1000, clientHeight: 100 }
  assert.equal(nearBottom({ ...base, scrollTop: 900 - LIVE_FOLLOW_THRESHOLD }), true, 'threshold is inclusive')
  assert.equal(nearBottom({ ...base, scrollTop: 900 - LIVE_FOLLOW_THRESHOLD - 1 }), false)
  assert.equal(nearBottom({ ...base, scrollTop: 0 }), false)
})

test('short logs and unknown metrics stay at the bottom', () => {
  assert.equal(nearBottom({ scrollTop: 0, scrollHeight: 40, clientHeight: 400 }), true)
  assert.equal(nearBottom({ scrollTop: NaN, scrollHeight: 1000, clientHeight: 100 }), true)
})

test('new entries follow only when the reader is at the bottom', () => {
  assert.equal(shouldFollowLive({ sessionChanged: false, nearBottom: true }), true)
  assert.equal(shouldFollowLive({ sessionChanged: false, nearBottom: false }), false)
})

test('switching sessions always returns to the newest entry', () => {
  assert.equal(shouldFollowLive({ sessionChanged: true, nearBottom: false }), true)
})
