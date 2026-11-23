import { React, h } from './ui'
import { fmtK, pad2, relTime, taskStamp } from './format'
import type { TaskDiff, TaskView } from '../models'
import { QUICK_PROMPTS, quickPromptDisabledReason, quickPromptReasonKey, quickPromptText } from './quick-prompts'
import { acceptanceHintFor, criteria, criteriaProgress, boardStatus, boardStatusLabel, commitRangeText, diffCount, diffHeadSha, diffLineKind, shortSha, type BoardAction, type BoardCta } from './model'
import { pendingLabel } from './status'
import type { SessionHealth } from './task-attention'
import { fallbackEntries, type TimelineEntry } from './timeline'
import { entryTag, entryTitle, liveStatsText, modelLabel, modelLabelFull, pressurePercent, readLive, stepStatusLabel, tokenSummary } from './live-session'
import { postMergeCount, reviewStaleCount } from './review-surfaces'
import { NOTES_MAX_LENGTH, parseTagText, validateTags } from '../task-meta'

export type BoardTab = 'overview' | 'live' | 'diff'

export interface StageProps {
  t: any
  taskView: TaskView
  projectName: string
  running: boolean
  /** Pending interaction kind when the session is waiting on the user. */
  pendingKind?: string
  /** How the session's last turn ended, when it did not end cleanly. */
  health?: SessionHealth | null
  tab: BoardTab
  onTab: (tab: BoardTab) => void
  ctas: BoardCta
  disabledActions: Record<string, string | undefined>
  /** Per-action blockers, already localized, in display order. */
  actionReasons?: Partial<Record<string, string[]>>
  onAction: (action: BoardAction) => void
  /** A criterion write is in flight; the checkboxes stay disabled. */
  criteriaBusy?: boolean
  /** Toggle one acceptance criterion; omitted keeps the checklist read-only. */
  onToggleCriterion?: (text: string, checked: boolean) => void
  /** Copy the acceptance report; omitted hides the entry (SSR / tests). */
  onCopyReport?: () => void
  /** Download the acceptance report as `.md`; omitted hides the entry. */
  onDownloadReport?: () => void
  /** A report action is in flight; both report buttons stay disabled. */
  reportBusy?: boolean
  /** Persist tags / priority / notes; omitted keeps the info block read-only. */
  onSaveMeta?: (patch: { tags?: string[]; priority?: string; notes?: string }) => Promise<void>
  /** A metadata write is in flight; the editors stay disabled. */
  metaBusy?: boolean
  entries: TimelineEntry[]
  entriesReady: boolean
  /** Raw session projections `values` for the selected session, when available. */
  live?: any
  sessionId: string
  onOpenSession: () => void
  onStartSession: () => void
  diff: TaskDiff | null
  diffLoading: boolean
  diffError: string
  onRetryDiff: () => void
  baseSha: string
  headSha: string
  onToggleRail: () => void
  onToggleInspector: () => void
  /** Narrow container: labelled back-to-list entry, rail is an overlay. */
  narrow?: boolean
  notice?: { message: string } | null
  onDismissNotice?: () => void
  /** Persistent note when a publish only partly succeeded (session not bound). */
  partial?: { message: string } | null
  onDismissPartial?: () => void
  onBackToList?: () => void
  /** Send a free-form prompt into this task's session. */
  onSendPrompt?: (text: string) => Promise<void>
  promptBusy?: boolean
}

