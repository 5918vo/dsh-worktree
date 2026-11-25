/**
 * Rail row decisions, separated from the row's markup.
 *
 * The rail is a scannable index, not a data sheet: a row shows the task status
 * and at most **one** alarm — the most urgent signal — while every other alarm
 * stays reachable from the "more states" popover. Static metadata (tags,
 * estimate, a plain priority, far-off deadlines) is not an alarm at all and
 * lives in the stage meta block and the inspector.
 *
 * Everything here is a pure function over plain data so the ranking can be
 * tested without rendering: `Rail` only turns the result into `h()` calls.
 */
import { fill } from './markdown'
import { pendingLabel, postMergeLabel } from './status'

export type RailTone = '' | 'weak' | 'accent' | 'warn' | 'err' | 'ok' | 'tag'

export interface RailSignal {
  /** Stable id; also the dedupe key and the icon selector. */
  kind: string
  label: string
  tone: RailTone
  /** Hover/assistive text when the label is abbreviated. */
  title: string
}

export interface RailAlertSource {
  primaryAlert?: string | null
  extraAlerts?: Array<string | null | undefined>
  stalledDays?: number
}

export interface RailCriteria {
  checked: number
  total: number
}

export interface RailSignalsInput {
  t: any
  /** Already-resolved board status label and chip tone. */
  statusLabel: string
  statusTone: RailTone
  /** Session interaction, not the task lifecycle: approval / plan-review / question. */
  pendingKind: string
  /** Raw task lifecycle; `review` is distinct from session pending kinds. */
  taskStatus: string
  health: { kind: string; message?: string } | null
  running: boolean
  attention: RailAlertSource
  deps: { blocked: boolean; open: Array<{ title: string }> } | null
  due: { kind: string; days: number } | null
  /** Acceptance progress; only consulted while the task waits for review. */
  criteria: RailCriteria
  /** Points estimate, or null when unset. Reported as static metadata. */
  estimate: number | null
  tags: string[] | null | undefined
  /** Manual timer start clock (`hh:mm`), '' when not timing. */
  timerClock: string
  postMergeAhead: number
  priority: string | null | undefined
}

export interface RailSignals {
  /** The status chip: always present, never counts as the row's alarm. */
  status: RailSignal
  /** Highest-priority alarm, or null when the row has no alarm. */
  lead: RailSignal | null
  /** Every other alarm, most urgent first; empty hides the popover button. */
  more: RailSignal[]
}

/**
 * Display order only — it never reinterprets or rewrites task state.
 *
 * pending (as the status chip) > broken > post-merge/overdue > session
 * interrupted/error > deadline/dependencies/stall > acceptance > timer >
 * priority. Lower rank wins the single alarm slot.
 */
export const SIGNAL_RANK: Record<string, number> = {
  recovery: 10,
  broken: 12,
  'post-merge': 20,
  overdue: 22,
  session: 30,
  deps: 40,
  'due-today': 42,
  'due-soon': 44,
  stalled: 46,
  criteria: 50,
  timer: 55,
  'priority-high': 60,
}

/** Static metadata: reachable in the stage meta block, never an alarm. */
export const STATIC_METADATA = ['tags', 'estimate', 'priority-low'] as const

/** Icon for a signal, so the popover does not rely on colour alone. */
export function signalIcon(kind: string): string {
  if (kind === 'criteria') return 'checkCircle'
  if (kind === 'timer') return 'clock'
  if (kind === 'priority-high') return 'arrowUp'
  if ((STATIC_METADATA as readonly string[]).includes(kind)) return 'circle'
  return 'alert'
}

/** Alert copy shared by the row alarm and the "more states" popover. */
export function alertText(t: any, kind: string, pendingKind: string, health: { kind: string } | null, stalledDays?: number): string {
  switch (kind) {
    case 'recovery': return t.attentionRecovery
    case 'pending': return pendingLabel(t, pendingKind)
    case 'broken': return t.attentionBroken
    case 'stalled': return String(t.attentionStalledDays).replace('{n}', String(stalledDays || 0))
    case 'session':
      if (!health) return t.sessionIdle
      return health.kind === 'interrupted' ? t.sessionInterrupted : t.sessionError
    default: return ''
  }
}

export function alertTone(kind: string): RailTone {
  if (kind === 'broken' || kind === 'session') return 'err'
  return 'warn'
}

/**
 * Every signal the row knows about, in candidate order.
 *
 * Alarm candidates come first (attention alerts, then the derived deadline,
 * dependency, acceptance and timer signals); static metadata is appended so a
 * caller can still reach it if it ever wants a details list.
 */
