/**
 * Markdown and file-name helpers shared by the task and project reports.
 *
 * Pure functions only — no DOM, no Node API — so the clipboard text, the
 * downloaded file and the unit tests all come from the same code.
 */

/** Collapse every run of whitespace (including newlines) into one space. */
export function oneLine(value: any): string {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
}

/** Inline Markdown text: one line, backticks escaped so they cannot open a code span. */
export function mdInline(value: any): string {
  return oneLine(value).replace(/`/g, '\\`')
}

/** Multi-line prose: line breaks preserved, CRLF normalized, backticks escaped. */
export function mdBlock(value: any): string {
  return String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .trim()
    .replace(/`/g, '\\`')
}

/** Table cell: pipes escaped and line breaks collapsed, so a row cannot break. */
export function mdCell(value: any): string {
  return mdInline(value).replace(/\|/g, '\\|')
}

/** Inline code span for a table cell; adapts the fence when the value has backticks. */
export function mdCodeCell(value: any): string {
  const text = oneLine(value).replace(/\|/g, '\\|')
  const fence = text.includes('`') ? '``' : '`'
  return fence + text + fence
}

/** Fill `{name}` placeholders; unknown names stay verbatim. */
export function fill(template: any, values: Record<string, string | number>): string {
  let text = String(template == null ? '' : template)
  for (const key of Object.keys(values)) text = text.split('{' + key + '}').join(String(values[key]))
  return text
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** `YYYY-MM-DD HH:mm` in local time; `now` is injectable for tests. */
export function reportTimestamp(now: number = Date.now()): string {
  const date = new Date(now)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/**
 * File-name slug: ASCII letters and digits lowercased, every other run folded
 * into one dash, dashes trimmed, at most 32 chars. `fallback` (project id8 or
 * `project`) keeps the name usable when the display name has no ASCII at all.
 */
export function safeSlug(value: any, fallback: string = 'project'): string {
  return slugPart(value) || slugPart(fallback) || 'project'
}

function slugPart(value: any): string {
  return String(value == null ? '' : value)
    .replace(/[^0-9A-Za-z]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 32)
    .replace(/-+$/g, '')
}