export function Stage(props: StageProps) {
  const { t, taskView, ctas } = props
  const task = taskView.task
  const status = boardStatus(taskView.snapshot.status, props.running)
  const pendingKind = props.pendingKind || ''
  // While a fresh turn runs, the previous turn's failure is history, not state.
  const health = props.health && !props.running ? props.health : null
  const sessionTone = health ? (health.kind === 'interrupted' ? 'warn' : 'err') : props.running ? 'accent' : ''
  const sessionLabel = health
    ? (health.kind === 'interrupted' ? t.sessionInterrupted : t.sessionError)
    : props.running ? t.sessionRunning : t.sessionIdle
  const updated = taskStamp(task, taskView.snapshot)
  const count = diffCount(props.diff)
  // A merged task whose branch kept moving still deserves a way forward; a
  // review pinned to an old commit needs a warning. Both can be true at once.
  const postMerge = postMergeCount(taskView.snapshot)
  const reviewStale = reviewStaleCount(status.key, taskView.snapshot)
  const cleanedNow = taskView.snapshot.status === 'cleaned'
  // Explain every visible acceptance CTA up front: the buttons stay disabled,
  // and this list says why. Deduplicate facts that block more than one action
  // (a dirty worktree blocks both checkout and merge).
  const blockerTexts: string[] = []
  const seenBlockers = new Set<string>()
  const visibleActions: Array<string | null | undefined> = [
    ctas.primary && ctas.primary.action,
    ctas.secondary && ctas.secondary.action,
    postMerge > 0 ? 'merge' : null,
  ]
  for (const action of visibleActions) {
    if (!action) continue
    const list = props.actionReasons && props.actionReasons[action]
    if (!Array.isArray(list)) continue
    for (const text of list) {
      const value = String(text || '')
      if (!value || seenBlockers.has(value)) continue
      seenBlockers.add(value)
      blockerTexts.push(value)
    }
  }
  const blockers = blockerTexts.length
    ? h('div', { className: 'dshwd-notice dshwd-alert dshwd-alert-warn', role: 'status' },
      h('div', { className: 'dshwd-notice-text' },
        h('div', { className: 'dshwd-notice-title' }, t.boardBlockersTitle),
        h('ul', { className: 'dshwd-blocker-list' }, blockerTexts.map((text, i) => h('li', { key: i }, text)))))
    : null
  return h('main', { className: 'dshwd-stage' },
    h('div', { className: 'dshwd-topbar' },
      h('div', { className: 'dshwd-topbar-left' },
        props.narrow
          ? h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.backToList, 'aria-label': t.backToList, onClick: props.onBackToList || props.onToggleRail },
            h('span', { key: 'i', 'aria-hidden': 'true' }, '‹'),
            h('span', { key: 'l', className: 'dshwd-btn-label' }, t.backToList))
          : h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.boardCollapseLeft, onClick: props.onToggleRail }, '◧'),
        h('div', { className: 'dshwd-breadcrumb' },
          h('span', null, props.projectName),
          h('span', null, '/'),
          h('strong', { className: 'dshwd-mono' }, task.branch || '—'),
          h('span', null, '→'),
          h('span', { className: 'dshwd-mono' }, task.baseBranch))),
      h('div', { className: 'dshwd-topbar-right' },
        h('button', { className: 'dshwd-btn dshwd-btn-ghost', title: t.boardCollapseRight, 'aria-label': t.boardInspector, onClick: props.onToggleInspector },
          h('span', { key: 'i', 'aria-hidden': 'true' }, '◨'),
          h('span', { key: 'l', className: 'dshwd-btn-label' }, t.boardInspector)))),

    h('header', { className: 'dshwd-stage-head' },
      h('div', { className: 'dshwd-stage-title-row' },
        h('div', { style: { minWidth: '0' } },
          h('h1', { className: 'dshwd-stage-title' }, task.title),
          h('div', { className: 'dshwd-stage-sub' },
            h('span', { className: 'dshwd-chip ' + (status.chip ? 'dshwd-' + status.chip : '') },
              h('span', { className: 'dshwd-dot dshwd-' + status.dot, style: { width: '5px', height: '5px' } }),
              boardStatusLabel(t, status)),
            pendingKind
              ? h('span', { className: 'dshwd-chip dshwd-warn' }, pendingLabel(t, pendingKind))
              : null,
            task.sessionId
              ? h('span', {
                className: 'dshwd-chip' + (sessionTone ? ' dshwd-' + sessionTone : ''),
                title: health
                  ? (health.kind === 'interrupted' ? t.sessionInterruptedHint : t.sessionErrorHint) + (health.message ? ' · ' + health.message : '')
                  : undefined,
              }, sessionLabel)
              : null,
            pendingKind && task.sessionId
              ? h('button', {
                className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini',
                title: t.handlePending,
                onClick: props.onOpenSession,
              }, t.handlePending)
              : null,
            h('span', { className: 'dshwd-mono', style: { color: 'var(--text-3)', fontSize: '11px' }, title: commitRangeText(t, { baseSha: props.baseSha, headSha: props.headSha, merged: taskView.snapshot.merged, baseBranch: task.baseBranch }) },
              commitRangeText(t, { baseSha: props.baseSha, headSha: props.headSha, merged: taskView.snapshot.merged, baseBranch: task.baseBranch }) + ' · ' + relTime(updated, t)))),
        h('div', { style: { display: 'flex', gap: '8px', flexShrink: '0' } },
          ctas.secondary ? actionButton(t, ctas.secondary.action, ctas.secondary.label, props, false) : null,
          actionButton(t, ctas.primary.action, ctas.primary.label, props, true))),

      h('nav', { className: 'dshwd-tabs' },
        tabButton('overview', t.boardOverviewTab, props),
        tabButton('live', t.liveSession, props),
        h('button', {
          key: 'diff',
          className: 'dshwd-tab' + (props.tab === 'diff' ? ' dshwd-active' : ''),
          onClick: () => props.onTab('diff'),
        }, t.codeChanges, h('span', { className: 'dshwd-mono', style: { fontSize: '11px', color: 'var(--text-3)' } }, String(count))))),

    h('div', { className: 'dshwd-stage-body' },
      taskView.snapshot.status === 'reviewing'
        ? h('div', { className: 'dshwd-notice dshwd-alert dshwd-alert-info', role: 'status' },
          h('div', { className: 'dshwd-notice-text' },
            h('div', { className: 'dshwd-hint' }, String(t.reviewDetachedHint).replace('{sha}', shortSha(props.headSha)))))
        : null,
      props.partial
        ? h('div', { className: 'dshwd-notice dshwd-alert dshwd-alert-warn', role: 'status' },
          h('div', { className: 'dshwd-notice-text' },
            h('div', { className: 'dshwd-notice-title' }, t.publishPartialTitle),
            h('div', { className: 'dshwd-hint' }, props.partial.message)),
          h('div', { className: 'dshwd-notice-actions' },
            // The worktree exists but nothing is attached: offer the missing
            // step here instead of pretending the task is ready to open.
            !task.sessionId
              ? h('button', { className: 'dshwd-btn', onClick: () => props.onAction('create') }, t.createSession)
              : null,
            h('button', {
              className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-copy',
              title: t.close,
              'aria-label': t.close,
              onClick: props.onDismissPartial,
            }, '×')))
        : null,
      blockers,
      postMerge > 0
        ? h('div', { className: 'dshwd-notice dshwd-alert dshwd-alert-warn' },
          h('div', { className: 'dshwd-notice-text' },
            h('div', { className: 'dshwd-notice-title' }, String(t.postMergeTitle).replace('{n}', String(postMerge))),
            h('div', { className: 'dshwd-hint' }, String(t.postMergeHint).replace('{n}', String(postMerge)))),
          // A cleaned task has no worktree to merge from; offer no dead action.
          cleanedNow
            ? null
            : h('div', { className: 'dshwd-notice-actions' },
              actionButton(t, 'merge', 'mergeAgain', props, false),
              actionButton(t, 'continue', 'continueTask', props, false)))
        : null,
      reviewStale > 0
        ? h('div', { className: 'dshwd-notice dshwd-alert dshwd-alert-warn' },
          h('div', { className: 'dshwd-notice-text' },
            h('div', { className: 'dshwd-notice-title' }, t.reviewStaleTitle),
            h('div', { className: 'dshwd-hint' }, String(t.reviewStaleHint).replace('{n}', String(reviewStale)))))
        : null,
      // Errors from checkout/merge/cleanup keep living here after the toast is
      // gone, so a refused action stays explainable.
      props.notice
        ? h('div', { className: 'dshwd-notice dshwd-alert', role: 'alert' },
          h('span', { className: 'dshwd-notice-text' }, props.notice.message),
          h('button', {
            className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-copy',
            title: t.close,
            'aria-label': t.close,
            onClick: props.onDismissNotice,
          }, '×'))
        : null,
      props.tab === 'overview' ? h(Overview, props)
        : props.tab === 'live' ? h(Live, props)
          : h(Diff, props)))
}

