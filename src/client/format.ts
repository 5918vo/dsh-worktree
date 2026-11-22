export const pad2 = (n: number) => String(n).padStart(2, '0')

export function relTime(ts: number | null | undefined, t: any): string {
  if (!ts) return '—'
  // Git commit stamps can sit slightly ahead of the browser clock; a future
  // stamp must still read as "just now" rather than fall through to a date.
  const diff = Math.max(0, Date.now() - ts)
  if (diff < 60_000) return t.justNow
  if (diff < 3_600_000) return String(t.minutesAgo).replace('{n}', String(Math.floor(diff / 60_000)))
  if (diff < 86_400_000) return String(t.hoursAgo).replace('{n}', String(Math.floor(diff / 3_600_000)))
  if (diff < 7 * 86_400_000) return String(t.daysAgo).replace('{n}', String(Math.floor(diff / 86_400_000)))
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * Timestamp a task row should show.
 *
 * A worktree with no commits of its own (`ahead === 0`) reports the *base*
 * commit time, so a freshly created task displayed "5 分钟前" — the age of the
 * branch it forked from. Only trust `lastCommitAt` once the worktree has its own
 * commit; otherwise use the task's own activity time.
 */
export function taskStamp(task: any, snap: any): number {
  const worktree = (snap && snap.worktree) || {}
  const ahead = Number(worktree.ahead) || 0
  const own = ahead > 0 ? Number(worktree.lastCommitAt) || 0 : 0
  return own || Number((task && (task.updatedAt || task.createdAt)) || 0) || 0
}

/**
 * Normalize a path for display so one screen never mixes `C:/x` with `C:\\x`.
 * Windows-shaped paths (drive letter, UNC, or any backslash) render with
 * backslashes; everything else is left alone.
 */
export function displayPath(value: any): string {
  const path = String(value == null ? '' : value)
  if (!path) return ''
  const windows = /^[a-zA-Z]:[\\/]/.test(path) || /^\\\\/.test(path) || path.includes('\\')
  return windows ? path.replace(/\//g, '\\') : path
}

/**
 * Split a path into separator-terminated chunks so a long path can wrap at
 * directory boundaries instead of mid-name (`overflow-wrap: anywhere`).
 */
export function pathParts(value: any): string[] {
  const path = displayPath(value)
  const parts: string[] = []
  let buf = ''
  for (const ch of path) {
    buf += ch
    if (ch === '\\' || ch === '/') {
      parts.push(buf)
      buf = ''
    }
  }
  if (buf) parts.push(buf)
  return parts.length ? parts : ['']
}

export function baseName(p: string): string {
  const norm = String(p || '').replace(/[\\/]+$/, '')
  const idx = Math.max(norm.lastIndexOf('/'), norm.lastIndexOf('\\'))
  return idx >= 0 ? norm.slice(idx + 1) : norm
}

export function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    /* noop */
  }
  return 'req-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const cx = (...parts: any[]) => parts.filter(Boolean).join(' ')

export function jp(v: any): any {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

export function fmtK(n: any): string | null {
  if (typeof n !== 'number' || !(n > 0)) return null
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
}

/** Visible text of a DSH message content array. */
export function contentText(content: any): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block && typeof block.text === 'string' && block.text.trim()) parts.push(block.text)
  }
  return parts.join('\n')
}

export function clipText(value: any, max: number): string {
  const text = String(value == null ? '' : value).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}

/** Keep tool output informative without dumping whole files into the console. */
export function summarizeResult(name: string | undefined, raw: string, t: any): string {
  const text = clipText(raw, 4000)
  if (!name) return text
  if (name === 'read') {
    const lines = text ? text.split('\n').length : 0
    return String(t.resultRead).replace('{lines}', String(lines)).replace('{chars}', String(text.length))
  }
  if (name === 'glob') {
    const items = text.split('\n').map((item) => item.trim()).filter(Boolean)
    return String(t.resultMatch).replace('{n}', String(items.length)) +
      (items.length ? '\n' + items.slice(0, 3).join('\n') + (items.length > 3 ? '\n…' : '') : '')
  }
  if (name === 'write') return t.resultWrite
  return text
}

export function firstLine(value: any, max = 140): string {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}

export function parentDir(value: any): string {
  const path = String(value || '').replace(/[\\/]+$/, '')
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index > 0 ? path.slice(0, index) : ''
}

