import { React, h } from './ui'
import { Banner, Btn, Card, CardHead, Chip, CopyBtn, Dot, Icon, IconBtn, KV, Modal, Spinner } from './primitives'
import { appCtx, getJson, post, postLong } from './context'
import { clipText, cx, firstLine, fmtDuration, fmtK, jp, pad2, relTime, uuid } from './format'
import { pendingLabel, resolveStatus, statusMeta } from './status'
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

    // Live activity is the card's headline; only show it when a session exists,
    // so an unbound task is not misleadingly labelled "空闲".
    const head = h(CardHead, {
      icon: 'terminal',
      title: t.liveSession,
      right: props.task.sessionId
        ? h('span', { className: cx('dshw-live-state', !props.pendingKind && !props.running && 'dshw-live-state--idle', props.pendingKind && 'dshw-live-state--pending') },
          h(Dot, { tone: stateTone, pulse: !!props.pendingKind }),
          stateLabel)
        : null,
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

function diffStatusMeta(status: string): { letter: string; tone: string } {
  switch (status) {
    case 'added': return { letter: 'A', tone: 'success' }
    case 'deleted': return { letter: 'D', tone: 'error' }
    case 'renamed': return { letter: 'R', tone: 'purple' }
    case 'untracked': return { letter: 'U', tone: 'success' }
    default: return { letter: 'M', tone: 'warn' }
  }
}

/** Colour a raw unified-diff line like a terminal `git diff`. */
function diffLineKind(line: string): string {
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('diff --git ') || line.startsWith('index ') || line.startsWith('new file') ||
    line.startsWith('deleted file') || line.startsWith('rename ') || line.startsWith('similarity') ||
    line.startsWith('old mode') || line.startsWith('new mode') || line.startsWith('Binary files ') || line.startsWith('\\')) {
    return 'meta'
  }
  if (line.startsWith('+++ ') || line.startsWith('--- ')) return 'meta'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'del'
  return 'ctx'
}

/** Review-stage file list + per-file unified diff, fetched from `task/diff`. */
export function DiffCard(props: any) {
  const t = props.t
  const task = props.task
  const version = props.version
  const [data, setData] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [expanded, setExpanded] = React.useState({})
  const [tick, setTick] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getJson('task/diff?id=' + encodeURIComponent(task.id))
      .then((d: any) => {
        if (cancelled) return
        setData(d && d.diff ? d.diff : null)
        setLoading(false)
      })
      .catch((e: any) => {
        if (cancelled) return
        setError(String((e && e.message) || t.loadFailed))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [task.id, version, tick])

  const files: any[] = (data && Array.isArray(data.files)) ? data.files : []
  // Small change sets open by default so the reviewer sees the diff right away.
  React.useEffect(() => {
    if (!data) return
    if (files.length === 0 || files.length > 5) { setExpanded({}); return }
    const next: any = {}
    for (const file of files) next[file.path] = true
    setExpanded(next)
  }, [data])

  const allOpen = files.length > 0 && files.every((file: any) => expanded[file.path])
  const toggleAll = () => {
    if (allOpen) { setExpanded({}); return }
    const next: any = {}
    for (const file of files) next[file.path] = true
    setExpanded(next)
  }
  const toggle = (path: string) => setExpanded((prev: any) => Object.assign({}, prev, { [path]: !prev[path] }))
  const rawDiff = files.map((file: any) => file.patch).filter(Boolean).join('\n')

  const reasonText = () => {
    if (!data || !data.reason) return ''
    if (data.reason === 'worktree-missing') return String(t.diffUnavailable).replace('{reason}', t.diffReasonMissing)
    if (data.reason === 'no-merge-base') return String(t.diffUnavailable).replace('{reason}', t.diffReasonNoBase)
    return String(t.diffUnavailable).replace('{reason}', data.error || t.diffReasonError)
  }

  const summary = data
    ? h('span', { className: 'dshw-diff-summary' },
      h('span', null, String(t.diffFiles).replace('{n}', String(files.length))),
      h('span', { className: 'dshw-diff-add' }, '+' + (data.totalAdditions || 0)),
      h('span', { className: 'dshw-diff-del' }, '-' + (data.totalDeletions || 0)))
    : null

  const head = h(CardHead, {
    icon: 'file',
    title: t.changedFiles,
    right: h('span', { className: 'dshw-diff-tools' },
      summary,
      files.length ? h(Btn, { size: 'sm', onClick: toggleAll }, allOpen ? t.collapseAll : t.expandAll) : null,
      rawDiff ? h(CopyBtn, { text: rawDiff, label: t.copyDiff, t, notify: props.notify }) : null,
      h(IconBtn, { icon: 'refresh', label: t.refresh, disabled: loading, onClick: () => setTick((n: number) => n + 1) }, loading ? h(Spinner) : null)),
  })

  let body: any
  if (loading && !data) {
    body = h('div', { className: 'dshw-diff-status' }, h(Spinner), h('span', null, t.diffLoading))
  } else if (error) {
    body = h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, error))
  } else if (reasonText()) {
    body = h('div', { className: 'dshw-diff-status dshw-diff-status--muted' }, h(Icon, { name: 'info' }), h('span', null, reasonText()))
  } else if (!files.length) {
    body = h('div', { className: 'dshw-diff-status dshw-diff-status--muted' }, h(Icon, { name: 'checkCircle' }), h('span', null, t.diffEmpty))
  } else {
    body = [
      data && data.truncated ? h('div', { className: 'dshw-diff-trunc', key: 'trunc' }, h(Icon, { name: 'info' }), h('span', null, t.diffTruncated)) : null,
      h('div', { className: 'dshw-diff-list', key: 'list' }, files.map((file: any) => {
        const meta = diffStatusMeta(file.status)
        const open = !!expanded[file.path]
        const lines = String(file.patch || '').split('\n')
        const shown = lines.slice(0, 4000).map((line: string, i: number) =>
          h('span', { key: i, className: 'dshw-diff-line dshw-diff-line--' + diffLineKind(line) }, line === '' ? '\u00a0' : line))
        if (lines.length > 4000) shown.push(h('span', { key: 'more', className: 'dshw-diff-line dshw-diff-line--meta' }, '…'))
        return h('div', { key: file.path, className: 'dshw-diff-file' },
          h('button', {
            type: 'button',
            className: 'dshw-diff-file-head',
            'aria-expanded': open,
            onClick: () => toggle(file.path),
          },
            h(Chip, { tone: meta.tone, small: true, className: 'dshw-diff-badge' }, meta.letter),
            h('span', { className: 'dshw-diff-path', title: file.path },
              h('span', { className: 'dshw-mono' }, file.path),
              file.oldPath ? h('span', { className: 'dshw-diff-old' }, ' ← ' + file.oldPath) : null),
            h('span', { className: 'dshw-diff-stat' },
              file.binary
                ? h('span', { className: 'dshw-diff-binary' }, t.diffBinary)
                : [h('span', { key: 'a', className: 'dshw-diff-add' }, '+' + (file.additions || 0)),
                  h('span', { key: 'd', className: 'dshw-diff-del' }, '-' + (file.deletions || 0))]),
            h(Icon, { name: 'chevronDown', className: 'dshw-diff-chevron' })),
          open ? h('pre', { className: 'dshw-diff-patch' }, shown) : null)
      }))]
  }

  return h(Card, { className: 'dshw-diff-card' }, head, h('div', { className: 'dshw-diff-body' }, body))
}