function tabButton(tab: BoardTab, label: string, props: StageProps) {
  return h('button', {
    key: tab,
    className: 'dshwd-tab' + (props.tab === tab ? ' dshwd-active' : ''),
    onClick: () => props.onTab(tab),
  }, label)
}

function actionButton(t: any, action: BoardAction, labelKey: string, props: StageProps, primary: boolean) {
  if (action === 'none') {
    return h('button', { key: 'none', className: 'dshwd-btn' + (primary ? ' dshwd-btn-cta' : ''), disabled: true }, t[labelKey])
  }
  const disabled = props.disabledActions[action]
  return h('button', {
    key: action,
    className: 'dshwd-btn' + (primary ? ' dshwd-btn-cta' : ''),
    disabled: !!disabled,
    title: disabled || undefined,
    onClick: () => { if (!disabled) props.onAction(action) },
  }, t[labelKey])
}

function Overview(props: StageProps) {
  const { t } = props
  const status = props.taskView.snapshot.status
  const items = criteria(props.taskView.task, status)
  const progress = criteriaProgress(items)
  const readOnly = status === 'merged' || status === 'cleaned'
  const toggle = readOnly ? undefined : props.onToggleCriterion
  const progressText = progress.missing === 0
    ? String(t.boardCriteriaAllDone)
    : String(t.boardCriteriaProgress).replace('{n}', String(progress.checked)).replace('{total}', String(progress.total))
  const hint = acceptanceHintFor(t, status, Number(props.taskView.snapshot.postMergeAhead) || 0)
  return h('div', { className: 'dshwd-measure' },
    h('section', { className: 'dshwd-block' },
      h('div', { className: 'dshwd-block-label' }, t.taskDescription),
      h('div', { className: 'dshwd-prose' }, props.taskView.task.description || '—')),
    h(TaskMetaSection, props),
    h('section', { className: 'dshwd-block' },
      h('div', { className: 'dshwd-block-head' },
        h('div', { className: 'dshwd-block-label' }, items.length ? `${t.acceptanceCriteria} · ${progressText}` : t.acceptanceCriteria),
        props.onCopyReport || props.onDownloadReport
          ? h('div', { className: 'dshwd-block-actions' },
            props.onCopyReport
              ? h('button', {
                type: 'button',
                className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini',
                disabled: !!props.reportBusy,
                title: props.reportBusy ? t.working : t.reportCopy,
                onClick: props.onCopyReport,
              }, t.reportCopy)
              : null,
            props.onDownloadReport
              ? h('button', {
                type: 'button',
                className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini',
                disabled: !!props.reportBusy,
                title: props.reportBusy ? t.working : t.reportDownload,
                onClick: props.onDownloadReport,
              }, t.reportDownload)
              : null)
          : null),
      items.length
        ? h('div', { className: 'dshwd-check-list' }, items.map((item, i) => (toggle
          ? h('label', { key: i, className: 'dshwd-check-item dshwd-check-toggle' },
            h('input', {
              type: 'checkbox',
              checked: item.checked,
              disabled: !!props.criteriaBusy,
              onChange: () => toggle(item.text, !item.checked),
            }),
            h('span', null, item.text))
          : h('div', { key: i, className: 'dshwd-check-item dshwd-check-readonly' },
            h('span', { className: 'dshwd-check-box' + (item.checked ? '' : ' dshwd-todo'), 'aria-hidden': 'true' }, item.checked ? '✓' : ''),
            h('span', null, item.text)))))
        : h('div', { className: 'dshwd-hint' }, t.boardNoCriteria),
      hint ? h('div', { className: 'dshwd-hint', style: { marginTop: '6px' } }, hint) : null))
}