/** Short directory hint for a file row; the worktree root itself adds no signal. */
export function dirLabel(value: any, worktreePath?: string): string {
  const parent = parentDir(value)
  if (!parent) return ''
  const normalized = parent.replace(/\\/g, '/').replace(/\/+$/, '')
  if (worktreePath) {
    const root = String(worktreePath).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
    if (root && normalized.toLowerCase() === root) return ''
  }
  if (/\/\.dsh-worktrees\/[^/]+$/.test(normalized)) return ''
  return baseName(parent) + '/'
}

export function parseArgs(raw: any): any {
  if (raw && typeof raw === 'object') return raw
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Rough added/removed line counts for the edit header. */
export function diffCounts(meta: any): string | null {
  const diff = meta && Array.isArray(meta.diffs) ? meta.diffs[0] : null
  if (!diff) return null
  const oldText = typeof diff.oldText === 'string' ? diff.oldText : ''
  const newText = typeof diff.newText === 'string' ? diff.newText : ''
  if (!oldText && !newText) return null
  const counts = new Map<string, number>()
  for (const line of oldText.split('\n').slice(0, 4000)) counts.set(line, (counts.get(line) || 0) + 1)
  let added = 0
  for (const line of newText.split('\n').slice(0, 4000)) {
    const count = counts.get(line) || 0
    if (count > 0) counts.set(line, count - 1)
    else added += 1
  }
  let removed = 0
  for (const count of counts.values()) removed += count
  return '+' + added + ' -' + removed
}

export function toolTitle(name: string, args: any, t: any, worktreePath?: string): string {
  if (!args || typeof args !== 'object') return firstLine(name)
  const path = args.file_path || args.path || ''
  if ((name === 'read' || name === 'write' || name === 'edit' || name === 'multi_edit') && path) {
    return baseName(path) + (dirLabel(path, worktreePath) ? ' · ' + dirLabel(path, worktreePath) : '')
  }
  if (name === 'pwsh' || name === 'shell' || name === 'terminal') return firstLine(args.command, 180)
  if (name === 'glob' || name === 'grep' || name === 'search') return firstLine(args.pattern || args.query, 180)
  if (name === 'working_directory') return firstLine(args.cd, 180)
  if (name === 'todo_write' || name === 'todowrite') {
    const todos = Array.isArray(args.todos) ? args.todos.map((todo: any) => todo && todo.content).filter(Boolean) : []
    return firstLine(todos.join(' / ') || t.todoUpdate)
  }
  if (name === 'ask_user_question') return firstLine(args.question || args.header, 180)
  if (args.command) return firstLine(args.command, 180)
  if (path) return firstLine(path, 180)
  return firstLine(JSON.stringify(args), 180)
}

export function toolDetail(name: string, args: any, t: any): string {
  if (!args || typeof args !== 'object') return ''
  const path = args.file_path || args.path || ''
  if (name === 'pwsh' || name === 'shell' || name === 'terminal') return clipText(args.command, 2000)
  if (name === 'read') return clipText(path, 2000)
  if (name === 'write' || name === 'edit' || name === 'multi_edit') {
    const lines = [path]
    if (typeof args.content === 'string') lines.push(String(t.contentSize).replace('{n}', String(args.content.length)))
    return lines.filter(Boolean).join('\n')
  }
  if (name === 'glob' || name === 'grep' || name === 'search') return clipText(args.pattern || args.query, 2000)
  if (name === 'working_directory') return clipText(args.cd, 2000)
  return clipText(JSON.stringify(args), 2000)
}

export function fmtDuration(ms: number | undefined, t: any): string | null {
  if (typeof ms !== 'number' || ms < 0) return null
  const total = Math.max(1, Math.round(ms / 1000))
  if (total < 60) return String(t.durationSec).replace('{n}', String(total))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (!seconds) return String(t.durationMin).replace('{n}', String(minutes))
  return String(t.durationMinSec).replace('{m}', String(minutes)).replace('{s}', String(seconds))
}


export function fallbackCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

export function copyText(text: string): Promise<boolean> {
  if (!text) return Promise.resolve(false)
  const clip = (navigator as any)?.clipboard
  if (clip && typeof clip.writeText === 'function') {
    return clip.writeText(text).then(() => true, () => fallbackCopy(text))
  }
  return Promise.resolve(fallbackCopy(text))
}

/** Trigger a browser download for generated text (report Markdown). */
export function downloadTextFile(name: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // The click is synchronous but the download starts async; revoke on the next
  // macrotask so Safari has already grabbed the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
