/**
 * Structured rail search: a thin query layer on top of the plain-text search.
 *
 * `tag:foo`, `priority:high`, `status:review` become real conditions; anything
 * the parser does not understand stays plain text, so an old-style query keeps
 * behaving exactly like it did before this syntax existed.
 */
import type { TaskPriority } from '../task-meta'
import { parseTagText } from '../task-meta'

export type SearchStatus =
  | 'ready' | 'developing' | 'review' | 'reviewing' | 'merged' | 'cleaned' | 'broken'

export interface ParsedSearchQuery {
  /** 去掉结构化 token 后剩余的纯文本（多段用单个空格连接）。 */
  text: string
  /** 需要全部命中的标签（小写比较）。 */
  tags: string[]
  priorities: TaskPriority[]
  statuses: SearchStatus[]
  /** 已知 key 但值非法的原始 token；仍会作为纯文本参与匹配。 */
  invalid: string[]
}

/**
 * Local copy of the plain-text matcher (model.ts imports this module, so it
 * must not import model.ts back). Same case-insensitive contains rule.
 */
function textMatches(text: string, fields: Array<string | null | undefined>): boolean {
  const q = String(text || '').trim().toLowerCase()
  if (!q) return true
  return fields.some((field) => String(field || '').toLowerCase().includes(q))
}

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high']

const STATUSES: SearchStatus[] = ['ready', 'developing', 'review', 'reviewing', 'merged', 'cleaned', 'broken']

/** Key aliases, compared case-insensitively. */
const KEYS: Record<string, 'tag' | 'priority' | 'status'> = {
  tag: 'tag',
  tags: 'tag',
  priority: 'priority',
  prio: 'priority',
  status: 'status',
}

/**
 * Split on whitespace, except inside double quotes: `tag:"needs design"` is one
 * token. An unclosed quote simply keeps the rest of the input as its value.
 */
function splitTokens(input: string): string[] {
  const tokens: string[] = []
  let token = ''
  let quoted = false
  for (const ch of input) {
    if (ch === '"') {
      quoted = !quoted
      token += ch
      continue
    }
    if (!quoted && /\s/.test(ch)) {
      if (token) tokens.push(token)
      token = ''
      continue
    }
    token += ch
  }
  if (token) tokens.push(token)
  return tokens
}

/** Drop the surrounding quotes of a structured value; unclosed keeps the rest. */
function unquote(value: string): string {
  if (!value.startsWith('"')) return value.replace(/"/g, '')
  const body = value.slice(1)
  return body.endsWith('"') ? body.slice(0, -1) : body
}

/** Text tokens never keep quotes: quoting is a structured-value feature. */
function textOnly(token: string): string {
  return token.replace(/"/g, '').trim()
}

/** 空值 / 非字符串返回全空的查询。 */
export function parseSearchQuery(raw: unknown): ParsedSearchQuery {
  if (typeof raw !== 'string' || !raw.trim()) return { text: '', tags: [], priorities: [], statuses: [], invalid: [] }
  const tags: string[] = []
  const tagSeen = new Set<string>()
  const priorities: TaskPriority[] = []
  const statuses: SearchStatus[] = []
  const invalid: string[] = []
  const text: string[] = []

  for (const token of splitTokens(raw)) {
    // Quoted plain text may contain spaces; only structured tokens carry a key.
    const match = /^([A-Za-z]+):(.*)$/s.exec(token)
    const kind = match ? KEYS[match[1].toLowerCase()] : undefined
    if (!match || !kind) {
      const plain = textOnly(token)
      if (plain) text.push(plain)
      continue
    }
    const value = unquote(match[2])
    if (kind === 'tag') {
      // Empty values are dropped: `tag:` alone is not a condition.
      for (const tag of parseTagText(value)) {
        const key = tag.toLowerCase()
        if (tagSeen.has(key)) continue
        tagSeen.add(key)
        tags.push(key)
      }
      continue
    }
    if (kind === 'priority') {
      const priority = value.trim().toLowerCase()
      if (!PRIORITIES.includes(priority as TaskPriority)) {
        invalid.push(token)
        text.push(token)
        continue
      }
      if (!priorities.includes(priority as TaskPriority)) priorities.push(priority as TaskPriority)
      continue
    }
    const status = value.trim().toLowerCase()
    if (!STATUSES.includes(status as SearchStatus)) {
      invalid.push(token)
      text.push(token)
      continue
    }
    if (!statuses.includes(status as SearchStatus)) statuses.push(status as SearchStatus)
  }

  return { text: text.join(' '), tags, priorities, statuses, invalid }
}

/** 是否包含任何有效结构化条件。 */
export function hasStructuredFilters(query: ParsedSearchQuery): boolean {
  if (!query) return false
  return !!(query.tags.length || query.priorities.length || query.statuses.length)
}

/**
 * 任务是否命中查询。
 * - text 非空时，调用方传入的 extraFields 参与大小写不敏感包含匹配；
 * - 标签按小写精确比较，多个标签 AND；
 * - 优先级、状态多个值 OR；
 * - invalid token 已并入 text，不单独处理。
 */
export function matchesStructuredQuery(
  query: ParsedSearchQuery,
  task: any,
  snapshot: any,
  extraFields?: Array<string | null | undefined>,
): boolean {
  if (!query) return true
  if (query.text && !textMatches(query.text, extraFields || [])) return false

  if (query.tags.length) {
    const values = task && Array.isArray(task.tags) ? task.tags : []
    const keys = new Set<string>()
    for (const value of values) {
      const key = String(value == null ? '' : value).trim().toLowerCase()
      if (key) keys.add(key)
    }
    if (!query.tags.every((tag) => keys.has(tag))) return false
  }

  if (query.priorities.length) {
    const priority = String((task && task.priority) || 'normal').trim().toLowerCase() || 'normal'
    if (!query.priorities.includes(priority as TaskPriority)) return false
  }

  if (query.statuses.length) {
    const status = snapshot && snapshot.status ? String(snapshot.status) : ''
    // A missing snapshot can never satisfy a status condition, but plain text
    // matching above has already run independently.
    if (!status || !query.statuses.includes(status as SearchStatus)) return false
  }

  return true
}
