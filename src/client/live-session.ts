/**
 * Pure helpers for the live session panel: the session projections payload is
 * plain data plus JSON-encoded strings, so everything shown on screen is
 * derived here and stays unit-testable (no React, no host access).
 */

import { firstLine, fmtDuration, fmtK, jp } from './format'

export interface LiveSessionData {
  model: any
  cwd: string
  pressure: any
  tokens: any
  stats: any
  todos: any[]
  turns: any[]
  meta: any
  perms: any
}

/** `path` may arrive as a bare string or wrapped as `{ path }`. */
function cwdOf(value: any): string {
  if (typeof value === 'string') return value
  if (value && typeof value.path === 'string') return value.path
  return ''
}

/**
 * Unwrap one projections `values` object. Every field may be absent (young
 * session) or JSON-encoded (the host stores projections as strings), so `jp`
 * decodes first and each consumer gets either the value or a safe empty one.
 */
export function readLive(values: any): LiveSessionData | null {
  if (!values) return null
  const todos = jp(values.todos)
  const turns = jp(values.turnOutline)
  return {
    model: jp(values.modelSelection),
    cwd: cwdOf(jp(values.workingDirectory)),
    pressure: jp(values.contextPressure),
    tokens: jp(values.tokenUsage),
    stats: jp(values.sessionStats),
    todos: Array.isArray(todos) ? todos : [],
    turns: Array.isArray(turns) ? turns : [],
    meta: jp(values.sessionListMetadata),
    perms: jp(values.permissions),
  }
}

/** Full `provider/model` id, preferring the pending selection over the current. */
export function modelLabelFull(model: any): string | null {
  if (!model) return null
  const pick = model.next || model.current
  if (!pick) return null
  if (typeof pick === 'string') return pick
  if (pick.provider && pick.model) return pick.provider + '/' + pick.model
  if (pick.model) return String(pick.model)
  return null
}

/** Short, human-facing name: the model segment of an internal provider path. */
export function shortModelLabel(full: string | null | undefined): string | null {
  const text = String(full || '').trim()
  if (!text) return null
  const parts = text.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : text
}

/** Display name for the live header; `modelLabelFull` carries the raw id. */
export function modelLabel(model: any): string | null {
  return shortModelLabel(modelLabelFull(model))
}

/**
 * Fill percentage of the context window, clamped to 0..100. `null` when the
 * window is unknown, so the caller can print `—` instead of a fake 0%.
 */
export function pressurePercent(pressure: any): number | null {
  const window = Number(pressure && pressure.contextWindow)
  if (!(window > 0)) return null
  const projected = Number((pressure && pressure.projectedTokens) || 0)
  const pct = Math.round((projected / window) * 100)
  if (!Number.isFinite(pct)) return null
  return Math.max(0, Math.min(100, pct))
}

/** `12.3k in · 4 out` — empty when the session has no token usage yet. */
export function tokenSummary(tokens: any, t: any): string {
  if (!tokens) return ''
  const parts: string[] = []
  const input = fmtK(tokens.uncachedInputTokens)
  if (input) parts.push(input + ' ' + t.liveTokensIn)
  const output = fmtK(tokens.outputTokens)
  if (output) parts.push(output + ' ' + t.liveTokensOut)
  return parts.join(' · ')
}

/** Live turn/step counters, falling back to the visible history step count. */
export function liveStatsText(stats: any, historySteps: number, t: any): string {
  if (stats) {
    return String(t.liveStats)
      .replace('{turns}', String(stats.turns || 0))
      .replace('{steps}', String(stats.steps || 0))
  }
  if (historySteps > 0) return String(t.liveStepsOnly).replace('{steps}', String(historySteps))
  return '—'
}

/** Tool-name bucket used as the row's type tag. */
export function toolTag(name: string | undefined, t: any): string {
  if (!name) return t.toolGeneric
  if (name === 'pwsh' || name === 'shell' || name === 'terminal') return t.toolTerminal
  if (name === 'read') return t.toolRead
  if (name === 'write' || name === 'edit' || name === 'multi_edit') return t.toolEdit
  if (name === 'glob' || name === 'grep' || name === 'search') return t.toolFind
  if (name === 'working_directory') return t.toolCd
  if (name === 'todo_write' || name === 'todowrite') return t.toolTodos
  if (name === 'ask_user_question') return t.toolQuestion
  return name
}

/** Type tag for a timeline row: role key for messages, tool bucket for tools. */
export function entryTag(entry: { kind: string; tool?: string }, t: any): string {
  if (entry.kind === 'think') return t.roleThinking
  if (entry.kind === 'user') return t.roleUser
  if (entry.kind === 'agent') return t.roleAssistant
  return toolTag(entry.tool, t)
}

/** Title for a row; reasoning rows have no text title, only a duration. */
export function entryTitle(entry: { kind: string; title?: string; detail?: string; durationMs?: number }, t: any): string {
  if (entry.kind === 'think') return durationText(entry.durationMs, t) || firstLine(entry.detail) || '—'
  return entry.title || '—'
}

/** `持续了 12 秒`, empty when the duration is unknown. */
export function durationText(ms: number | undefined, t: any): string {
  const duration = fmtDuration(ms, t)
  return duration ? String(t.duration).replace('{n}', duration) : ''
}

/** Completion state of a tool row. */
export function stepStatusLabel(status: string | undefined, t: any): string {
  if (status === 'error') return t.stepFailed
  if (status === 'running') return t.stepRunning
  return t.stepDone
}
