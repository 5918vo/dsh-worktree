import test from 'node:test'
import assert from 'node:assert/strict'
import {
  baseName,
  clipText,
  contentText,
  diffCounts,
  dirLabel,
  downloadText,
  firstLine,
  fmtDuration,
  fmtK,
  pad2,
  parentDir,
  parseArgs,
  relTime,
  summarizeResult,
  toolDetail,
  toolTitle,
  taskStamp,
  displayPath,
  pathParts,
  uuid,
} from '../src/client/format.js'

const T = {
  justNow: 'just now',
  minutesAgo: '{n}m ago',
  hoursAgo: '{n}h ago',
  daysAgo: '{n}d ago',
  resultRead: '{lines} lines / {chars} chars',
  resultMatch: '{n} matches',
  resultWrite: 'written',
  todoUpdate: 'todos updated',
  contentSize: '{n} bytes',
  durationSec: '{n}s',
  durationMin: '{n}m',
  durationMinSec: '{m}m {s}s',
}

test('baseName/parentDir handle both separators and trailing slashes', () => {
  assert.equal(baseName('C:\\repo\\src\\a.ts'), 'a.ts')
  assert.equal(baseName('/repo/src/a.ts/'), 'a.ts')
  assert.equal(baseName(''), '')
  assert.equal(parentDir('C:\\repo\\src\\a.ts'), 'C:\\repo\\src')
  assert.equal(parentDir('/repo/a.ts'), '/repo')
})

test('dirLabel hides the worktree root and worktree containers', () => {
  assert.equal(dirLabel('C:/repo/.dsh-worktrees/abc123/src/a.ts', 'C:/repo/.dsh-worktrees/abc123'), 'src/')
  assert.equal(dirLabel('C:/repo/.dsh-worktrees/abc123/package.json', 'C:/repo/.dsh-worktrees/abc123'), '')
  assert.equal(dirLabel('C:/repo/src/a.ts'), 'src/')
})

test('clipText collapses blank runs and truncates with an ellipsis', () => {
  assert.equal(clipText('a\n\n\n\nb', 100), 'a\n\nb')
  assert.equal(clipText('  hello  ', 100), 'hello')
  assert.equal(clipText('abcdef', 3), 'abc…')
})

test('firstLine flattens whitespace and clips', () => {
  assert.equal(firstLine('  a\n\tb   c '), 'a b c')
  assert.equal(firstLine('abcdef', 4), 'abcd…')
})

test('contentText reads string or text blocks', () => {
  assert.equal(contentText('hi'), 'hi')
  assert.equal(contentText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]), 'a\nb')
  assert.equal(contentText([{ type: 'image' }]), '')
  assert.equal(contentText(null), '')
})

test('parseArgs accepts objects, JSON strings and rejects junk', () => {
  assert.deepEqual(parseArgs({ a: 1 }), { a: 1 })
  assert.deepEqual(parseArgs('{"a":1}'), { a: 1 })
  assert.equal(parseArgs('not json'), null)
  assert.equal(parseArgs(42), null)
})

test('diffCounts reports added/removed line counts', () => {
  const meta = { diffs: [{ oldText: 'a\nb\nc', newText: 'a\nB\nc' }] }
  assert.equal(diffCounts(meta), '+1 -1')
  assert.equal(diffCounts({ diffs: [{ oldText: '', newText: '' }] }), null)
  assert.equal(diffCounts({}), null)
})

test('summarizeResult condenses read/glob tool output', () => {
  assert.equal(summarizeResult('read', 'l1\nl2\nl3', T), '3 lines / 8 chars')
  assert.equal(summarizeResult('glob', 'a.ts\nb.ts', T), '2 matches\na.ts\nb.ts')
  assert.equal(summarizeResult('write', 'ignored', T), 'written')
  assert.equal(summarizeResult(undefined, 'plain', T), 'plain')
})