/**
 * Read-only task info. Deliberately hook-free so the shallow-render tests can
 * walk it; the editable variant is only created when a save callback exists.
 */
function TaskMetaSection(props: StageProps) {
  if (props.onSaveMeta) return h(TaskMetaEditor, props)
  const { t } = props
  const task = props.taskView.task
  const tags: string[] = Array.isArray(task.tags) ? task.tags : []
  const priority = task.priority === 'high' || task.priority === 'low' ? task.priority : 'normal'
  return h('section', { className: 'dshwd-block dshwd-task-meta' },
    h('div', { className: 'dshwd-block-label' }, t.taskInfo),
    h('div', { className: 'dshwd-meta-grid' },
      h('div', { className: 'dshwd-meta-row' },
        h('div', { className: 'dshwd-meta-label' }, t.taskTags),
        h('div', { className: 'dshwd-meta-chips' }, tags.length
          ? tags.map((tag) => h('span', { key: tag, className: 'dshwd-chip dshwd-chip-sm dshwd-tag' }, '#' + tag))
          : h('span', { className: 'dshwd-hint' }, t.taskTagsEmpty))),
      h('div', { className: 'dshwd-meta-row' },
        h('div', { className: 'dshwd-meta-label' }, t.taskPriority),
        h('div', { className: 'dshwd-meta-value' }, h('span', { className: 'dshwd-chip dshwd-chip-sm' }, priority === 'high' ? t.priorityHigh : priority === 'low' ? t.priorityLow : t.priorityNormal))),
      h('div', { className: 'dshwd-meta-row' },
        h('div', { className: 'dshwd-meta-label' }, t.taskNotes),
        h('div', { className: 'dshwd-prose dshwd-notes' }, task.notes || t.taskNotesEmpty))))
}