export function railSignals(input: RailSignalsInput): RailSignal[] {
  const { t } = input
  const out: RailSignal[] = []
  const seen = new Set<string>()
  const push = (signal: RailSignal) => {
    if (!signal.label || seen.has(signal.kind)) return
    seen.add(signal.kind)
    out.push(signal)
  }

  // Attention alerts. A new turn makes an earlier failure historical: while the
  // session is running the old health never reaches the row.
  const alerts: string[] = []
  if (input.attention.primaryAlert) alerts.push(input.attention.primaryAlert)
  for (const kind of input.attention.extraAlerts || []) if (kind) alerts.push(kind)
  for (const kind of alerts) {
    if (kind === 'pending') continue // the status chip already says so
    if (kind === 'session' && input.running) continue
    if (kind === 'post-merge') continue // derived below from the live snapshot
    push({
      kind,
      label: alertText(t, kind, input.pendingKind, input.health, input.attention.stalledDays),
      tone: alertTone(kind),
      title: alertText(t, kind, input.pendingKind, input.health, input.attention.stalledDays),
    })
  }

  if (input.postMergeAhead > 0) {
    push({ kind: 'post-merge', label: postMergeLabel(t, input.postMergeAhead), tone: 'warn', title: postMergeLabel(t, input.postMergeAhead) })
  }

  const due = input.due
  if (due && due.kind === 'overdue') {
    push({ kind: 'overdue', label: String(t.taskDueOverdue).replace('{n}', String(due.days)), tone: 'err', title: t.taskDueHint })
  } else if (due && due.kind === 'today') {
    push({ kind: 'due-today', label: t.taskDueToday, tone: 'warn', title: t.taskDueHint })
  } else if (due && due.kind === 'soon') {
    push({ kind: 'due-soon', label: String(t.taskDueSoon).replace('{n}', String(due.days)), tone: 'warn', title: t.taskDueHint })
  }

  if (input.deps && input.deps.blocked && input.deps.open.length > 0) {
    const titles = input.deps.open.map((item) => item.title).join(', ')
    push({ kind: 'deps', label: fill(t.taskDepsBlocked, { n: input.deps.open.length }), tone: 'warn', title: titles })
  }

  // Acceptance progress is an alarm only while the task waits for review: that
  // is the moment the count tells you what is left to do.
  if (input.taskStatus === 'review' && input.criteria.total > 0 && input.criteria.checked < input.criteria.total) {
    const label = String(t['boardCriteriaProgress'])
      .replace('{n}', String(input.criteria.checked))
      .replace('{total}', String(input.criteria.total))
    push({ kind: 'criteria', label, tone: 'warn', title: t.acceptanceCriteria })
  }

  if (input.timerClock) {
    push({ kind: 'timer', label: t.taskWorkTiming, tone: 'accent', title: fill(t.taskWorkTimingHint, { time: input.timerClock }) })
  }

  if (input.priority === 'high') {
    push({ kind: 'priority-high', label: t.priorityHigh, tone: 'warn', title: t.priorityHigh })
  }

  const tags: string[] = (Array.isArray(input.tags) ? input.tags : []).filter((tag) => Boolean(tag && tag.trim()))
  if (tags.length) {
    push({ kind: 'tags', label: tags.slice(0, 2).map((tag) => '#' + tag).join(' '), tone: 'tag', title: tags.join(', ') })
  }
  if (input.estimate != null) {
    push({ kind: 'estimate', label: fill(t.taskEstimatePoints, { n: input.estimate }), tone: '', title: t.taskEstimate })
  }
  if (input.priority === 'low') {
    push({ kind: 'priority-low', label: t.priorityLow, tone: 'weak', title: t.priorityLow })
  }

  return out
}

/**
 * Split the candidates into "the one alarm the row shows" and "the rest",
 * keeping a stable order: rank first, candidate order as the tie-break.
 */
export function railRowSignals(input: RailSignalsInput): RailSignals {
  const { t } = input
  const status: RailSignal = input.pendingKind
    ? { kind: 'pending', label: pendingLabel(t, input.pendingKind), tone: 'warn', title: pendingLabel(t, input.pendingKind) }
    : { kind: 'status', label: input.statusLabel, tone: input.statusTone, title: input.statusLabel }

  const alarms = railSignals(input)
    .map((signal, index) => ({ signal, index, rank: SIGNAL_RANK[signal.kind] }))
    .filter((entry) => entry.rank != null)
    .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
    .map((entry) => entry.signal)

  return { status, lead: alarms[0] || null, more: alarms.slice(1) }
}