export function TaskDetail(props: any) {
    const t = props.t
    const v = props.view
    const task = v.task
    const snap = v.snapshot
    const project = props.project
    const [busy, setBusy] = React.useState('')
    const [err, setErr] = React.useState('')
    const acceptanceItems: string[] = Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : []
    const [mergeOpen, setMergeOpen] = React.useState(false)
    const [mergeSwitch, setMergeSwitch] = React.useState(false)
    const [mergeRestore, setMergeRestore] = React.useState(true)
    const [switchOpen, setSwitchOpen] = React.useState(false)
    const [switchAction, setSwitchAction] = React.useState('checkout' as 'checkout' | 'back')
    const [switchPre, setSwitchPre] = React.useState(null as any)
    const [switchBusy, setSwitchBusy] = React.useState('')
    const [cleanupOpen, setCleanupOpen] = React.useState(false)
    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const [force, setForce] = React.useState(false)
    const [delBranch, setDelBranch] = React.useState(false)
    const actionRef = React.useRef(false)
    const remotes = appCtx && appCtx.remote
    const [preview, setPreview] = React.useState(null)
    const [previewBusy, setPreviewBusy] = React.useState(false)
    const [syncBusy, setSyncBusy] = React.useState(false)
    const previewRef = React.useRef(false)

    const loadPreview = React.useCallback(async () => {
      if (previewRef.current) return
      previewRef.current = true
      setPreviewBusy(true)
      try {
        const result = await post('task/merge-preview', { id: task.id })
        setPreview(result.preview || null)
      } catch {
        /* the dry run is best-effort */
      } finally {
        previewRef.current = false
        setPreviewBusy(false)
      }
    }, [task.id])

    React.useEffect(() => {
      setPreview(null)
      void loadPreview()
      const timer = setInterval(() => {
        if (!document.hidden) void loadPreview()
      }, 15000)
      return () => clearInterval(timer)
    }, [loadPreview])

    React.useEffect(() => {
      setMergeOpen(false)
      setMergeSwitch(false)
      setMergeRestore(true)
    }, [task.id])

    const effStatus = resolveStatus(snap.status, props.running)
    const meta = statusMeta(t, effStatus, props.pendingKind)
    const liveData = readLive(props.live)
    const liveCwd = liveData && liveData.cwd ? String(liveData.cwd) : ''
    const cwdOff = !!liveCwd && !!task.worktreePath && liveCwd.toLowerCase() !== String(task.worktreePath).toLowerCase()
    const cleaned = snap.status === 'cleaned'
    const merged = snap.status === 'merged'
    const archived = !!task.archivedAt
    // Only finished tasks can be archived; a task under development should not
    // vanish from the sidebar.
    const canArchive = merged || cleaned
    const postMerge = snap.postMergeAhead || 0
    // A task that was merged through the workbench can spawn a follow-up task.
    const continued = !!task.mergedAt && (merged || cleaned)
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
    // The review-only diff card: shown while the task is waiting for acceptance
    // (or being reviewed on the main repo), where "what changed" matters most.
    const effectiveStatus = resolveStatus(snap.status, props.running)
    const showDiff = !cleaned && !broken && (effectiveStatus === 'review' || effectiveStatus === 'reviewing' || postMerge > 0)
    const diffVersion = [snap.worktree.ahead, snap.worktree.dirtyCount, snap.worktree.lastCommitAt || 0, snap.status].join(':')

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
        // A slow git hook may have let the request time out after the work
        // actually succeeded; reconcile the board instead of leaving stale rows.
        try { void Promise.resolve(props.onChanged()).catch(() => {}) } catch { /* noop */ }
        return false
      } finally {
        actionRef.current = false
        setBusy('')
      }
    }
    const actPost = (key: string, path: string, body: any, success: string) =>
      act(key, success, () => postLong(path, Object.assign({ id: task.id }, body)))

    const executeSwitch = async (action: 'checkout' | 'back', strategy: string | undefined, pre: any): Promise<boolean> => {
      const path = action === 'checkout' ? 'task/checkout' : 'task/back'
      const ok = await act(action, action === 'checkout' ? t.checkout : t.back, () => postLong(path, {
        id: task.id,
        strategy,
        expectedSha: pre && pre.targetSha ? pre.targetSha : undefined,
      }))
      if (ok) setSwitchOpen(false)
      return ok
    }

    const runSwitch = async (action: 'checkout' | 'back') => {
      if (actionRef.current || switchBusy) return
      setSwitchBusy(action)
      setErr('')
      try {
        const r = await post(action === 'checkout' ? 'task/checkout-preflight' : 'task/back-preflight', { id: task.id })
        const pre = r && r.preflight
        if (!pre) throw new Error(t.failed)
        if (pre.safe) {
          await executeSwitch(action, undefined, pre)
        } else {
          setSwitchAction(action)
          setSwitchPre(pre)
          setSwitchOpen(true)
        }
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
        try { void Promise.resolve(props.onChanged()).catch(() => {}) } catch { /* noop */ }
      } finally {
        setSwitchBusy('')
      }
    }
    const busyLabel = (key: string, label: string, working: string) => (busy === key ? working : label)

    const syncBaseline = async () => {
      if (syncBusy) return
      if (!task.sessionId) {
        props.notify(t.syncNoSession, 'error')
        return
      }
      if (!remotes || !remotes.session) {
        props.notify(t.failed, 'error')
        return
      }
      setSyncBusy(true)
      try {
        const files = (preview && (preview.conflictFiles?.length ? preview.conflictFiles : preview.overlapFiles)) || []
        const fileText = files.length ? files.join('、') : '—'
        const text = String(t.syncPrompt)
          .replace('{base}', task.baseBranch)
          .replace('{branch}', task.branch)
          .replace('{files}', fileText)
        const tz = (() => {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
          } catch {
            return ''
          }
        })()
        const sent = await remotes.session.prompt({
          requestId: uuid(),
          sessionId: task.sessionId,
          mode: 'queue',
          content: [{ type: 'text', text }],
          ...(tz ? { clientTimeZone: tz } : {}),
        })
        if (sent && sent.ok === false) {
          throw new Error((sent.error && (sent.error.message || sent.error.code)) || t.failed)
        }
        props.notify(t.syncPromptSent)
      } catch (error: any) {
        props.notify((error && error.message) || t.failed, 'error')
      } finally {
        setSyncBusy(false)
      }
    }

    const previewRisk = !cleaned && !merged && !!(preview && preview.applicable && preview.baseAhead > 0)
    const previewFiles: string[] = preview
      ? (preview.conflict && Array.isArray(preview.conflictFiles) && preview.conflictFiles.length
        ? preview.conflictFiles
        : preview.overlapFiles || [])
      : []
    const previewFilesText = previewFiles.slice(0, 8).join('、') + (previewFiles.length > 8 ? '…' : '')
    const previewChip = previewRisk
      ? preview.conflict
        ? { tone: 'error', label: String(t.mergePreviewConflict).replace('{n}', String(Math.max(1, previewFiles.length))) }
        : previewFiles.length
          ? { tone: 'warn', label: String(t.mergePreviewOverlap).replace('{n}', String(previewFiles.length)) }
          : { tone: 'neutral', label: String(t.mergePreviewBaseAhead).replace('{n}', String(preview.baseAhead)) }
      : null
    const syncAction = h(Btn, {
      size: 'sm',
      icon: 'refresh',
      disabled: syncBusy || busy !== '' || !task.sessionId,
      title: task.sessionId ? undefined : t.syncNoSession,
      onClick: () => void syncBaseline(),
    }, syncBusy ? t.syncingBaseline : t.syncBaseline)
    const previewNode = previewRisk && (preview.conflict || previewFiles.length)
      ? h(Banner, {
        tone: preview.conflict ? 'error' : 'warn',
        icon: 'alert',
        title: preview.conflict ? t.mergePreviewConflictTitle : t.mergePreviewOverlapTitle,
        actions: syncAction,
      },
        h('div', null, preview.conflict ? t.mergePreviewConflictHint : t.mergePreviewOverlapHint),
        previewFiles.length ? h('div', { className: 'dshw-hint' }, t.mergePreviewFiles + '：' + previewFilesText) : null,
        preview.supported === false || preview.checked === false ? h('div', { className: 'dshw-hint' }, t.mergePreviewNoCheck) : null)
      : null

    // Merged, but the old branch picked up commits after the merge: offer the
    // light patch path (merge again) or a clean follow-up task (carry commits in).
    const postMergeNode = postMerge > 0
      ? h(Banner, {
        tone: 'warn',
        icon: 'clock',
        title: String(t.postMergeTitle).replace('{n}', String(postMerge)),
        actions: h('div', { className: 'dshw-inline', style: { gap: '8px', flexWrap: 'wrap' } },
          h(Btn, {
            size: 'sm',
            icon: 'merge',
            disabled: busy !== '',
            onClick: () => { setPreview(null); setMergeSwitch(!curOnBase); setMergeRestore(true); setMergeOpen(true); void loadPreview() },
          }, t.mergeAgain),
          // "继续任务" is already the hero primary action on a continued task,
          // so only surface it here for the rare task whose hero cannot.
          props.onContinue && !continued
            ? h(Btn, {
              size: 'sm',
              variant: 'primary',
              icon: 'plus',
              disabled: busy !== '',
              onClick: () => props.onContinue(),
            }, t.continueTask)
            : null),
      }, String(t.postMergeHint).replace('{n}', String(postMerge)))
      : null

    const primary = continued && props.onContinue
      ? h(Btn, {
        variant: 'primary',
        size: 'lg',
        icon: 'plus',
        disabled: busy !== '',
        onClick: () => props.onContinue(),
      }, t.continueTask)
      : cleaned
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

    // On a merged/cleaned task the continue action is primary; keep "open session"
    // available as a secondary action for reviewing history.
    const secondaryOpen = continued && task.sessionId && props.onOpenSession
      ? h(Btn, {
        size: 'lg',
        icon: 'external',
        disabled: busy !== '',
        onClick: () => {
          const opened = props.onOpenSession && props.onOpenSession()
          if (opened === false) props.notify(t.openSessionFailed, 'error')
        },
      }, t.openSessionBtn)
      : null

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

    // ---- Acceptance actions: visibility + blocking reasons ----
    // Every action mutates the main repo, so we gate on three things: the task
    // lifecycle, whether the main repo can safely switch/merge, and whether the
    // agent is still writing. The backend repeats every git-level check.
    const onTaskBranch = (!!task.reviewSha && !!snap.repo.headSha && task.reviewSha === snap.repo.headSha) || (!!branch && snap.repo.currentBranch === branch)
    const curOnBase = !!task.baseBranch && snap.repo.currentBranch === task.baseBranch
    const inProgress = snap.repo.inProgress || null
    const originalBranchExists = !!task.originalBranch && (snap.repo.originalBranchExists === undefined ? true : snap.repo.originalBranchExists)
    const siblings = Array.isArray(props.siblings) ? props.siblings : []
    const otherReviewing = onTaskBranch
      ? null
      : siblings.find((v: any) => v.task && !v.task.cleanedAt && (
        (v.task.branch && v.task.branch === snap.repo.currentBranch) ||
        (v.task.reviewSha && snap.repo.headSha && v.task.reviewSha === snap.repo.headSha)
      )) || null
    const agentRunning = props.running === true
    const repoLockLabel = props.repoLockLabel || ''
    const conflictNow = !!(preview && preview.conflict)
    // A merge is only allowed after the dry-run proved it conflict-free. While
    // the preview is loading/failed/unsupported the button stays disabled, so a
    // known conflict can never reach the actual merge step.
    const previewReadyForMerge = !!preview && preview.applicable !== false && preview.supported !== false && preview.checked !== false && !conflictNow && !previewBusy

    const showBack = onTaskBranch
    const showCheckout = !onTaskBranch && snap.status !== 'cleaned'
    const showMerge = snap.status !== 'merged' && snap.status !== 'cleaned'
    const mergeBaseReady = showMerge && !onTaskBranch && snap.status === 'review' && ahead > 0 && dirty === 0 && repoDirty === 0 && !inProgress && !agentRunning && !repoLockLabel && previewReadyForMerge && !otherReviewing
    const mergeEnabled = mergeBaseReady && curOnBase
    const canSwitchToBase = mergeBaseReady && !curOnBase && !!snap.repo.currentBranch
    const mergeAgainReady = postMerge > 0 && !onTaskBranch && dirty === 0 && repoDirty === 0 && !inProgress && !agentRunning && !repoLockLabel && previewReadyForMerge

    type AcceptReason = { text: string; action?: any; key?: string }
    // "打开会话" lives in the hero action area; blockers below only explain why
    // an acceptance action is unavailable, so they must not repeat that button.
    const goOtherAction = otherReviewing && props.onSelectTask
      ? h(Btn, { size: 'sm', onClick: () => props.onSelectTask(otherReviewing.task.id) }, t.acceptReviewOther)
      : null

    const checkoutReasons: AcceptReason[] = []
    if (showCheckout) {
      if (repoLockLabel) checkoutReasons.push({ text: String(t.acceptBusy).replace('{action}', repoLockLabel) })
      else if (snap.status === 'merged') checkoutReasons.push({ text: t.acceptanceHintMerged })
      else if (snap.status === 'broken') checkoutReasons.push({ text: snap.error || t.acceptanceHintBroken })
      else if (snap.status !== 'review') checkoutReasons.push({ text: t.acceptNoCommits })
      else if (ahead === 0) checkoutReasons.push({ text: dirty > 0 ? String(t.acceptWorktreeDirtyCommit).replace('{n}', String(dirty)) : t.acceptNoCommits })
      else {
        if (dirty > 0) checkoutReasons.push({ text: String(t.acceptWorktreeDirtyCommit).replace('{n}', String(dirty)), key: 'wt-dirty' })
        if (inProgress) checkoutReasons.push({ text: t.acceptInProgress })
        if (otherReviewing) checkoutReasons.push({ text: String(t.acceptOtherReviewing).replace('{task}', otherReviewing.task.title), action: goOtherAction })
        if (agentRunning) checkoutReasons.push({ text: t.acceptAgentRunning })
      }
    }
    const checkoutEnabled = showCheckout && checkoutReasons.length === 0

    const backReasons: AcceptReason[] = []
    if (showBack) {
      if (repoLockLabel) backReasons.push({ text: String(t.acceptBusy).replace('{action}', repoLockLabel) })
      if (inProgress) backReasons.push({ text: t.acceptInProgress })
    }
    const backEnabled = showBack && backReasons.length === 0

    const mergeReasons: AcceptReason[] = []
    if (showMerge) {
      if (repoLockLabel) mergeReasons.push({ text: String(t.acceptBusy).replace('{action}', repoLockLabel) })
      else if (snap.status === 'broken') mergeReasons.push({ text: snap.error || t.acceptanceHintBroken })
      else if (onTaskBranch) mergeReasons.push({ text: t.acceptMergeReviewing })
      else if (snap.status !== 'review' || ahead === 0) mergeReasons.push({ text: t.acceptNoCommits })
      else {
        if (dirty > 0) mergeReasons.push({ text: String(t.acceptanceHintDirty).replace('{n}', String(dirty)), key: 'wt-dirty' })
        if (!curOnBase && !canSwitchToBase) mergeReasons.push({ text: String(t.acceptNotOnBase).replace('{branch}', snap.repo.currentBranch || '—') })
        if (repoDirty > 0) mergeReasons.push({ text: String(t.acceptanceHintRepoDirty).replace('{n}', String(repoDirty)) })
        if (inProgress) mergeReasons.push({ text: t.acceptInProgress })
        if (agentRunning) mergeReasons.push({ text: t.acceptAgentRunning })
        if (conflictNow) mergeReasons.push({ text: t.mergePreviewConflictHint, action: syncAction })
        else if (previewBusy || !preview) mergeReasons.push({ text: t.mergePreviewChecking })
        else if (preview.supported === false || preview.checked === false) mergeReasons.push({ text: t.mergePrecheckBlocked })
      }
    }
    const mergeModalReady = postMerge > 0 ? mergeAgainReady : (curOnBase ? mergeEnabled : canSwitchToBase)

    const reasonsNode = (() => {
      const list: AcceptReason[] = []
      const seen = new Set<string>()
      // Collapse reasons that repeat the same fact (e.g. dirty worktree blocks
      // both checkout and merge) into one line.
      const push = (r: AcceptReason) => { const k = r && (r.key || r.text); if (r && r.text && k && !seen.has(k)) { seen.add(k); list.push(r) } }
      if (showCheckout) checkoutReasons.forEach(push)
      if (showBack) backReasons.forEach(push)
      if (showMerge) mergeReasons.forEach(push)
      // All good: the buttons speak for themselves, no need to explain the rules.
      if (!list.length) return null
      return h('div', { className: 'dshw-accept-reasons' }, list.map((r, i) => h('div', {
        key: i,
        className: 'dshw-hint',
        role: 'status',
        style: { margin: '0 0 6px', alignItems: 'center', flexWrap: 'wrap' },
      }, h(Icon, { name: 'info' }), h('span', null, r.text), r.action ? r.action : null)))
    })()
    // Nothing to accept (e.g. cleaned): drop the whole section instead of
    // leaving an empty card behind.
    const hasAcceptActions = showCheckout || showBack || showMerge

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
            disabled: busy === 'merge' || dirty > 0 || agentRunning || !mergeModalReady,
            title: preview && preview.conflict ? t.mergePreviewConflictHint : undefined,
            onClick: () => {
              props.onRepoBusy && props.onRepoBusy(true, t.merging)
              void act('merge', String(t.mergeDone).replace('{base}', task.baseBranch), () => postLong('task/merge', {
                id: task.id,
                switchToBase: mergeSwitch && !curOnBase,
                restoreTo: mergeRestore,
                expectedTip: preview && preview.expectedTip ? preview.expectedTip : undefined,
                expectedBase: preview && preview.expectedBase ? preview.expectedBase : undefined,
              }))
                .then((ok) => { if (ok) setMergeOpen(false) })
                .finally(() => { props.onRepoBusy && props.onRepoBusy(false, '') })
            },
          }, busy === 'merge' ? h(Spinner) : null, busy === 'merge' ? t.merging : t.mergeConfirm),
        ],
      },
        h('div', { className: 'dshw-info-table' },
          h(KV, { label: t.branchLabel }, h('span', { className: 'dshw-mono' }, branch)),
          h(KV, { label: t.baseBranch }, h('span', { className: 'dshw-mono' }, task.baseBranch)),
          h(KV, { label: t.commits }, String(ahead)),
          h(KV, { label: t.uncommitted }, dirty > 0 ? h(Chip, { tone: 'warn', small: true }, dirty + ' ' + t.changesUnit) : h('span', { className: 'dshw-hint', style: { margin: 0 } }, t.clean))),
        mergeSwitch && !curOnBase
          ? h(Banner, {
            tone: 'info',
            icon: 'branch',
            title: String(t.mergeSwitchNotice).replace('{branch}', snap.repo.currentBranch || '—').replace('{base}', task.baseBranch),
          })
          : null,
        mergeSwitch && !curOnBase
          ? h('label', { className: 'dshw-check', style: { marginTop: '10px' } },
            h('input', { type: 'checkbox', checked: mergeRestore, onChange: (e: any) => setMergeRestore(e.target.checked) }),
            h('span', { className: 'dshw-check-copy' }, String(t.mergeRestoreAfter).replace('{branch}', snap.repo.currentBranch || '—')))
          : null,
        acceptanceItems.length
          ? h('div', { className: 'dshw-merge-criteria' },
            h('div', { className: 'dshw-merge-criteria-title' }, h(Icon, { name: 'checkCircle' }), t.acceptanceCriteria),
            h('ul', null, acceptanceItems.map((item: string, i: number) => h('li', { key: i }, item))))
          : null,
        previewBusy ? h('div', { className: 'dshw-hint' }, h(Spinner), t.mergePreviewChecking) : null,
        previewRisk
          ? h(Banner, {
            tone: preview.conflict ? 'error' : previewFiles.length ? 'warn' : 'info',
            icon: preview.conflict ? 'alert' : 'info',
            title: preview.conflict
              ? t.mergePreviewConflictTitle
              : previewFiles.length
                ? t.mergePreviewOverlapTitle
                : String(t.mergePreviewBaseAhead).replace('{n}', String(preview.baseAhead)),
            actions: previewFiles.length ? syncAction : null,
          },
            previewFiles.length ? h('div', null, preview.conflict ? t.mergePreviewConflictHint : t.mergePreviewOverlapHint) : null,
            previewFiles.length ? h('div', { className: 'dshw-hint' }, t.mergePreviewFiles + '：' + previewFilesText) : null,
            preview.supported === false || preview.checked === false ? h('div', { className: 'dshw-hint' }, t.mergePreviewNoCheck) : null)
          : null,
        !curOnBase ? h(Banner, { tone: 'warn', icon: 'alert', title: String(t.acceptNotOnBase).replace('{branch}', snap.repo.currentBranch || '—') }) : null,
        agentRunning ? h(Banner, { tone: 'warn', icon: 'clock', title: t.acceptAgentRunning }) : null,
        dirty > 0
          ? h(Banner, { tone: 'warn', icon: 'alert', title: t.mergeDirtyTitle }, t.mergeDirtyHint)
          : null,
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    const switchModal = switchOpen && switchPre
      ? h(Modal, {
        t,
        title: switchAction === 'checkout' ? t.checkout : t.back,
        subtitle: t.switchConflictSub,
        icon: 'alert',
        tone: 'warn',
        size: 'sm',
        busy: busy === 'checkout' || busy === 'back',
        onClose: () => { if (busy !== 'checkout' && busy !== 'back') setSwitchOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setSwitchOpen(false), disabled: busy === 'checkout' || busy === 'back', 'data-autofocus': true }, t.cancel),
          h(Btn, {
            key: 'stash',
            variant: 'primary',
            disabled: busy === 'checkout' || busy === 'back',
            onClick: () => void executeSwitch(switchAction, 'stash', switchPre),
          }, (busy === 'checkout' || busy === 'back') ? h(Spinner) : null, t.switchStash),
          h(Btn, {
            key: 'discard',
            variant: 'danger',
            disabled: busy === 'checkout' || busy === 'back',
            onClick: () => void executeSwitch(switchAction, 'discard', switchPre),
          }, t.switchDiscard),
        ],
      },
        h('div', { className: 'dshw-switch-warn' }, String(t.switchConflictHint).replace('{n}', String((switchPre.obstacles || []).length))),
        h('ul', { className: 'dshw-switch-files' }, (switchPre.obstacles || []).map((o: any, i: number) =>
          h('li', { key: i }, h('span', { className: 'dshw-mono' }, o.path),
            o.kind === 'untracked' ? h(Chip, { tone: 'warn', small: true }, t.switchUntracked) : null))),
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
              void act('cleanup', delBranch ? t.cleanupDoneBranch : t.cleanupDone, () => postLong('task/cleanup', { id: task.id, force, deleteBranch: delBranch }))
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

    const parentView = props.parentView
    const followUps = Array.isArray(props.followUps) ? props.followUps : []
    const relationChip = (status: string) => {
      const m = statusMeta(t, status)
      return h(Chip, { tone: m.tone, small: true }, m.label)
    }
    const linkTo = (view: any) => () => { if (props.onSelectTask) props.onSelectTask(view.task.id) }
    const relationsNode = parentView || followUps.length
      ? h(Card, null,
        h(CardHead, { icon: 'branch', title: t.relatedTasks }),
        h('div', { className: 'dshw-kv' },
          parentView
            ? h(KV, { key: 'parent', label: t.parentTask },
              h('span', { className: 'dshw-inline', style: { gap: '8px', flexWrap: 'wrap' } },
                h('button', { type: 'button', className: 'dshw-link-btn', onClick: linkTo(parentView) }, parentView.task.title),
                relationChip(parentView.snapshot.status)))
            : null,
          followUps.length
            ? h(KV, { key: 'follow', label: t.followUps },
              h('span', { className: 'dshw-inline', style: { gap: '8px', flexWrap: 'wrap' } },
                followUps.map((fv: any) => h('button', { key: fv.task.id, type: 'button', className: 'dshw-link-btn', onClick: linkTo(fv) },
                  fv.task.title, ' ', relationChip(fv.snapshot.status)))))
            : null))
      : null

    const acceptanceNode = acceptanceItems.length
      ? h(Card, { className: 'dshw-acceptance-card' },
        h(CardHead, { icon: 'checkCircle', title: t.acceptanceCriteria }),
        h('ul', { className: 'dshw-acceptance-list' }, acceptanceItems.map((item: string, i: number) =>
          h('li', { key: i }, h(Icon, { name: 'check' }), h('span', null, item)))))
      : null

    const stashNode = task.reviewStash
      ? h(Card, { className: 'dshw-stash-card' },
        h(CardHead, { icon: 'archive', title: t.reviewStashTitle }),
        h('div', { className: 'dshw-hint', style: { marginBottom: '8px' } }, String(t.reviewStashNotice).replace('{ref}', task.reviewStash)),
        h('div', { className: 'dshw-action-grid' },
          h(Btn, { icon: 'archiveRestore', disabled: busy !== '', onClick: () => void act('stash-apply', t.reviewStashApplied, () => post('task/stash', { id: task.id, action: 'apply' })) }, t.reviewStashApply),
          h(Btn, { variant: 'danger', icon: 'trash', disabled: busy !== '', onClick: () => void act('stash-drop', t.reviewStashDropped, () => post('task/stash', { id: task.id, action: 'drop' })) }, t.reviewStashDrop)))
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
            task.description ? h('p', { className: 'dshw-hero-desc' }, task.description) : null,
            h('div', { className: 'dshw-hero-meta' },
              h(Chip, { tone: meta.tone }, meta.label),
              meta.note ? h(Chip, { tone: 'warn' }, meta.note) : null,
              archived ? h(Chip, { tone: 'neutral' }, t.archived) : null,
              // Health, merge-preview and post-merge each get their own banner
              // below; surface the base-advanced hint only when no banner covers it.
              previewChip && !previewNode ? h(Chip, { tone: previewChip.tone }, previewChip.label) : null,
              ahead > 0 ? h('span', { className: 'dshw-meta-pill' }, h(Icon, { name: 'arrowUp' }), ahead + ' ' + t.commitsAhead) : null,
              dirty > 0
                ? h('span', { className: 'dshw-meta-pill dshw-meta-pill--warn' }, h(Icon, { name: 'alert' }), dirty + ' ' + t.dirty)
                : null)),
          h('div', { className: 'dshw-hero-action' },
            h('div', { className: 'dshw-inline', style: { gap: '8px', flexWrap: 'wrap' } }, primary, secondaryOpen),
            h('span', { className: 'dshw-hint' }, lastActivity))),
        err ? h('div', { className: 'dshw-err', role: 'alert', style: { marginTop: '12px' } }, h(Icon, { name: 'alert' }), h('span', null, err)) : null),
      acceptanceNode,
      stashNode,
      notStartedNode,
      pendingNode,
      healthNode,
      previewNode,
      postMergeNode,
      errorNode,
      relationsNode,
      h(LiveCard, { t, task, running: props.running, pendingKind: props.pendingKind, live: props.live, history: props.history }),
      showDiff ? h(DiffCard, { t, task, version: diffVersion, notify: props.notify }) : null,
      // Session identity is the only thing this card adds over the live console;
      // status, model and last activity already appear on the hero / live card.
      task.sessionId ? h(Card, null,
        h(CardHead, { icon: 'message', title: t.sessionInfo }),
        h('div', { className: 'dshw-kv' }, [
          h(KV, { key: 'sid', label: t.sessionId },
            h('span', { className: 'dshw-mono' }, task.sessionId),
            h(CopyBtn, { text: task.sessionId, label: t.copySessionId, t, notify: props.notify })),
          h(KV, { key: 'cwd', label: t.liveCwd },
            h('span', { className: 'dshw-mono' }, liveCwd || task.worktreePath),
            cwdOff ? h(Chip, { tone: 'warn', small: true }, t.liveCwdOff) : null,
            h(CopyBtn, { text: liveCwd || task.worktreePath, label: t.copyWorktree, t, notify: props.notify })),
        ])) : null,
      hasAcceptActions ? h(Card, null,
        h(CardHead, {
          icon: 'checkCircle',
          title: t.acceptance,
          right: h('span', { className: 'dshw-hint', style: { margin: 0 } }, t.mainRepo + ' · ' + task.baseBranch),
        }),
        h('div', { className: 'dshw-action-grid' },
          showCheckout ? h(Btn, {
            icon: 'branch',
            disabled: !checkoutEnabled || busy !== '' || switchBusy !== '',
            onClick: () => { void runSwitch('checkout') },
          }, (busy === 'checkout' || switchBusy === 'checkout') ? h(Spinner) : null, t.checkout) : null,
          showBack ? h(Btn, {
            icon: 'arrowLeft',
            disabled: !backEnabled || busy !== '' || switchBusy !== '',
            onClick: () => { void runSwitch('back') },
          }, (busy === 'back' || switchBusy === 'back') ? h(Spinner) : null, originalBranchExists ? t.back : t.switchToBase) : null,
          showMerge ? h(Btn, {
            icon: 'merge',
            disabled: !(curOnBase ? mergeEnabled : canSwitchToBase) || busy !== '',
            onClick: () => {
              setPreview(null)
              setMergeSwitch(!curOnBase)
              setMergeRestore(true)
              setMergeOpen(true)
              void loadPreview()
            },
          }, busy === 'merge' ? h(Spinner) : null, curOnBase ? t.merge : t.mergeSwitchToBase) : null),
        reasonsNode) : null,
      h(Card, null,
        h(CardHead, {
          icon: 'branch',
          title: t.worktree + ' / ' + t.mainRepo,
          right: worktreeState.tone === 'error' ? h(Chip, { tone: 'error', small: true }, worktreeState.label) : null,
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
      canArchive
        ? h(Card, null,
          h(CardHead, {
            icon: 'archive',
            title: t.archiveSection,
            right: archived ? h(Chip, { tone: 'neutral', small: true }, t.archived) : null,
          }),
          h('p', { className: 'dshw-card-sub' }, archived ? t.archiveHintOn : t.archiveHintOff),
          h('div', { className: 'dshw-action-grid' },
            archived
              ? h(Btn, {
                icon: 'archiveRestore',
                disabled: busy !== '',
                onClick: () => void actPost('unarchive', 'task/unarchive', {}, t.unarchiveDone),
              }, busy === 'unarchive' ? h(Spinner) : null, t.unarchive)
              : h(Btn, {
                icon: 'archive',
                disabled: busy !== '',
                onClick: () => void actPost('archive', 'task/archive', {}, t.archiveDone),
              }, busy === 'archive' ? h(Spinner) : null, t.archive)))
        : null,
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
      switchModal,
      mergeModal,
      cleanupModal,
      deleteModal)
  }