/**
 * Editable task info: tags, priority and notes.
 *
 * All three write through the same `task/meta` endpoint, which owns the atomic
 * read-modify-write on the server; this component only keeps the edit buffers.
 * Choosing a different task resets the buffers from that task's saved values.
 */
function TaskMetaEditor(props: StageProps) {
  const { t } = props
  const task = props.taskView.task
  const save = props.onSaveMeta
  const busy = !!props.metaBusy
  const tags: string[] = Array.isArray(task.tags) ? task.tags : []
  const priority = task.priority === 'high' || task.priority === 'low' ? task.priority : 'normal'
  const [editingTags, setEditingTags] = React.useState(false)
  const [tagText, setTagText] = React.useState('')
  const [tagError, setTagError] = React.useState('')
  const [notes, setNotes] = React.useState(task.notes || '')
  const [notesOpen, setNotesOpen] = React.useState(false)
  const [notesError, setNotesError] = React.useState('')
  const editingRef = React.useRef(false)
  editingRef.current = notesOpen
  // Refresh may replace the task while the user is typing; never overwrite the
  // open editor, only a closed one. Switching tasks always resets.
  React.useEffect(() => {
    if (!editingRef.current) setNotes(task.notes || '')
  }, [task.id, task.notes])
  React.useEffect(() => {
    setEditingTags(false)
    setTagError('')
    setNotesError('')
  }, [task.id])

  const startEditTags = () => {
    setTagText(tags.join(', '))
    setTagError('')
    setEditingTags(true)
  }
  const saveTags = async () => {
    if (!save) return
    const list = parseTagText(tagText)
    const check = validateTags(list)
    if (!check.ok) {
      setTagError(check.error === 'too-many' ? t.taskTagsTooMany : t.taskTagsTooLong)
      return
    }
    try {
      await save({ tags: list })
    } catch {
      // The board already surfaced the server message; keep the editor open.
      return
    }
    setEditingTags(false)
  }
  const saveNotes = async () => {
    if (!save) return
    const text = notes.trim()
    if (text.length > NOTES_MAX_LENGTH) {
      setNotesError(String(t.taskNotesTooLong).replace('{n}', String(NOTES_MAX_LENGTH)))
      return
    }
    try {
      await save({ notes: text })
    } catch {
      return
    }
    setNotesOpen(false)
    setNotes('')
  }

  return h('section', { className: 'dshwd-block dshwd-task-meta' },
    h('div', { className: 'dshwd-block-label' }, t.taskInfo),
    h('div', { className: 'dshwd-meta-grid' },
      h('div', { className: 'dshwd-meta-row' },
        h('div', { className: 'dshwd-meta-label' }, t.taskTags),
        h('div', { className: 'dshwd-meta-value' },
          editingTags
            ? h('div', { className: 'dshwd-meta-editor' },
              h('input', {
                className: 'dshwd-input' + (tagError ? ' dshwd-invalid' : ''),
                value: tagText,
                disabled: busy,
                placeholder: t.taskTagsPlaceholder,
                'aria-label': t.taskTags,
                'aria-invalid': tagError ? 'true' : 'false',
                onChange: (e: any) => { setTagText(e.target.value); setTagError('') },
                onKeyDown: (e: any) => {
                  if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent && e.nativeEvent.isComposing)) { e.preventDefault(); void saveTags() }
                  if (e.key === 'Escape') setEditingTags(false)
                },
              }),
              h('div', { className: 'dshwd-meta-editor-actions' },
                h('button', { type: 'button', className: 'dshwd-btn dshwd-btn-mini', disabled: busy, onClick: () => void saveTags() }, t.save),
                h('button', { type: 'button', className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini', disabled: busy, onClick: () => setEditingTags(false) }, t.cancel)),
              h('div', { className: 'dshwd-hint' }, t.taskTagsHint),
              tagError ? h('div', { className: 'dshwd-alert', role: 'alert' }, tagError) : null)
            : h('div', { className: 'dshwd-meta-chips' },
              tags.length
                ? tags.map((tag) => h('span', { key: tag, className: 'dshwd-chip dshwd-chip-sm dshwd-tag' }, '#' + tag))
                : h('span', { className: 'dshwd-hint' }, t.taskTagsEmpty),
              save
                ? h('button', { type: 'button', className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini', disabled: busy, onClick: startEditTags }, tags.length ? t.edit : t.taskTagsAdd)
                : null))),
      h('div', { className: 'dshwd-meta-row' },
        h('div', { className: 'dshwd-meta-label' }, t.taskPriority),
        h('div', { className: 'dshwd-meta-value' },
          save
            ? h('select', {
              className: 'dshwd-select dshwd-meta-select',
              value: priority,
              disabled: busy,
              'aria-label': t.taskPriority,
              onChange: (e: any) => { void save({ priority: e.target.value }).catch(() => {}) },
            },
              h('option', { value: 'low' }, t.priorityLow),
              h('option', { value: 'normal' }, t.priorityNormal),
              h('option', { value: 'high' }, t.priorityHigh))
            : h('span', { className: 'dshwd-chip dshwd-chip-sm' }, priority === 'high' ? t.priorityHigh : priority === 'low' ? t.priorityLow : t.priorityNormal))),
      h('div', { className: 'dshwd-meta-row' },
        h('div', { className: 'dshwd-meta-label' }, t.taskNotes),
        h('div', { className: 'dshwd-meta-value' },
          notesOpen
            ? h('div', { className: 'dshwd-meta-editor' },
              h('textarea', {
                className: 'dshwd-textarea dshwd-notes-input' + (notesError ? ' dshwd-invalid' : ''),
                value: notes,
                rows: 4,
                maxLength: NOTES_MAX_LENGTH,
                disabled: busy,
                placeholder: t.taskNotesPlaceholder,
                'aria-label': t.taskNotes,
                'aria-invalid': notesError ? 'true' : 'false',
                onChange: (e: any) => { setNotes(e.target.value); setNotesError('') },
              }),
              h('div', { className: 'dshwd-notes-foot' },
                h('span', { className: 'dshwd-hint dshwd-mono' }, `${notes.length}/${NOTES_MAX_LENGTH}`),
                h('div', { className: 'dshwd-meta-editor-actions' },
                  h('button', { type: 'button', className: 'dshwd-btn dshwd-btn-mini', disabled: busy, onClick: () => void saveNotes() }, t.save),
                  h('button', { type: 'button', className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini', disabled: busy, onClick: () => setNotesOpen(false) }, t.cancel))),
              notesError ? h('div', { className: 'dshwd-alert', role: 'alert' }, notesError) : null)
            : h('div', { className: 'dshwd-meta-notes' },
              h('div', { className: 'dshwd-prose dshwd-notes' }, task.notes || t.taskNotesEmpty),
              save
                ? h('button', { type: 'button', className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini', disabled: busy, onClick: () => { setNotes(task.notes || ''); setNotesError(''); setNotesOpen(true) } }, t.edit)
                : null))))
  )
}

function Live(props: StageProps) {
  const { t } = props
  const bodyRef = React.useRef(null)
  const live = readLive(props.live)
  const [showAll, setShowAll] = React.useState(false)
  const [prompt, setPrompt] = React.useState('')
  const [sending, setSending] = React.useState(false)
  React.useEffect(() => { setShowAll(false) }, [props.sessionId])
  React.useEffect(() => { setPrompt('') }, [props.sessionId])
  React.useEffect(() => {
    const el: any = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [props.entries.length, props.sessionId])

  if (!props.sessionId) {
    return h('div', { className: 'dshwd-measure' },
      h('div', { className: 'dshwd-stream' },
        h('div', { className: 'dshwd-stream-head' }, h('span', { className: 'dshwd-mono' }, 'SESSION · —')),
        h('div', { className: 'dshwd-empty', style: { minHeight: '160px' } },
          h('div', { className: 'dshwd-empty-title' }, t.noSession),
          h('div', { className: 'dshwd-hint' }, t.boardNoSessionHint),
          h('button', { className: 'dshwd-btn dshwd-btn-cta', onClick: props.onStartSession }, t.startAgent))))
  }

  // Live projections can lag behind the timeline; fall back to the timeline's
  // own turn outline so the panel is never blank while data arrives.
  const history = props.entries.length ? props.entries : fallbackEntries(live ? live.turns : [])
  const historySteps = new Set(history.map((entry) => entry.stepKey).filter(Boolean)).size
  const modelText = modelLabel(live && live.model) || history.find((entry) => entry.model)?.model || '—'
  const modelFull = modelLabelFull(live && live.model) || modelText
  const statsText = live || historySteps ? liveStatsText(live && live.stats, historySteps, t) : '—'
  const tokenText = tokenSummary(live && live.tokens, t)
  const todos = (live && live.todos) || []
  const pct = pressurePercent(live && live.pressure)
  const cache = live && live.tokens ? fmtK(live.tokens.cacheReadTokens) : null
  const RECENT_STEPS = 5
  const visible = showAll ? history : history.slice(-RECENT_STEPS)
  const offset = showAll ? 0 : Math.max(0, history.length - RECENT_STEPS)
  const block = quickPromptDisabledReason({ hasSession: !!props.sessionId, pendingKind: props.pendingKind, busy: props.promptBusy })
  const canSend = !!props.onSendPrompt && !block && !sending && !!prompt.trim()
  const send = async () => {
    if (!canSend || !props.onSendPrompt) return
    setSending(true)
    try {
      // The parent toasts failures; the textarea keeps the text for a retry.
      await props.onSendPrompt(prompt)
      setPrompt('')
    } catch {
      /* keep the draft */
    } finally {
      setSending(false)
    }
  }
  const promptHint = block
    ? String(t[quickPromptReasonKey(block)] || '')
    : props.running ? t.quickPromptQueued : ''

  return h('div', { className: 'dshwd-measure' },
    h('div', { className: 'dshwd-live-bar' },
      h('span', { className: 'dshwd-live-stat' }, h('span', { className: 'dshwd-live-bar-k' }, t.liveModel), h('strong', { className: 'dshwd-mono', title: modelFull }, modelText)),
      h('span', { className: 'dshwd-live-stat dshwd-mono' }, statsText),
      tokenText ? h('span', { className: 'dshwd-live-stat dshwd-mono' }, tokenText) : null,
      h('span', { className: 'dshwd-live-bar-grow' }),
      history.length > RECENT_STEPS
        ? h('button', {
          className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini',
          onClick: () => setShowAll((v: boolean) => !v),
        }, showAll ? t.collapseAll : String(t.showRecentSteps).replace('{n}', String(RECENT_STEPS)))
        : null,
      h('button', { className: 'dshwd-btn dshwd-btn-ghost dshwd-btn-mini', onClick: props.onOpenSession }, t.openInSession, ' ↗')),

    h('div', { className: 'dshwd-live-grid' },
      h('div', { ref: bodyRef, className: 'dshwd-live-log' },
        !props.entriesReady
          ? h('div', { className: 'dshwd-hint' }, t.loading)
          : visible.length
            ? visible.map((entry, index) => h('details', { key: entry.id || index, className: 'dshwd-step dshwd-step--' + entry.kind },
              h('summary', { className: 'dshwd-step-head' },
                h('span', { className: 'dshwd-step-gutter dshwd-mono' }, pad2(offset + index + 1)),
                h('span', { className: 'dshwd-step-tag' }, entryTag(entry, t)),
                h('span', { className: 'dshwd-step-title', title: entry.detail || entryTitle(entry, t) }, entryTitle(entry, t)),
                entry.meta ? h('span', { className: 'dshwd-step-meta dshwd-mono' }, entry.meta) : null,
                entry.status
                  ? h('span', {
                    className: 'dshwd-step-status ' + (entry.status === 'error' ? 'dshwd-text-err' : entry.status === 'running' ? 'dshwd-text-warn' : 'dshwd-text-ok'),
                  }, stepStatusLabel(entry.status, t))
                  : null),
              h('div', { className: 'dshwd-step-body' }, entry.detail || '—')))
            : h('div', { className: 'dshwd-step' },
              h('div', { className: 'dshwd-step-head' },
                h('span', { className: 'dshwd-step-gutter dshwd-mono' }, '—'),
                h('span', { className: 'dshwd-step-title' }, t.noTurns)))),

      h('div', { className: 'dshwd-live-side' },
        h('div', { className: 'dshwd-live-side-block' },
          h('div', { className: 'dshwd-live-side-title' }, t.liveTodos),
          todos.length
            ? h('ul', { className: 'dshwd-todo-mini' }, todos.slice(0, 10).map((todo: any, i: number) => {
              const done = !!todo && todo.status === 'completed'
              return h('li', { key: i, className: done ? 'dshwd-done' : '' },
                h('span', { className: 'dshwd-todo-mark', 'aria-hidden': 'true' }, done ? '✓' : ''),
                h('span', null, String((todo && todo.content) || '')))
            }))
            : h('div', { className: 'dshwd-hint' }, '—')),
        h('div', { className: 'dshwd-live-side-block' },
          h('div', { className: 'dshwd-live-side-title' }, t.livePressure),
          h('div', { className: 'dshwd-meter-row' },
            h('span', { className: 'dshwd-mono' }, pct === null ? '—' : pct + '%'),
            h('span', { className: 'dshwd-hint' }, cache ? cache + ' ' + t.liveTokensCache : '')),
          h('div', { className: 'dshwd-meter', role: 'img', 'aria-label': t.livePressure + ' ' + (pct === null ? '—' : pct + '%') },
            h('i', { style: { width: (pct === null ? 0 : pct) + '%' } }))))),

    h('div', { className: 'dshwd-prompt' },
      h('div', { className: 'dshwd-prompt-chips' },
        h('span', { className: 'dshwd-prompt-title' }, t.quickPromptTitle),
        QUICK_PROMPTS.map((item) => h('button', {
          key: item.key,
          type: 'button',
          className: 'dshwd-prompt-chip',
          disabled: !!block,
          onClick: () => setPrompt(quickPromptText(item.key, props.taskView.task)),
        }, t[item.label]))),
      h('div', { className: 'dshwd-prompt-box' },
        h('textarea', {
          className: 'dshwd-prompt-input',
          rows: 3,
          value: prompt,
          placeholder: t.quickPromptPlaceholder,
          disabled: !!block,
          'aria-label': t.quickPromptTitle,
          onChange: (e: any) => setPrompt(e.target.value),
          onKeyDown: (e: any) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void send()
            }
          },
        }),
        h('div', { className: 'dshwd-prompt-foot' },
          h('span', { className: 'dshwd-hint' }, promptHint),
          h('button', {
            type: 'button',
            className: 'dshwd-btn dshwd-btn-cta',
            disabled: !canSend,
            title: block ? String(t[quickPromptReasonKey(block)] || '') : undefined,
            onClick: () => void send(),
          }, t.quickPromptSend))))
  )
}

function Diff(props: StageProps) {
  const { t } = props
  if (props.diffError) {
    return h('div', { className: 'dshwd-alert' }, props.diffError,
      h('button', { className: 'dshwd-btn', onClick: props.onRetryDiff }, t.retry))
  }
  if (props.diffLoading && !props.diff) return h('div', { className: 'dshwd-hint' }, t.loading)
  if (!props.diff) return h('div', { className: 'dshwd-empty' }, h('div', { className: 'dshwd-empty-title' }, t.boardNoDiff))
  const mergedSource = props.diff.source === 'merge-commit'
  const sourceHint = mergedSource ? h('div', { className: 'dshwd-hint' }, t.boardDiffMergedHint) : null
  if (!props.diff.files || !props.diff.files.length) {
    return h('div', { className: 'dshwd-empty' }, h('div', { className: 'dshwd-empty-title' }, t.boardNoDiff), h('div', { className: 'dshwd-hint' }, mergedSource ? t.boardDiffMergedHint : t.boardNoDiffHint))
  }
  return h('div', { className: 'dshwd-measure', style: { maxWidth: '960px' } },
    sourceHint,
    props.diff.files.map((file, i) => h('div', { className: 'dshwd-diff-box', key: file.path + i },
      h('div', { className: 'dshwd-diff-head' },
        h('span', { className: 'dshwd-mono' }, file.path),
        h('span', { className: 'dshwd-mono' }, `+${file.additions} -${file.deletions}`)),
      h('pre', { style: { margin: 0 } },
        String(file.patch || '').split('\n').map((line, j) => h('div', {
          key: j,
          className: 'dshwd-diff-line dshwd-' + diffLineKind(line),
        }, line || ' '))))),
    props.diff.truncated
      ? h('div', { className: 'dshwd-hint' }, props.diff.reason || t.boardDiffTruncated)
      : null)
}
