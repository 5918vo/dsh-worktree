import { React, h } from './ui'
import { Banner, Btn, Card, CardHead, Chip, CopyBtn, Dot, Icon, KV, Modal, Spinner } from './primitives'
import { post } from './context'
import { clipText, cx, firstLine, fmtDuration, fmtK, jp, pad2, relTime } from './format'
import { isReviewable, pendingLabel, resolveStatus, statusMeta } from './status'
import { fallbackEntries } from './timeline'
import type { TimelineEntry } from './timeline'

export function readLive(live: any) {
    if (!live) return null
    return {
      model: jp(live.modelSelection),
      cwd: jp(live.workingDirectory),
      pressure: jp(live.contextPressure),
      tokens: jp(live.tokenUsage),
      stats: jp(live.sessionStats),
      todos: jp(live.todos) || [],
      turns: jp(live.turnOutline) || [],
      meta: jp(live.sessionListMetadata),
      perms: jp(live.permissions),
    }
  }

export function modelLabel(model: any): string | null {
    if (!model) return null
    const pick = model.next || model.current
    if (!pick) return null
    if (typeof pick === 'string') return pick
    if (pick.provider && pick.model) return pick.provider + '/' + pick.model
    if (pick.model) return String(pick.model)
    return null
  }

export function LiveCard(props: { t: any; task: any; running: boolean | null; pendingKind?: string | null; live?: any; history?: any }) {
    const t = props.t
    const live = readLive(props.live)
    const logRef = React.useRef(null)
    const stickRef = React.useRef(true)
    React.useEffect(() => {
      const el: any = logRef.current
      if (el && stickRef.current) el.scrollTop = el.scrollHeight
    }, [props.history, props.live, props.task.sessionId])
    const stateLabel = props.pendingKind ? pendingLabel(t, props.pendingKind) : props.running ? t.sessionRunning : t.sessionIdle
    const stateTone = props.pendingKind ? 'warn' : props.running ? 'success' : 'neutral'

    const head = h(CardHead, {
      icon: 'terminal',
      title: t.liveSession,
      right: h('span', { className: cx('dshw-live-state', !props.pendingKind && !props.running && 'dshw-live-state--idle', props.pendingKind && 'dshw-live-state--pending') },
        h(Dot, { tone: stateTone, pulse: !!props.pendingKind }),
        stateLabel),
    })

    if (!props.task.sessionId) {
      return h(Card, null, head,
        h('div', { className: 'dshw-live-empty' },
          h('strong', null, t.noSession),
          t.noSessionHint))
    }

    const model = modelLabel(live && live.model)
    const tokens = live && live.tokens
    const stats = live && live.stats
    const pressure = live && live.pressure
    const todos = (live && live.todos) || []
    const pct = pressure && pressure.contextWindow
      ? Math.max(0, Math.min(100, Math.round(((pressure.projectedTokens || 0) / pressure.contextWindow) * 100)))
      : null

    const fromHistory = Array.isArray(props.history) ? props.history : null
    const entries: TimelineEntry[] = fromHistory && fromHistory.length
      ? fromHistory
      : fallbackEntries((live && live.turns) || [])
    const modelText = model || entries.find((entry) => entry.model)?.model || '—'
    const historySteps = new Set(entries.map((entry) => entry.stepKey).filter(Boolean)).size
    const statsText = stats
      ? String(t.liveStats).replace('{turns}', String(stats.turns || 0)).replace('{steps}', String(stats.steps || 0))
      : historySteps
        ? String(t.liveStepsOnly).replace('{steps}', String(historySteps))
        : '—'
    const toolTag = (name?: string) => {
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
    const durationLabel = (ms: number | undefined) => {
      const duration = fmtDuration(ms, t)
      return duration ? String(t.duration).replace('{s}', duration) : ''
    }
    const statusLabel = (status?: string) => (status === 'error' ? t.stepFailed : status === 'running' ? t.stepRunning : t.stepDone)

    const tokenText = tokens
      ? [fmtK(tokens.uncachedInputTokens) ? fmtK(tokens.uncachedInputTokens) + ' ' + t.liveTokensIn : '', fmtK(tokens.outputTokens) ? fmtK(tokens.outputTokens) + ' ' + t.liveTokensOut : ''].filter(Boolean).join(' · ')
      : ''

    return h(Card, null, head,
      h('div', { className: 'dshw-console' },
        h('div', { className: 'dshw-console-bar' },
          h(Dot, { tone: stateTone, pulse: !!props.pendingKind }),
          h('span', null, modelText),
          h('span', { className: 'dshw-sep' }, '/'),
          h('span', null, statsText),
          h('span', { className: 'dshw-grow' }),
          tokenText ? h('span', { className: 'dshw-tok' }, tokenText) : null),
        h('div', { className: 'dshw-console-grid' },
          h('div', {
            className: 'dshw-console-log',
            ref: logRef,
            onScroll: (e: any) => {
              const el = e.currentTarget
              stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32
            },
          },
            entries.length
              ? entries.map((entry, index) => {
                const tag = entry.kind === 'think' ? t.roleThinking : entry.kind === 'user' ? t.roleUser : entry.kind === 'agent' ? t.roleAssistant : toolTag(entry.tool)
                const title = entry.kind === 'think' ? (durationLabel(entry.durationMs) || firstLine(entry.detail)) : (entry.title || '—')
                const status = entry.kind === 'tool' ? statusLabel(entry.status) : ''
                const statusClass = entry.status === 'error' ? 'dshw-step-status--error' : entry.status === 'running' ? '' : 'dshw-step-status--ok'
                return h('details', { key: entry.id || index, className: 'dshw-step dshw-step--' + entry.kind },
                  h('summary', { className: 'dshw-step-head' },
                    h('span', { className: 'dshw-step-gutter' }, pad2(index + 1)),
                    h('span', { className: 'dshw-step-tag' }, tag),
                    h('span', { className: 'dshw-step-title', title: entry.detail ? clipText(entry.detail, 500) : title }, title),
                    entry.meta ? h('span', { className: 'dshw-step-meta' }, entry.meta) : null,
                    status ? h('span', { className: 'dshw-step-status ' + statusClass }, status) : null,
                    h(Icon, { name: 'chevronDown', className: 'dshw-step-chevron' })),
                  h('div', { className: 'dshw-step-body' }, entry.detail || '—'))
              })
              : h('div', { className: 'dshw-step' },
                h('div', { className: 'dshw-step-head' },
                  h('span', { className: 'dshw-step-gutter' }, '—'),
                  h('span', { className: 'dshw-step-title' }, t.noTurns)))),
          h('div', { className: 'dshw-console-side' },
            h('div', { className: 'dshw-side-block' },
              h('div', { className: 'dshw-side-title' }, t.liveTodos),
              todos.length
                ? h('ul', { className: 'dshw-todo-mini' }, todos.slice(0, 10).map((todo: any, i: number) => {
                  const done = todo.status === 'completed'
                  return h('li', { key: i, className: done ? 'dshw-done' : '' },
                    h(Icon, { name: done ? 'checkCircle' : 'circle' }),
                    h('span', null, String(todo.content)))
                }))
                : h('div', { className: 'dshw-hint', style: { color: 'var(--dshw-term-muted)' } }, '—')),
            h('div', { className: 'dshw-side-block' },
              h('div', { className: 'dshw-side-title' }, t.livePressure),
              h('div', { className: 'dshw-meter-row' },
                h('span', null, pct === null ? '—' : pct + '%'),
                h('span', null, tokens && fmtK(tokens.cacheReadTokens) ? fmtK(tokens.cacheReadTokens) + ' ' + t.liveTokensCache : '')),
              h('div', { className: 'dshw-meter' }, h('i', { style: { '--v': (pct === null ? 0 : pct) + '%' } })))))))
  }

export function TaskDetail(props: any) {
    const t = props.t
    const v = props.view
    const task = v.task
    const snap = v.snapshot
    const project = props.project
    const [busy, setBusy] = React.useState('')
    const [err, setErr] = React.useState('')
    const [mergeOpen, setMergeOpen] = React.useState(false)
    const [cleanupOpen, setCleanupOpen] = React.useState(false)
    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const [force, setForce] = React.useState(false)
    const [delBranch, setDelBranch] = React.useState(false)
    const actionRef = React.useRef(false)

    const effStatus = resolveStatus(snap.status, props.running)
    const meta = statusMeta(t, effStatus, props.pendingKind)
    const liveData = readLive(props.live)
    const modelText = modelLabel(liveData && liveData.model) || '—'
    const liveCwd = liveData && liveData.cwd ? String(liveData.cwd) : ''
    const cwdOff = !!liveCwd && !!task.worktreePath && liveCwd.toLowerCase() !== String(task.worktreePath).toLowerCase()
    const cleaned = snap.status === 'cleaned'
    const merged = snap.status === 'merged'
    const broken = snap.status === 'broken'
    const checkedOut = snap.status === 'reviewing'
    const dirty = snap.worktree.dirtyCount
    const repoDirty = snap.repo.dirtyCount
    const health = props.health
    const healthActive = !!health && !props.running
    const sessionBlank = !!(liveData && liveData.meta && (liveData.meta as any).blank === true)
    const canStart = sessionBlank && !props.running && !!props.onStartTask && !!task.sessionId
    const ahead = snap.worktree.ahead
    const branch = task.branch || snap.worktree.branch || ''

    const act = async (key: string, success: string, fn: () => Promise<any>): Promise<boolean> => {
      if (actionRef.current || busy) return false
      actionRef.current = true
      setBusy(key)
      setErr('')
      try {
        await fn()
        await props.onChanged()
        props.notify(success)
        return true
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
        return false
      } finally {
        actionRef.current = false
        setBusy('')
      }
    }
    const actPost = (key: string, path: string, body: any, success: string) =>
      act(key, success, () => post(path, Object.assign({ id: task.id }, body)))
    const busyLabel = (key: string, label: string, working: string) => (busy === key ? working : label)

    const primary = cleaned
      ? h(Btn, { variant: 'primary', size: 'lg', icon: 'trash', disabled: true }, t.cleaned)
      : canStart
        ? h(Btn, {
          variant: 'primary',
          size: 'lg',
          icon: busy === 'start' ? undefined : 'play',
          disabled: busy !== '',
          onClick: () => { void act('start', t.taskStarted, () => Promise.resolve(props.onStartTask())) },
        }, busy === 'start' ? h(Spinner) : null, busyLabel('start', t.startTask, t.startingTask))
        : task.sessionId
          ? h(Btn, {
            variant: 'primary',
            size: 'lg',
            icon: 'external',
            disabled: !props.onOpenSession,
            onClick: () => {
              const opened = props.onOpenSession && props.onOpenSession()
              if (opened === false) props.notify(t.openSessionFailed, 'error')
            },
          }, t.openSessionBtn)
          : h(Btn, {
            variant: 'primary',
            size: 'lg',
            icon: busy === 'session' ? undefined : 'message',
            disabled: !props.onCreateSession || busy !== '',
            onClick: () => {
              if (!props.onCreateSession) return
              void act('session', t.sessionCreated, () => Promise.resolve(props.onCreateSession()))
            },
          }, busy === 'session' ? h(Spinner) : null, busyLabel('session', t.createSession, t.creatingSession))

    const lastActivity = task.sessionId && task.updatedAt ? t.lastActivity + ' · ' + relTime(task.updatedAt, t) : ''

    const pendingNode = props.pendingKind
      ? h(Banner, {
        tone: 'warn',
        icon: 'clock',
        title: pendingLabel(t, props.pendingKind),
        actions: task.sessionId
          ? h(Btn, { size: 'sm', onClick: () => props.onOpenSession && props.onOpenSession() }, t.handlePending)
          : null,
      }, t.pendingHint)
      : null

    const errorNode = snap.error
      ? h(Banner, {
        tone: 'error',
        icon: 'alert',
        title: t.statusSyncFailed,
        actions: h(Btn, { size: 'sm', icon: 'refresh', onClick: () => void props.onChanged() }, t.retry),
      }, snap.error)
      : null

    const notStartedNode = canStart
      ? h(Banner, {
        tone: 'warn',
        icon: 'clock',
        title: t.taskNotStarted,
      }, t.taskNotStartedHint)
      : null

    const healthNode = healthActive
      ? h(Banner, {
        tone: health.kind === 'error' ? 'error' : 'warn',
        icon: 'alert',
        title: health.kind === 'error' ? t.sessionError : t.sessionInterrupted,
        actions: task.sessionId && props.onOpenSession
          ? h(Btn, { size: 'sm', onClick: () => props.onOpenSession && props.onOpenSession() }, t.handlePending)
          : null,
      }, health.message || (health.kind === 'error' ? t.sessionErrorHint : t.sessionInterruptedHint))
      : null

    const disabled = cleaned || merged
    // Acceptance ("switch to the task branch") is only meaningful once the task
    // is waiting for review. While the task is still developing (or not started),
    // switching the main repo branch would enter acceptance too early. Use the
    // session-aware status so a still-running session counts as in progress.
    const reviewable = isReviewable(effStatus)
    const checkoutDisabled = disabled || checkedOut || broken || dirty > 0 || repoDirty > 0 || !snap.worktree.exists || !reviewable
    // "Switch back" is only meaningful while the main repo is away from the recorded branch.
    const onOriginalBranch = !!task.originalBranch && snap.repo.currentBranch === task.originalBranch
    const backDisabled = !task.originalBranch || cleaned || merged || onOriginalBranch
    const mergeDisabled = disabled || dirty > 0 || ahead === 0 || !snap.worktree.exists
    const checkoutTitle = checkedOut
      ? t.onBranch
      : effStatus === 'developing'
        ? t.acceptanceHintDeveloping
        : effStatus === 'ready'
          ? t.acceptanceHintNotStarted
          : dirty > 0
            ? t.acceptanceHintDirty.replace('{n}', String(dirty))
            : repoDirty > 0
              ? t.acceptanceHintRepoDirty.replace('{n}', String(repoDirty))
              : broken
                ? t.acceptanceHintBroken
                : t.checkout
    const mergeTitle = ahead === 0 ? t.acceptanceHintNoAhead : dirty > 0 ? t.acceptanceHintDirty.replace('{n}', String(dirty)) : t.merge

    let acceptanceHint = t.acceptanceHintDefault
    if (cleaned) acceptanceHint = t.acceptanceHintClean
    else if (merged) acceptanceHint = t.acceptanceHintMerged
    else if (broken) acceptanceHint = t.acceptanceHintBroken
    else if (effStatus === 'developing') acceptanceHint = t.acceptanceHintDeveloping
    else if (effStatus === 'ready') acceptanceHint = t.acceptanceHintNotStarted
    else if (dirty > 0) acceptanceHint = t.acceptanceHintDirty.replace('{n}', String(dirty))
    else if (repoDirty > 0) acceptanceHint = t.acceptanceHintRepoDirty.replace('{n}', String(repoDirty))
    else if (ahead === 0) acceptanceHint = t.acceptanceHintNoAhead
    else if (checkedOut) acceptanceHint = t.acceptanceHintCheckedOut

    const worktreeState = cleaned
      ? { label: t.cleaned, tone: 'neutral' }
      : broken
        ? { label: t.broken, tone: 'error' }
        : merged
          ? { label: t.mergedFlag, tone: 'success' }
          : snap.worktree.exists
            ? { label: t.clean, tone: 'success' }
            : { label: t.branchMissing, tone: 'error' }

    const mergeModal = mergeOpen
      ? h(Modal, {
        t,
        title: String(t.mergeTitle).replace('{base}', task.baseBranch),
        subtitle: t.mergeSub,
        icon: 'merge',
        size: 'sm',
        busy: busy === 'merge',
        onClose: () => { if (busy !== 'merge') setMergeOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setMergeOpen(false), disabled: busy === 'merge', 'data-autofocus': true }, t.cancel),
          h(Btn, {
            key: 'ok',
            variant: 'primary',
            disabled: busy === 'merge' || dirty > 0,
            onClick: () => {
              void act('merge', String(t.mergeDone).replace('{base}', task.baseBranch), () => post('task/merge', { id: task.id }))
                .then((ok) => { if (ok) setMergeOpen(false) })
            },
          }, busy === 'merge' ? h(Spinner) : null, busy === 'merge' ? t.merging : t.mergeConfirm),
        ],
      },
        h('div', { className: 'dshw-info-table' },
          h(KV, { label: t.branchLabel }, h('span', { className: 'dshw-mono' }, branch)),
          h(KV, { label: t.baseBranch }, h('span', { className: 'dshw-mono' }, task.baseBranch)),
          h(KV, { label: t.commits }, String(ahead)),
          h(KV, { label: t.uncommitted }, dirty > 0 ? h(Chip, { tone: 'warn', small: true }, dirty + ' ' + t.changesUnit) : h('span', { className: 'dshw-hint', style: { margin: 0 } }, t.clean))),
        dirty > 0
          ? h(Banner, { tone: 'warn', icon: 'alert', title: t.mergeDirtyTitle }, t.mergeDirtyHint)
          : h(Banner, { tone: 'info', icon: 'info' }, t.mergeCleanHint),
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    const cleanupModal = cleanupOpen
      ? h(Modal, {
        t,
        title: t.cleanupTitle,
        subtitle: t.cleanupSub,
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: busy === 'cleanup',
        onClose: () => { if (busy !== 'cleanup') setCleanupOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setCleanupOpen(false), disabled: busy === 'cleanup', 'data-autofocus': true }, t.cancel),
          h(Btn, {
            key: 'ok',
            variant: 'danger',
            disabled: busy === 'cleanup',
            onClick: () => {
              void act('cleanup', delBranch ? t.cleanupDoneBranch : t.cleanupDone, () => post('task/cleanup', { id: task.id, force, deleteBranch: delBranch }))
                .then((ok) => { if (ok) setCleanupOpen(false) })
            },
          }, busy === 'cleanup' ? h(Spinner) : null, busy === 'cleanup' ? t.cleaning : t.cleanup),
        ],
      },
        h('div', { className: 'dshw-danger-list' },
          h('div', { className: 'dshw-danger-title' }, h(Icon, { name: 'alert' }), t.cleanupDangerTitle),
          h('div', { className: 'dshw-danger-item' }, h(Icon, { name: 'folder' }), h('span', null, task.worktreePath)),
          h('div', { className: 'dshw-danger-item' }, h(Icon, { name: 'file' }), h('span', null,
            dirty > 0 ? String(t.cleanupDirtyGone).replace('{n}', String(dirty)) : t.cleanupCleanNote))),
        h('label', { className: 'dshw-check' },
          h('input', {
            type: 'checkbox',
            checked: force,
            disabled: dirty === 0,
            'aria-label': t.force,
            'aria-describedby': 'dshw-cleanup-force-hint',
            onChange: (e: any) => setForce(e.target.checked),
          }),
          h('span', { className: 'dshw-check-copy' }, t.force, h('small', { id: 'dshw-cleanup-force-hint' }, t.cleanupForceHint))),
        h('label', { className: 'dshw-check' },
          h('input', {
            type: 'checkbox',
            checked: delBranch,
            'aria-label': t.deleteBranch,
            'aria-describedby': 'dshw-cleanup-branch-hint',
            onChange: (e: any) => setDelBranch(e.target.checked),
          }),
          h('span', { className: 'dshw-check-copy' }, t.deleteBranch, h('small', { id: 'dshw-cleanup-branch-hint' }, t.cleanupBranchHint))),
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    const deleteModal = deleteOpen
      ? h(Modal, {
        t,
        title: t.deleteTaskTitle,
        subtitle: task.title,
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: busy === 'delete',
        onClose: () => { if (busy !== 'delete') setDeleteOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setDeleteOpen(false), disabled: busy === 'delete', 'data-autofocus': true }, t.cancel),
          h(Btn, {
            key: 'ok',
            variant: 'danger',
            disabled: busy === 'delete',
            onClick: () => {
              void act('delete', t.recordDeleted, () => post('task/delete', { id: task.id }))
                .then((ok) => { if (ok) setDeleteOpen(false) })
            },
          }, busy === 'delete' ? h(Spinner) : null, busy === 'delete' ? t.deleting : t.deleteRecordConfirm),
        ],
      },
        h(Banner, { tone: 'error', icon: 'alert', title: t.deleteTaskWarning }, t.deleteTaskWarningHint),
        h('div', { className: 'dshw-info-table' },
          h(KV, { label: t.branchLabel }, h('span', { className: 'dshw-mono' }, branch)),
          cleaned
            ? null
            : h(KV, { label: t.worktree }, h('span', { className: 'dshw-mono' }, task.worktreePath)),
          h(KV, { label: t.status },
            h('span', { className: 'dshw-inline' },
              h(Chip, { tone: meta.tone, small: true }, meta.label),
              meta.note ? h(Chip, { tone: 'warn', small: true }, meta.note) : null))),
        h('div', { className: 'dshw-hint' }, t.deleteTaskHint),
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    return h('div', { className: 'dshw-detail-inner' },
      h('article', { className: 'dshw-card dshw-hero' },
        h('div', { className: 'dshw-hero-top' },
          h('div', { className: 'dshw-hero-copy' },
            h('div', { className: 'dshw-hero-crumb' },
              h(Icon, { name: 'folder' }),
              h('span', null, project ? project.name : task.repoPath),
              h('span', null, '/'),
              h('span', { className: 'dshw-mono' }, branch)),
            h('h1', null, task.title),
            h('p', { className: 'dshw-hero-desc' }, task.description || '—'),
            h('div', { className: 'dshw-hero-meta' },
              h(Chip, { tone: meta.tone }, meta.label),
              meta.note ? h(Chip, { tone: 'warn' }, meta.note) : null,
              healthActive
                ? h(Chip, { tone: health.kind === 'error' ? 'error' : 'warn' }, health.kind === 'error' ? t.sessionError : t.sessionInterrupted)
                : null,
              h('span', { className: 'dshw-meta-pill' }, h(Icon, { name: 'branch' }), h('span', { className: 'dshw-mono' }, branch)),
              h('span', { className: 'dshw-meta-pill' }, h(Icon, { name: 'arrowUp' }), ahead + ' ' + t.commitsAhead),
              dirty > 0
                ? h('span', { className: 'dshw-meta-pill dshw-meta-pill--warn' }, h(Icon, { name: 'alert' }), dirty + ' ' + t.dirty)
                : null)),
          h('div', { className: 'dshw-hero-action' },
            primary,
            h('span', { className: 'dshw-hint' }, lastActivity))),
        err ? h('div', { className: 'dshw-err', role: 'alert', style: { marginTop: '12px' } }, h(Icon, { name: 'alert' }), h('span', null, err)) : null),
      notStartedNode,
      pendingNode,
      healthNode,
      errorNode,
      h(LiveCard, { t, task, running: props.running, pendingKind: props.pendingKind, live: props.live, history: props.history }),
      h(Card, null,
        h(CardHead, {
          icon: 'message',
          title: t.sessionInfo,
          right: task.sessionId ? h(Chip, { tone: meta.tone, small: true }, meta.label) : h(Chip, { tone: 'neutral', small: true }, t.noSession),
        }),
        task.sessionId
          ? h('div', { className: 'dshw-kv' }, [
            h(KV, { key: 'sid', label: t.sessionId },
              h('span', { className: 'dshw-mono' }, task.sessionId),
              h(CopyBtn, { text: task.sessionId, label: t.copySessionId, t, notify: props.notify })),
            h(KV, { key: 'st', label: t.status },
              h('span', { className: 'dshw-inline' },
                h(Dot, { tone: props.pendingKind ? 'warn' : props.running ? 'brand' : 'neutral', pulse: !!props.pendingKind }),
                h('span', null, props.pendingKind ? pendingLabel(t, props.pendingKind) : props.running ? t.sessionRunning : t.sessionIdle))),
            h(KV, { key: 'model', label: t.liveModel }, h('span', null, modelText)),
            h(KV, { key: 'cwd', label: t.liveCwd },
              h('span', { className: 'dshw-mono' }, liveCwd || task.worktreePath),
              cwdOff ? h(Chip, { tone: 'warn', small: true }, t.liveCwdOff) : null,
              h(CopyBtn, { text: liveCwd || task.worktreePath, label: t.copyWorktree, t, notify: props.notify })),
            h(KV, { key: 'act', label: t.lastActivity }, h('span', null, relTime(task.updatedAt, t))),
          ])
          : h('div', { className: 'dshw-hint', style: { margin: 0 } }, t.noSessionHint)),
      h(Card, null,
        h(CardHead, {
          icon: 'checkCircle',
          title: t.acceptance,
          right: h('span', { className: 'dshw-hint', style: { margin: 0 } }, t.mainRepo + ' · ' + task.baseBranch),
        }),
        h('div', { className: 'dshw-action-grid' },
          h(Btn, {
            icon: 'branch',
            disabled: checkoutDisabled || busy !== '',
            title: checkoutTitle,
            onClick: () => void actPost('checkout', 'task/checkout', {}, t.checkout),
          }, busy === 'checkout' ? h(Spinner) : null, checkedOut ? t.onBranch : t.checkout),
          h(Btn, {
            icon: 'arrowLeft',
            disabled: backDisabled || busy !== '',
            onClick: () => void actPost('back', 'task/back', {}, t.back),
          }, busy === 'back' ? h(Spinner) : null, t.back),
          h(Btn, {
            icon: 'merge',
            disabled: mergeDisabled || busy !== '',
            title: mergeTitle,
            onClick: () => setMergeOpen(true),
          }, t.merge)),
        h('div', { className: 'dshw-hint' }, h(Icon, { name: 'info' }), acceptanceHint)),
      h(Card, null,
        h(CardHead, {
          icon: 'branch',
          title: t.worktree + ' / ' + t.mainRepo,
          right: h(Chip, { tone: worktreeState.tone, small: true }, worktreeState.label),
        }),
        h('div', { className: 'dshw-git-section' },
          h('div', { className: 'dshw-section-label' }, h(Icon, { name: 'folder' }), t.worktree),
          h('div', { className: 'dshw-kv' },
            h(KV, { label: t.path },
              h('span', { className: 'dshw-mono' }, task.worktreePath),
              h(CopyBtn, { text: task.worktreePath, label: t.copyWorktree, t, notify: props.notify })),
            cleaned
              ? h('div', { className: 'dshw-hint', style: { margin: 0 } }, t.worktreeRemovedHint)
              : [
                h(KV, { key: 'wt-branch', label: t.currentBranch },
                  h('span', { className: 'dshw-mono' }, snap.worktree.branch || '—'),
                  h(CopyBtn, { text: snap.worktree.branch || '', label: t.copyBranch, t, notify: props.notify })),
                h(KV, { key: 'wt-ahead', label: t.commits }, ahead + ' ' + t.commitsAhead),
                h(KV, { key: 'wt-dirty', label: t.uncommitted }, dirty > 0 ? h(Chip, { tone: 'warn', small: true }, dirty + ' ' + t.changesUnit) : h('span', { className: 'dshw-hint', style: { margin: 0 } }, t.clean)),
              ])),
        h('div', { className: 'dshw-git-section' },
          h('div', { className: 'dshw-section-label' }, h(Icon, { name: 'database' }), t.mainRepo),
          h('div', { className: 'dshw-kv' },
            h(KV, { label: t.repoPath },
              h('span', { className: 'dshw-mono' }, task.repoPath),
              h(CopyBtn, { text: task.repoPath, label: t.copyRepoPath, t, notify: props.notify })),
            h(KV, { label: t.currentBranch }, h('span', { className: 'dshw-mono' }, snap.repo.currentBranch || '—')),
            task.originalBranch ? h(KV, { label: t.originalBranch }, h('span', { className: 'dshw-mono' }, task.originalBranch)) : null,
            snap.repo.dirtyCount > 0
              ? h(KV, { label: t.uncommitted }, h(Chip, { tone: 'warn', small: true }, snap.repo.dirtyCount + ' ' + t.changesUnit))
              : null))),
      h(Card, { danger: true },
        h(CardHead, { icon: 'alert', title: t.dangerZone }),
        h('p', { className: 'dshw-card-sub' }, t.cleanupHint),
        h('div', { className: 'dshw-action-grid' },
          h(Btn, {
            variant: 'danger',
            icon: 'trash',
            disabled: cleaned || busy !== '',
            onClick: () => setCleanupOpen(true),
          }, cleaned ? t.cleaned : t.cleanup),
          h(Btn, {
            variant: 'danger',
            icon: 'xCircle',
            disabled: busy !== '',
            onClick: () => setDeleteOpen(true),
          }, t.deleteRecord))),
      mergeModal,
      cleanupModal,
      deleteModal)
  }


