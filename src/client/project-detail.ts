import { React, h } from './ui'
import { Banner, Btn, Card, CardHead, Checkbox, CopyBtn, Icon, KV, MenuItem, Modal, Spinner, Stat, BranchCombobox, TextInput } from './primitives'
import { useBranchInfo } from './hooks'
import { post } from './context'
import { copyText, cx, downloadText, relTime } from './format'
import { resolveStatus, pendingLabel } from './status'
import { boardStatus, boardStatusLabel } from './model'
import { buildProjectReport, projectReportFilename } from './project-report'
import { buildProjectInsights } from './project-insights'
import { buildDependencyGraph, DEP_GRAPH_LIMIT } from './dependency-graph'
import { buildProjectRisk } from './project-risk'
import { fill } from './markdown'
import { DEFAULT_WORKTREE_DIR } from '../worktree-layout'

/** Character-budget truncation for SVG labels (a pure render cannot measure text). */
function graphLabel(text: string, maxWidth: number): string {
  const value = String(text == null ? '' : text)
  let used = 0
  let out = ''
  for (const char of value) {
    const width = char.charCodeAt(0) > 0x2e7f ? 12 : 7
    if (used + width > maxWidth) return out + '…'
    used += width
    out += char
  }
  return out
}

export function ProjectDetail(props: any) {
    const t = props.t
    const v = props.view
    const project = v.project
    const cfg = props.cfg || {}
    const [name, setName] = React.useState(project.name)
    const [baseBranch, setBaseBranch] = React.useState(project.baseBranch || '')
    const [dirName, setDirName] = React.useState(project.dirName || '')
    const [branchPrefix, setBranchPrefix] = React.useState(project.branchPrefix || '')
    // Opt-in gate: only an explicit 'criteria' blocks merges; absent means off.
    const [mergeGateOn, setMergeGateOn] = React.useState(project.mergeGate === 'criteria')
    const branches = useBranchInfo(project.repoPath)
    const [deleteTarget, setDeleteTarget] = React.useState(null as { id: string; name: string; baseBranch: string; total: number } | null)
    const [withTasks, setWithTasks] = React.useState(false)
    const [withWorktrees, setWithWorktrees] = React.useState(false)
    const [busy, setBusy] = React.useState('')
    const [msg, setMsg] = React.useState('')
    const [err, setErr] = React.useState('')
    const [nameError, setNameError] = React.useState('')
    const [tab, setTab] = React.useState('overview')
    const saveTimer = React.useRef(null)
    const actionRef = React.useRef(false)

    // The overview must agree with the sidebar. A Git-derived `review` on a
    // still-running session is really "in progress", so resolve the live
    // session state before bucketing tasks.
    const isRunning = (task: any) => !!(task && task.sessionId && props.sessionMap && props.sessionMap[task.sessionId])
    // A task belongs to exactly one bucket. "Needs attention" used to include
    // every pending session, which could also sit in "in progress" — the same
    // task was counted twice. Broken/pending wins over the status bucket.
    const bucketOf = (item: any): 'attention' | 'active' | 'review' | 'merged' | 'other' => {
      const status = resolveStatus(item.snapshot.status, isRunning(item.task))
      const pending = !!(item.task.sessionId && props.pendingMap && props.pendingMap[item.task.sessionId])
      if (status === 'broken' || pending) return 'attention'
      if (status === 'developing' || status === 'reviewing') return 'active'
      if (status === 'review') return 'review'
      if (status === 'merged') return 'merged'
      return 'other'
    }
    const counts = { total: v.tasks.length, attention: 0, active: 0, review: 0, merged: 0 }
    for (const item of v.tasks) {
      const bucket = bucketOf(item)
      if (bucket !== 'other') counts[bucket] += 1
    }
    // Same bucket as the stat above, so the banner and the number never disagree.
    const attentionTasks = v.tasks.filter((item: any) => bucketOf(item) === 'attention')
    // Every waiting prompt, not just the first: one project can hold several.
    const pendingTasks = v.tasks.filter((item: any) => !!(item.task.sessionId && props.pendingMap && props.pendingMap[item.task.sessionId]))
    const reviewingTasks = v.tasks.filter((item: any) => item.snapshot.status === 'reviewing')

    const act = async (label: string, fn: () => Promise<any>) => {
      if (actionRef.current || busy) return
      actionRef.current = true
      setBusy(label)
      setErr('')
      setMsg('')
      try {
        await fn()
        await props.onChanged()
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        actionRef.current = false
        setBusy('')
      }
    }

    const save = () => {
      if (busy) return
      if (!name.trim()) {
        setNameError(t.requiredField)
        window.requestAnimationFrame(() => document.getElementById('dshw-project-name')?.focus())
        return
      }
      setNameError('')
      void act('save', async () => {
        await post('projects/update', {
          id: project.id,
          name: name.trim(),
          baseBranch,
          dirName,
          branchPrefix,
          mergeGate: mergeGateOn ? 'criteria' : 'off',
        })
        setMsg(t.saved)
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => setMsg(''), 3200)
      })
    }

    React.useEffect(() => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }, [])

    const openDelete = () => {
      // Snapshot the identity being deleted: the detail view keeps re-rendering
      // from live props, and a project switch must not retarget the open panel.
      setDeleteTarget({ id: project.id, name: project.name, baseBranch: project.baseBranch || '', total: counts.total })
      setWithTasks(false)
      // Removing folders is destructive and cannot be undone; keep it opt-in.
      setWithWorktrees(false)
      setErr('')
    }
    const closeDelete = () => {
      if (busy === 'del') return
      setDeleteTarget(null)
      setErr('')
    }

    const remove = () => {
      const target = deleteTarget
      if (!target) return
      void act('del', async () => {
        await post('projects/delete', { id: target.id, withTasks, withWorktrees: withTasks && withWorktrees })
        setDeleteTarget(null)
        props.onDeleted()
        props.notify(String(t.projectDeleted).replace('{name}', target.name))
      })
    }

    const branchHint = branches.status === 'loading'
      ? t.loadingBranches
      : branches.status === 'error'
        ? h('span', null, t.loadBranchesFailed, ' ',
          h('button', { type: 'button', className: 'dshw-link-btn', onClick: branches.retry }, t.retry))
        : null
    const branchControl = branches.data
      ? h(BranchCombobox, { t, value: baseBranch, onChange: setBaseBranch, branchInfo: branches.data, id: 'dshw-project-base' })
      : h(TextInput, { id: 'dshw-project-base', value: baseBranch, onChange: (e: any) => setBaseBranch(e.target.value), placeholder: t.baseBranch })

    const deleteModal = deleteTarget
      ? h(Modal, {
        t,
        title: t.deleteProjectTitle,
        subtitle: deleteTarget.name,
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: busy === 'del',
        onClose: closeDelete,
        footer: [
          h(Btn, { key: 'c', onClick: closeDelete, disabled: busy === 'del', 'data-modal-autofocus': true }, t.cancel),
          h(Btn, {
            key: 'ok',
            variant: 'danger',
            disabled: busy === 'del' || (deleteTarget.total > 0 && !withTasks) || reviewingTasks.length > 0,
            onClick: remove,
          }, busy === 'del' ? h(Spinner) : null, busy === 'del' ? t.deleting : t.deleteProjectConfirm),
        ],
      },
        deleteTarget.total > 0
          ? h(Banner, { tone: 'warn', icon: 'alert', title: String(t.deleteProjectWarning).replace('{n}', String(deleteTarget.total)) }, t.deleteProjectWarningHint)
          : h(Banner, { tone: 'info', icon: 'info' }, t.deleteProjectEmptyHint),
        reviewingTasks.length
          ? h(Banner, { tone: 'warn', icon: 'alert', title: t.reviewingBlockTitle }, t.reviewingBlockHint)
          : null,
        h('div', { className: 'dshw-info-table' },
          h(KV, { label: t.deleteProjectBase }, h('span', { className: 'dshw-mono' }, deleteTarget.baseBranch))),
        deleteTarget.total > 0
          ? h(Checkbox, {
            className: 'dshw-check',
            checked: withTasks,
            onChange: (next: boolean) => setWithTasks(next),
            label: h('span', { className: 'dshw-check-copy' }, t.withTasks),
          })
          : null,
        deleteTarget.total > 0
          ? h(Checkbox, {
            className: 'dshw-check',
            checked: withWorktrees,
            disabled: !withTasks,
            onChange: (next: boolean) => setWithWorktrees(next),
            label: h('span', { className: 'dshw-check-copy' }, t.withWorktrees, h('small', { id: 'dshw-delete-worktrees-hint' }, t.withWorktreesHint)),
          })
          : null,
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    const tabBtn = (key: string, label: any) => h('button', {
      type: 'button',
      className: 'dshw-tab' + (tab === key ? ' dshw-tab--on' : ''),
      onClick: () => setTab(key),
    }, label)

    const topbar = h('div', { className: 'dshw-topbar' },
      h('div', { className: 'dshw-topbar-left' },
        props.onToggleRail
          ? h('button', { type: 'button', className: 'dshw-btn dshw-btn--ghost dshw-btn--sm', title: props.railHidden ? t.expand : t.collapse, 'aria-label': props.railHidden ? t.expand : t.collapse, onClick: () => props.onToggleRail() },
            props.narrow
              ? [h('span', { key: 'i', 'aria-hidden': 'true' }, '‹'), h('span', { key: 't', className: 'dshwd-btn-label' }, t.backToList)]
              : '◧')
          : null,
        h('div', { className: 'dshw-breadcrumb' },
          h(Icon, { name: 'folder' }),
          h('strong', null, project.name),
          h('span', null, '/'),
          h('span', { className: 'dshw-mono' }, project.repoPath))),
      h('div', { className: 'dshw-topbar-right' },
        h('span', { className: 'dshw-mono dshwd-topbar-count', style: { fontSize: '11px', color: 'var(--dshw-text-3)' } }, counts.total + ' ' + t.taskUnit),
        props.onToggleInspector
          ? h('button', { type: 'button', className: 'dshw-btn dshw-btn--ghost dshw-btn--sm', title: props.inspectorHidden ? t.expand : t.collapse, 'aria-label': t.collapse, onClick: () => props.onToggleInspector() }, '◨')
          : null))

    const stageHead = h('header', { className: 'dshw-stage-head' },
      h('div', { className: 'dshw-stage-title-row' },
        h('div', { style: { minWidth: 0 } },
          h('h1', { className: 'dshw-stage-title' }, project.name),
          h('div', { className: 'dshw-stage-sub' },
            h('span', { className: 'dshw-mono' }, project.repoPath),
            h(CopyBtn, { text: project.repoPath, label: t.copyRepoPath, t, notify: props.notify }))),
        h('div', { style: { display: 'flex', gap: '8px', flexShrink: 0 } },
          h(Btn, { icon: 'play', onClick: () => props.onPublish(project) }, t.publish),
          h('details', { className: 'dshw-menu' },
            h('summary', { className: 'dshw-icon-btn', 'aria-label': t.operations, title: t.operations }, h(Icon, { name: 'more' })),
            h('div', { className: 'dshw-menu-pop' },
              h(MenuItem, { icon: 'plus', onClick: () => props.onPublish(project) }, t.publish),
              h(MenuItem, { icon: 'copy', onClick: () => { void copyText(project.repoPath).then((ok) => props.notify(ok ? t.copied : t.copyFailed, ok ? 'ok' : 'error')) } }, t.copyRepoPath))))),
      h('nav', { className: 'dshw-tabs' },
        tabBtn('overview', t.overview),
        tabBtn('settings', t.projectSettings)))

    const recent = v.tasks.slice()
      .sort((a: any, b: any) => ((b.task.updatedAt || b.task.createdAt || 0) - (a.task.updatedAt || a.task.createdAt || 0)))
      .slice(0, 6)

    // One clock read per render: the seven day buckets must share a boundary.
    const insights = buildProjectInsights(v.tasks, Date.now())
    const maxDaily = insights.daily.reduce((max: number, day: any) => Math.max(max, day.created, day.merged), 0)
    const barHeight = (count: number) => maxDaily > 0 ? Math.round((count / maxDaily) * 100) + '%' : '0%'
    const insightsCard = h(Card, null,
      h(CardHead, { icon: 'grid', title: t.projectInsights }),
      h('div', { className: 'dshw-stats' },
        h(Stat, {
          label: t.insightsCycle,
          icon: 'clock',
          tone: 'brand',
          value: insights.cycleAverageDays == null ? t.insightsNoData : fill(t.insightsCycleValue, { n: insights.cycleAverageDays.toFixed(1) }),
        }),
        h(Stat, { label: t.insightsMerged7, icon: 'branch', tone: 'success', value: insights.mergedLast7 }),
        h(Stat, {
          label: t.insightsAcceptance,
          icon: 'check',
          tone: 'brand',
          value: insights.acceptancePercent == null ? t.insightsNoData : fill(t.insightsAcceptanceValue, { n: insights.acceptancePercent }),
        }),
        h(Stat, {
          label: t.insightsOldest,
          icon: 'clock',
          tone: 'warn',
          value: insights.oldestOpenDays == null ? t.insightsNoData : fill(t.insightsOldestValue, { n: insights.oldestOpenDays }),
        })),
      insights.cycleMedianDays == null
        ? null
        : h('div', { className: 'dshw-hint' }, fill(t.insightsCycleMedian, { n: insights.cycleMedianDays.toFixed(1) })),
      h('div', { className: 'dshw-hint' }, insights.open === 0
        ? t.insightsWorkloadEmpty
        : fill(t.insightsWorkload, { open: insights.open, estimated: insights.estimatedOpen, points: insights.openEstimatePoints })),
      insights.total === 0
        ? h('div', { className: 'dshw-hint' }, t.insightsEmpty)
        : h('div', { className: 'dshwd-insights' },
          h('div', { className: 'dshw-block-label' }, t.insightsDaily),
          h('div', { className: 'dshwd-insights-days', role: 'group', 'aria-label': t.insightsDaily },
            insights.daily.map((day: any) => {
              const date = new Date(day.start)
              const dateLabel = (date.getMonth() + 1) + '/' + date.getDate()
              const tip = fill(t.insightsDailyTip, { date: dateLabel, created: day.created, merged: day.merged })
              return h('div', { key: day.offset, className: 'dshwd-insights-day', role: 'img', title: tip, 'aria-label': tip },
                h('div', { className: 'dshwd-insights-day-bars', 'aria-hidden': 'true' },
                  h('span', { className: 'dshwd-insights-bar dshwd-insights-bar--created', style: { height: barHeight(day.created) } }),
                  h('span', { className: 'dshwd-insights-bar dshwd-insights-bar--merged', style: { height: barHeight(day.merged) } })),
                h('span', { className: 'dshwd-insights-day-label dshw-mono' }, dateLabel))
            })),
          h('div', { className: 'dshwd-insights-legend' },
            h('span', null, h('i', { className: 'dshwd-insights-swatch dshwd-insights-swatch--created', 'aria-hidden': 'true' }), t.insightsCreated),
            h('span', null, h('i', { className: 'dshwd-insights-swatch dshwd-insights-swatch--merged', 'aria-hidden': 'true' }), t.insightsMerged))))

    // Dependency graph: a pure, layered view of the same records. It never
    // blocks anything and never writes; missing ids become placeholder nodes.
    const depGraph = buildDependencyGraph(v.tasks)
    const depNodeById = new Map(depGraph.nodes.map((node: any) => [node.id, node]))
    const depCycleIds = new Set<string>(depGraph.cycles.reduce((all: string[], cycle: string[]) => all.concat(cycle), []))
    const depNodeStatus = (node: any) => node.missing
      ? t.depGraphMissing
      : [node.done ? t.depGraphDone : t.depGraphOpen, node.archived ? t.depGraphArchived : ''].filter(Boolean).join(' · ')
    const depMissingCount = depGraph.nodes.filter((node: any) => node.missing).length
    const depSummary = fill(t.depGraphSummary, {
      layers: depGraph.layers.length,
      tasks: depGraph.shown,
      missing: depMissingCount,
      cycle: depGraph.cycles.length ? fill(t.depGraphHasCycle, { n: depGraph.cycles.length }) : t.depGraphNoCycle,
    })
    const depEdgePath = (edge: any) => {
      const from = depNodeById.get(edge.from)
      const to = depNodeById.get(edge.to)
      if (!from || !to) return ''
      const x1 = from.x + from.width
      const y1 = from.y + from.height / 2
      const x2 = to.x
      const y2 = to.y + to.height / 2
      const bend = Math.max(16, Math.abs(x2 - x1) / 2)
      return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
    }
    const depLegend = [
      { key: 'open', label: t.depGraphLegendOpen, mod: 'open' },
      { key: 'done', label: t.depGraphLegendDone, mod: 'done' },
      { key: 'missing', label: t.depGraphLegendMissing, mod: 'missing' },
      { key: 'cycle', label: t.depGraphLegendCycle, mod: 'cycle' },
    ]
    const depArrows = [
      { key: 'normal', mod: '' },
      { key: 'missing', mod: '--missing' },
      { key: 'cycle', mod: '--cycle' },
    ]
    const depGraphBody: any[] = []
    if (depGraph.total === 0) {
      depGraphBody.push(h('div', { key: 'empty', className: 'dshw-hint' }, t.depGraphEmptyTasks))
    } else if (depGraph.edges.length === 0) {
      depGraphBody.push(h('div', { key: 'nodeps', className: 'dshw-hint' }, t.depGraphEmptyDeps))
    } else {
      depGraphBody.push(h('div', { key: 'canvas', className: 'dshwd-depgraph-scroll' },
        h('svg', {
          className: 'dshwd-depgraph-svg',
          viewBox: '0 0 ' + depGraph.width + ' ' + depGraph.height,
          width: depGraph.width,
          height: depGraph.height,
          'aria-hidden': 'true',
          focusable: 'false',
        },
          h('defs', null, depArrows.map((arrow: any) => h('marker', {
            key: arrow.key,
            id: 'dshwd-depgraph-arrow' + arrow.mod,
            viewBox: '0 0 8 8',
            refX: 7,
            refY: 4,
            markerWidth: 7,
            markerHeight: 7,
            orient: 'auto-start-reverse',
          }, h('path', { d: 'M0 0 L8 4 L0 8 z', className: 'dshwd-depgraph-arrow' + arrow.mod })))),
          h('g', { className: 'dshwd-depgraph-edges' }, depGraph.edges.map((edge: any, i: number) => h('path', {
            key: edge.from + '>' + edge.to + ':' + i,
            className: 'dshwd-depgraph-edge'
              + (edge.missing ? ' dshwd-depgraph-edge--missing' : '')
              + (edge.cycle ? ' dshwd-depgraph-edge--cycle' : ''),
            d: depEdgePath(edge),
            markerEnd: 'url(#dshwd-depgraph-arrow' + (edge.cycle ? '--cycle' : edge.missing ? '--missing' : '') + ')',
          }))),
          h('g', { className: 'dshwd-depgraph-nodes' }, depGraph.nodes.map((node: any) => h('g', {
            key: node.id,
            className: 'dshwd-depgraph-node'
              + (node.done ? ' dshwd-depgraph-node--done' : '')
              + (node.archived ? ' dshwd-depgraph-node--archived' : '')
              + (node.missing ? ' dshwd-depgraph-node--missing' : '')
              + (depCycleIds.has(node.id) ? ' dshwd-depgraph-node--cycle' : ''),
            transform: 'translate(' + node.x + ' ' + node.y + ')',
            onClick: node.missing || !props.onSelectTask ? undefined : () => props.onSelectTask(node.id, project.id),
          },
            h('title', null, node.title + (node.archived ? ' · ' + t.depGraphArchived : '')),
            h('rect', { className: 'dshwd-depgraph-rect', width: node.width, height: node.height, rx: 6 }),
            h('text', { className: 'dshwd-depgraph-label', x: 10, y: node.height / 2, dy: '0.35em' },
              graphLabel(node.title, node.width - 20))))))))
      if (depGraph.cycles.length) {
        depGraphBody.push(h('div', { key: 'cycles', className: 'dshwd-depgraph-warn', role: 'status' },
          h(Icon, { name: 'alert' }),
          h('span', null, fill(t.depGraphCycles, { n: depGraph.cycles.length }))))
      }
      depGraphBody.push(h('div', { key: 'layers', className: 'dshwd-depgraph-layers' },
        h('div', { className: 'dshw-block-label' }, t.depGraphLayers),
        depGraph.layers.map((layer: any) => h('div', {
          key: layer.index,
          className: 'dshwd-depgraph-layer',
          role: 'group',
          'aria-label': fill(t.depGraphLayer, { n: layer.index + 1 }),
        },
          h('div', { className: 'dshwd-depgraph-layer-title' }, fill(t.depGraphLayer, { n: layer.index + 1 })),
          h('div', { className: 'dshwd-depgraph-layer-items' }, layer.nodeIds.map((id: string) => {
            const node = depNodeById.get(id)
            if (!node) return null
            const status = depNodeStatus(node)
            const itemClass = 'dshwd-depgraph-item'
              + (node.done ? ' dshwd-depgraph-item--done' : '')
              + (node.archived ? ' dshwd-depgraph-item--archived' : '')
              + (node.missing ? ' dshwd-depgraph-item--missing' : '')
              + (depCycleIds.has(id) ? ' dshwd-depgraph-item--cycle' : '')
            if (node.missing) {
              return h('span', { key: id, className: itemClass },
                h('span', { className: 'dshwd-depgraph-item-title' }, node.title),
                h('span', { className: 'dshwd-depgraph-item-status' }, status))
            }
            return h('button', {
              key: id,
              type: 'button',
              className: itemClass,
              title: node.title,
              'aria-label': fill(t.depGraphJump, { title: node.title }) + ' · ' + status,
              onClick: props.onSelectTask ? () => props.onSelectTask(id, project.id) : undefined,
            },
              h('span', { className: 'dshwd-depgraph-item-title' }, node.title),
              h('span', { className: 'dshwd-depgraph-item-status' }, status))
          }))))))
    }
    if (depGraph.truncated) {
      depGraphBody.push(h('div', { key: 'truncated', className: 'dshw-hint' }, fill(t.depGraphTruncated, { n: DEP_GRAPH_LIMIT })))
    }
    const depGraphCard = h(Card, { className: 'dshwd-depgraph-card' },
      h(CardHead, {
        icon: 'grid',
        title: t.depGraphTitle,
        right: h('div', { className: 'dshwd-depgraph-legend', role: 'group', 'aria-label': t.depGraphTitle },
          depLegend.map((item: any) => h('span', { key: item.key, className: 'dshwd-depgraph-legend-item' },
            h('i', { className: 'dshwd-depgraph-swatch dshwd-depgraph-swatch--' + item.mod, 'aria-hidden': 'true' }),
            item.label))),
      }),
      h('div', { className: 'dshw-hint', style: { marginBottom: '8px' } }, t.depGraphHint + ' · ' + depSummary),
      depGraphBody)

    // Risk radar: a sortable, explainable hint derived from the rows on screen.
    // The card never writes, never reorders the board and never changes status.
    const risk = buildProjectRisk(v.tasks, Date.now())
    const riskReasonLabel = (reason: any): string => {
      switch (reason && reason.code) {
        case 'broken': return t.riskReasonBroken
        case 'overdue': return fill(t.riskReasonOverdue, { n: reason.n })
        case 'due-soon': return t.riskReasonDueSoon
        case 'stalled': return fill(t.riskReasonStalled, { n: reason.n })
        case 'blocked': return fill(t.riskReasonBlocked, { n: reason.n })
        case 'criteria': return fill(t.riskReasonCriteria, { n: reason.n })
        default: return ''
      }
    }
    const riskStat = (key: string, label: string, value: number, tone: string) => h('div', {
      key,
      className: 'dshwd-risk-stat dshwd-risk-stat--' + tone,
    },
      h('span', { className: 'dshwd-risk-stat-num' }, value),
      h('span', { className: 'dshwd-risk-stat-label' }, label))
    const riskCard = h(Card, null,
      h(CardHead, { icon: 'alert', title: t.riskRadar }),
      h('div', { className: 'dshw-hint' }, t.riskRadarHint),
      risk.open === 0
        ? h('div', { className: 'dshw-hint' }, t.riskEmptyOpen)
        : [
          h('div', { key: 'stats', className: 'dshwd-risk-stats' },
            riskStat('high', t.riskHigh, risk.high, 'err'),
            riskStat('medium', t.riskMedium, risk.medium, 'warn'),
            riskStat('low', t.riskLow, risk.low, 'ok')),
          risk.high + risk.medium + risk.low === 0
            ? h('div', { key: 'clear', className: 'dshw-hint' }, t.riskEmptyClear)
            : h('div', { key: 'list', className: 'dshwd-risk-list', role: 'group', 'aria-label': t.riskRadar },
              risk.top.map((item: any) => {
                const reasons = item.reasons.map(riskReasonLabel).filter(Boolean)
                const label = fill(t.riskItemLabel, { title: item.title, score: item.score, reasons: reasons.join(' · ') })
                return h('button', {
                  key: item.taskId,
                  type: 'button',
                  className: 'dshwd-risk-item',
                  'aria-label': label,
                  onClick: () => { if (props.onSelectTask) props.onSelectTask(item.taskId) },
                },
                  h('span', { className: 'dshwd-risk-item-title' }, item.title),
                  h('span', { className: 'dshwd-risk-score dshwd-risk-score--' + item.level, 'aria-hidden': 'true' }, item.score),
                  h('span', { className: 'dshwd-risk-reasons' },
                    reasons.map((reason: string, index: number) => h('span', { key: index, className: 'dshwd-risk-chip' }, reason))))
              })),
        ])

    // The project report is generated locally from the views already on screen;
    // copying and downloading must never disagree, so both share one text.
    const projectReportText = () => buildProjectReport({
      project,
      views: v.tasks,
      t,
      statusLabel: (item: any) => boardStatusLabel(t, boardStatus(item.snapshot.status, isRunning(item.task))),
    })
    const copyProjectReport = async () => {
      if (actionRef.current || busy) return
      actionRef.current = true
      setBusy('report')
      try {
        const ok = await copyText(projectReportText())
        if (!ok) throw new Error(t.reportFailed)
        if (props.notify) props.notify(t.projectReportCopied)
      } catch (e: any) {
        if (props.notify) props.notify(String((e && e.message) || t.reportFailed), true)
      } finally {
        actionRef.current = false
        setBusy('')
      }
    }
    const downloadProjectReport = () => {
      if (actionRef.current || busy) return
      actionRef.current = true
      setBusy('report')
      try {
        if (!downloadText(projectReportText(), projectReportFilename(project))) throw new Error(t.reportFailed)
        if (props.notify) props.notify(t.projectReportDownloaded)
      } catch (e: any) {
        if (props.notify) props.notify(String((e && e.message) || t.reportFailed), true)
      } finally {
        actionRef.current = false
        setBusy('')
      }
    }

    const overviewBody = h('div', { className: 'dshw-stage-body' },
      h('div', { className: 'dshw-measure' },
        err ? h('div', { className: 'dshw-err', role: 'alert', style: { marginBottom: '16px' } }, h(Icon, { name: 'alert' }), h('span', null, err)) : null,
        h('div', { className: 'dshw-stats' },
          h(Stat, { label: t.attentionStat, value: counts.attention, icon: 'alert', tone: 'warn' }),
          h(Stat, { label: t.activeTasks, value: counts.active, icon: 'terminal', tone: 'brand' }),
          h(Stat, { label: t.reviewTasks, value: counts.review, icon: 'clock', tone: 'warn' }),
          h(Stat, { label: t.mergedTasks, value: counts.merged, icon: 'branch', tone: 'success' })),
        attentionTasks.length
          ? h('div', { className: 'dshw-attention' },
            h(Icon, { name: 'clock' }),
            h('span', null, String(t.attention).replace('{n}', String(attentionTasks.length))),
            pendingTasks.length
              ? h('button', { type: 'button', className: 'dshw-link-btn', onClick: () => props.onSelectTask(pendingTasks[0].task.id, project.id) }, t.view)
              : null)
          : null,
        pendingTasks.length
          ? h(Card, null,
            h(CardHead, { icon: 'message', title: t.attentionPending }),
            h('div', { className: 'dshw-acts' }, pendingTasks.map((item: any) => h('button', {
              key: item.task.id,
              type: 'button',
              className: 'dshw-act-row',
              onClick: () => props.onSelectTask(item.task.id, project.id),
            },
              h('span', { className: 'dshw-act-dot dshw-act-dot--review' }),
              h('span', { className: 'dshw-act-title' }, item.task.title),
              h('span', { className: 'dshw-act-time dshw-mono' }, pendingLabel(t, props.pendingMap[item.task.sessionId]))))))
          : null,
        insightsCard,
        depGraphCard,
        riskCard,
        h(Card, null,
          h(CardHead, { icon: 'file', title: t.projectReport }),
          h('div', { className: 'dshw-hint', style: { marginBottom: '10px' } }, t.projectReportHint),
          h('div', { style: { display: 'flex', gap: '8px' } },
            h(Btn, { variant: 'ghost', size: 'sm', icon: 'copy', disabled: busy === 'report', onClick: () => void copyProjectReport() }, t.projectReportCopy),
            h(Btn, { variant: 'ghost', size: 'sm', icon: 'file', disabled: busy === 'report', onClick: downloadProjectReport }, t.projectReportDownload))),
        h(Card, null,
          h(CardHead, { title: t.lastActivity }),
          recent.length
            ? h('div', { className: 'dshw-acts' }, recent.map((item: any) => {
              const st = resolveStatus(item.snapshot.status, isRunning(item.task))
              return h('button', {
                key: item.task.id,
                type: 'button',
                className: 'dshw-act-row',
                onClick: () => props.onSelectTask(item.task.id, project.id),
              },
                h('span', { className: 'dshw-act-dot dshw-act-dot--' + st }),
                h('span', { className: 'dshw-act-title' }, item.task.title),
                h('span', { className: 'dshw-act-time dshw-mono' }, relTime(item.task.updatedAt || item.task.createdAt, t)))
            }))
            : h('div', { className: 'dshw-hint' }, t.noTasks))))

    const settingsBody = h('div', { className: 'dshw-stage-body' },
      h('div', { className: 'dshw-measure' },
        h(Card, null,
          h(CardHead, { icon: 'sliders', title: t.projectSettings }),
          h('p', { className: 'dshw-card-sub' }, t.projectSettingsHint),
          h('form', { onSubmit: (e: any) => { e.preventDefault(); save() } },
            h('div', { className: 'dshw-form-rows' },
              h('div', { className: 'dshw-form-row' },
                h('label', { htmlFor: 'dshw-project-name' }, t.projectName),
                h('div', null,
                  h('input', {
                    id: 'dshw-project-name',
                    className: cx('dshw-input', nameError && 'dshw-invalid'),
                    value: name,
                    'aria-invalid': nameError ? 'true' : 'false',
                    'aria-describedby': nameError ? 'dshw-project-name-error' : undefined,
                    onChange: (e: any) => { setName(e.target.value); setNameError('') },
                  }),
                  nameError ? h('div', { className: 'dshw-err', id: 'dshw-project-name-error', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, nameError)) : null)),
              h('div', { className: 'dshw-form-row' },
                h('label', { htmlFor: 'dshw-project-base' }, t.defaultBase),
                h('div', null,
                  branchControl,
                  branchHint ? h('div', { className: 'dshw-hint' }, branchHint) : null)),
              h('div', { className: 'dshw-form-row' },
                h('label', { htmlFor: 'dshw-project-prefix' }, t.branchPrefix),
                h('div', null,
                  h('input', {
                    id: 'dshw-project-prefix',
                    className: 'dshw-input dshw-mono',
                    value: branchPrefix,
                    placeholder: 'dsh-wt/',
                    onChange: (e: any) => setBranchPrefix(e.target.value),
                  }),
                  h('div', { className: 'dshw-hint' }, t.branchPrefixHint))),
              h('div', { className: 'dshw-form-row' },
                h('label', { htmlFor: 'dshw-project-dir' }, t.worktreeDirName),
                h('div', null,
                  h('input', {
                    id: 'dshw-project-dir',
                    className: 'dshw-input dshw-mono',
                    value: dirName,
                    placeholder: cfg.dirName || DEFAULT_WORKTREE_DIR,
                    onChange: (e: any) => setDirName(e.target.value),
                  }),
                  h('div', { className: 'dshw-hint' }, t.worktreeDirHint))),
              h('div', { className: 'dshw-form-row' },
                h('div', { className: 'dshw-form-label' }, t.mergeGate),
                h('div', null,
                  h(Checkbox, {
                    className: 'dshw-check',
                    checked: mergeGateOn,
                    onChange: (next: boolean) => setMergeGateOn(next),
                    label: h('span', { className: 'dshw-check-copy' }, t.mergeGateCriteria),
                  }),
                  h('div', { className: 'dshw-hint' }, t.mergeGateHint)))),
            h('div', { className: 'dshw-form-foot' },
              h(Btn, { variant: 'primary', type: 'submit', disabled: busy !== '' }, busy === 'save' ? h(Spinner) : null, busy === 'save' ? t.saving : t.save),
              h('span', { className: 'dshw-save-state', role: 'status' }, msg ? [h(Icon, { key: 'i', name: 'check' }), h('span', { key: 's' }, msg)] : null)),
            err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null))))

    const inspector = h('aside', { className: 'dshw-inspector' },
      h(Card, { danger: true },
        h(CardHead, { icon: 'alert', title: t.deleteProject }),
        h('p', { className: 'dshw-card-sub' }, t.deleteProjectCardHint),
        reviewingTasks.length
          ? h('div', { className: 'dshw-hint', style: { marginBottom: '8px' } }, h(Icon, { name: 'alert' }), h('span', null, t.reviewingBlockHint))
          : null,
        h(Btn, { variant: 'danger', icon: 'trash', disabled: busy !== '' || reviewingTasks.length > 0, onClick: openDelete }, t.deleteProject)))

    return h('div', { className: 'dshw-detail-inner dshw-stage-grid' },
      h('div', { className: 'dshw-stage' }, topbar, stageHead, tab === 'settings' ? settingsBody : overviewBody),
      inspector,
      deleteModal)
  }


