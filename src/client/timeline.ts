import { clipText, contentText, diffCounts, firstLine, parseArgs, summarizeResult, toolDetail, toolTitle } from './format'

export type TimelineEntry = {
  id: string
  kind: 'user' | 'think' | 'agent' | 'tool'
  title: string
  detail: string
  tool?: string
  status?: 'ok' | 'error' | 'running'
  durationMs?: number
  meta?: string
  stepKey?: string
  model?: string
}

export function buildHistoryEntries(records: any[], limit: number, t: any, worktreePath?: string): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const stepStarts = new Map<string, number>()
  const stepDurations = new Map<string, number>()
  const thinkDurationUsed = new Set<string>()
  const pending = new Map<string, { entry: TimelineEntry; time: number }>()
  const idCounts = new Map<string, number>()
  const entryId = (seed: string): string => {
    let hash = 2166136261
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    const base = 'e' + (hash >>> 0).toString(36)
    const seen = idCounts.get(base) || 0
    idCounts.set(base, seen + 1)
    return seen ? base + '-' + seen : base
  }
  const add = (entry: Omit<TimelineEntry, 'id'>, seed: string): TimelineEntry => {
    const next: TimelineEntry = Object.assign({ id: entryId(seed) }, entry)
    entries.push(next)
    return next
  }

  for (const record of records || []) {
    const event = record && (record.event || record)
    if (!event || !event.type) continue
    const data = event.data || {}
    const stepKey = data.turn != null && data.step != null ? data.turn + ':' + data.step : undefined
    const time = typeof event.time === 'number' ? event.time : 0

    if (event.type === 'step/start' && stepKey) {
      stepStarts.set(stepKey, time)
      continue
    }
    if (event.type === 'step/end' && stepKey) {
      const start = stepStarts.get(stepKey)
      if (start && time > start) stepDurations.set(stepKey, time - start)
      continue
    }

    if (event.type === 'user/message') {
      const source = data.source && data.source.kind
      // Runtime context, skill catalogs and clock snapshots are injected as
      // user messages; only the human prompt belongs in the console.
      if (source && source !== 'user') continue
      const text = clipText(contentText(data.content), 4000)
      if (text) add({ kind: 'user', stepKey, title: firstLine(text), detail: text }, ['user', time, stepKey, text].join('|'))
      continue
    }

    if (event.type === 'assistant/message') {
      const message = data.message || {}
      const source = message.source || {}
      const model = source.provider && source.model ? source.provider + '/' + source.model : (typeof source.model === 'string' ? source.model : undefined)
      for (const block of Array.isArray(message.content) ? message.content : []) {
        if (!block) continue
        if (block.type === 'reasoning' && block.text) {
          const text = clipText(block.text, 4000)
          add({ kind: 'think', stepKey, title: '', detail: text, model }, ['think', time, stepKey, text].join('|'))
        } else if (block.type === 'text' && block.text) {
          const text = clipText(block.text, 4000)
          add({ kind: 'agent', stepKey, title: firstLine(text), detail: text, model }, ['agent', time, stepKey, text].join('|'))
        }
      }
      continue
    }

    if (event.type === 'tool/call') {
      const name = String(data.name || 'tool')
      const args = parseArgs(data.arguments)
      const entry = add({
        kind: 'tool',
        tool: name,
        stepKey,
        title: toolTitle(name, args, t, worktreePath),
        detail: toolDetail(name, args, t),
        status: 'running',
      }, ['tool', time, stepKey, data.callId || name, clipText(data.arguments, 120)].join('|'))
      if (data.callId) pending.set(String(data.callId), { entry, time })
      continue
    }

    if (event.type === 'tool/result') {
      const message = data.message || {}
      const callId = (message.source && message.source.callId) || message.toolCallId || data.callId
      const found = callId ? pending.get(String(callId)) : undefined
      const raw = contentText(message.content)
      const isError = message.isError === true || !!data.error
      if (found) {
        found.entry.status = isError ? 'error' : 'ok'
        found.entry.meta = diffCounts(data.meta) || found.entry.meta
        const result = isError ? clipText(raw, 2000) : summarizeResult(found.entry.tool, raw, t)
        found.entry.detail = [found.entry.detail, result].filter(Boolean).join('\n\n')
        if (time && found.time) found.entry.durationMs = time - found.time
      } else if (raw) {
        add({
          kind: 'tool',
          tool: 'result',
          stepKey,
          title: firstLine(raw),
          detail: clipText(raw, 2000),
          status: isError ? 'error' : 'ok',
        }, ['result', time, stepKey, raw].join('|'))
      }
    }
  }

  for (const entry of entries) {
    if (entry.kind !== 'think' || !entry.stepKey || thinkDurationUsed.has(entry.stepKey)) continue
    const duration = stepDurations.get(entry.stepKey)
    if (duration) {
      entry.durationMs = duration
      thinkDurationUsed.add(entry.stepKey)
    }
  }

  return entries.slice(-limit)
}

export function fallbackEntries(turns: any[], limit = 40): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  let n = 0
  for (const turn of (turns || []).slice(-6)) {
    if (!turn) continue
    if (turn.prompt) {
      const text = clipText(turn.prompt, 2000)
      entries.push({ id: 'fu' + (n += 1), kind: 'user', title: firstLine(text), detail: text })
    }
    if (turn.response) {
      const text = clipText(turn.response, 2000)
      entries.push({ id: 'fa' + (n += 1), kind: 'agent', title: firstLine(text), detail: text })
    }
  }
  return entries.slice(-limit)
}