test('toolTitle/toolDetail pick the useful field per tool', () => {
  assert.equal(toolTitle('read', { file_path: 'C:/w/src/a.ts' }, T, 'C:/w'), 'a.ts · src/')
  assert.equal(toolTitle('pwsh', { command: 'npm test' }, T), 'npm test')
  assert.equal(toolTitle('working_directory', { cd: 'C:/w' }, T), 'C:/w')
  assert.equal(toolDetail('pwsh', { command: 'npm test' }), 'npm test')
  assert.equal(toolDetail('write', { file_path: 'a.ts', content: 'abc' }, T), 'a.ts\n3 bytes')
})

test('fmtDuration/relTime/fmtK/pad2 render human labels', () => {
  assert.equal(fmtDuration(undefined, T), null)
  assert.equal(fmtDuration(5_000, T), '5s')
  assert.equal(fmtDuration(120_000, T), '2m')
  assert.equal(fmtDuration(125_000, T), '2m 5s')
  assert.equal(pad2(3), '03')
  assert.equal(fmtK(999), '999')
  assert.equal(fmtK(1500), '1.5k')
  assert.equal(fmtK(0), null)
  const now = Date.now()
  assert.equal(relTime(now, T), 'just now')
  assert.equal(relTime(now - 5 * 60_000, T), '5m ago')
  assert.equal(relTime(now - 2 * 3_600_000, T), '2h ago')
  assert.equal(relTime(null, T), '—')
})

test('uuid is non-empty and unique', () => {
  const a = uuid()
  const b = uuid()
  assert.equal(typeof a, 'string')
  assert.ok(a.length > 0)
  assert.notEqual(a, b)
})

test('relTime never reports the future as minutes ago', () => {
  const now = Date.now()
  // A clock skew must not render "-1m ago": treat it as just now.
  assert.equal(relTime(now + 5 * 60_000, T), 'just now')
  assert.equal(relTime(0, T), '—')
})

test('taskStamp ignores the inherited base commit of a fresh task', () => {
  const created = Date.now() - 60_000
  const base = Date.now() - 5 * 60_000
  const task = { createdAt: created, updatedAt: created }
  // No own commit yet: the worktree's lastCommitAt is the base commit, which
  // would read as "5m ago" for a task created a minute ago.
  assert.equal(taskStamp(task, { worktree: { ahead: 0, lastCommitAt: base } }), created)
  assert.equal(taskStamp(task, { worktree: { ahead: 3, lastCommitAt: base } }), base)
  assert.equal(taskStamp(task, null), created)
  assert.equal(taskStamp({}, null), 0)
})

test('displayPath keeps one separator style per screen', () => {
  assert.equal(displayPath('C:/Users/liang/repo'), 'C:\\Users\\liang\\repo')
  assert.equal(displayPath('C:\\Users\\liang/repo'), 'C:\\Users\\liang\\repo')
  assert.equal(displayPath('/home/liang/repo'), '/home/liang/repo')
  assert.equal(displayPath(''), '')
  assert.equal(displayPath(null), '')
})

test('pathParts breaks long paths at separators', () => {
  assert.deepEqual(pathParts('C:/a/b/c.txt'), ['C:\\', 'a\\', 'b\\', 'c.txt'])
  assert.deepEqual(pathParts('/home/u/x'), ['/', 'home/', 'u/', 'x'])
  assert.deepEqual(pathParts(''), [''])
})

test('downloadText reports false when the browser APIs are missing', () => {
  // Node has no `document`, so the helper must decline instead of throwing.
  assert.equal(downloadText('# report', 'a.md'), false)
})

test('downloadText clicks a hidden link with the requested file name', () => {
  const globals: any = globalThis as any
  const originalUrl = globals.URL
  const originalDoc = globals.document
  const clicked: string[] = []
  const link: any = {
    style: {},
    remove() {},
    click() {
      clicked.push(String(this.download))
      assert.equal(this.href, 'blob:fake')
      assert.equal(this.style.display, 'none')
    },
  }
  try {
    globals.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL() {} }
    globals.document = {
      createElement: (tag: string) => {
        assert.equal(tag, 'a')
        return link
      },
      body: { appendChild() {} },
    }
    assert.equal(downloadText('# report', 'project-demo-20260102-0304.md'), true)
    assert.deepEqual(clicked, ['project-demo-20260102-0304.md'])
  } finally {
    globals.URL = originalUrl
    globals.document = originalDoc
  }
})
