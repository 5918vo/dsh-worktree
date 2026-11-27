/**
 * Cross-project portfolio page: the board's default surface when nothing is
 * selected. Every project gets one keyboard-reachable row with its open work,
 * attention, risk and 7-day activity; the header carries the global totals.
 *
 * Render-only: all numbers come from `buildPortfolio` (pure) and the board's
 * own attention callback. Nothing here writes state or reads the clock.
 */

import { React, h } from './ui'
import { Icon, Stat } from './primitives'
import { fill } from './markdown'
import type { ProjectView, TaskView } from '../models'
import { buildPortfolio, PORTFOLIO_DAYS, type PortfolioProject, type PortfolioSummary } from './portfolio'

export interface PortfolioViewProps {
  t: any
  views: ProjectView[]
  attentionOf: ((view: TaskView) => { categories: Set<string> } | null) | null
  railHidden: boolean
  narrow: boolean
  onToggleRail: () => void
  onSelectProject: (projectId: string) => void
  onPublish: () => void
  onAddProject: () => void
}

function barHeight(count: number, max: number): string {
  if (max <= 0 || count <= 0) return '0%'
  return Math.max(4, Math.round((count / max) * 100)) + '%'
}

function dayLabel(start: number): string {
  const date = new Date(start)
  return (date.getMonth() + 1) + '/' + date.getDate()
}

export function PortfolioView(props: PortfolioViewProps) {
  const { t } = props
  const now = Date.now()
  const summary: PortfolioSummary = buildPortfolio({
    views: props.views,
    attentionOf: props.attentionOf,
    now,
  })
  const totals = summary.totals
  const maxDaily = summary.daily.reduce((max: number, day: any) => Math.max(max, day.created, day.merged), 0)
  const hasProjects = props.views.length > 0

  const riskText = (row: PortfolioProject): string => row.highRisk === 0 && row.mediumRisk === 0
    ? t.portfolioRiskNone
    : fill(t.portfolioRiskValue, { high: row.highRisk, medium: row.mediumRisk })
  const pointsText = (points: number): string => points > 0 ? fill(t.portfolioPointsValue, { n: points }) : t.portfolioNoValue
  const oldestText = (days: number | null): string => days == null ? t.portfolioNoValue : fill(t.portfolioOldestValue, { n: days })

  const rowLabel = (row: PortfolioProject): string => fill(t.portfolioRowLabel, {
    project: row.name,
    open: row.open,
    attention: row.attention,
    overdue: row.overdue,
    blocked: row.blocked,
    review: row.review,
    risk: riskText(row),
    points: pointsText(row.estimatePoints),
    oldest: oldestText(row.oldestOpenDays),
  })

  const metric = (key: string, label: string, value: string, tone?: string) => h('span', {
    key,
    className: 'dshwd-portfolio-metric' + (tone ? ' dshwd-portfolio-metric--' + tone : ''),
    title: label + ': ' + value,
  },
    h('span', { className: 'dshwd-portfolio-metric-k' }, label),
    h('span', { className: 'dshwd-portfolio-metric-v dshw-mono' }, value))

  return h('main', { className: 'dshwd-stage dshwd-portfolio' + (props.narrow ? ' dshwd-portfolio--narrow' : '') },
    h('div', { className: 'dshwd-topbar' },
      h('div', { className: 'dshwd-topbar-left' },
        h('button', {
          type: 'button',
          className: 'dshwd-btn dshwd-btn-ghost',
          title: t.boardCollapseLeft,
          'aria-label': t.boardCollapseLeft,
          'aria-expanded': props.railHidden ? 'false' : 'true',
          onClick: props.onToggleRail,
        }, '◧'),
        h('span', { className: 'dshwd-breadcrumb' },
          h(Icon, { name: 'grid' }),
          h('strong', null, t.portfolioTitle))),
      h('div', { className: 'dshwd-topbar-right' },
        h('button', {
          type: 'button',
          className: 'dshwd-btn dshwd-btn-ghost',
          title: t.portfolioAddProject,
          'aria-label': t.portfolioAddProject,
          onClick: props.onAddProject,
        }, '⊞'),
        h('button', {
          type: 'button',
          className: 'dshwd-btn dshwd-btn-cta',
          title: String(t.boardPublishShortcut),
          onClick: props.onPublish,
        }, '+ ', t.publish))),

    h('div', { className: 'dshwd-portfolio-body' },
      h('header', { className: 'dshwd-portfolio-head' },
        h('h1', { className: 'dshwd-portfolio-title' }, t.portfolioTitle),
        h('p', { className: 'dshw-hint' }, t.portfolioHint)),

      h('section', { className: 'dshwd-portfolio-totals', 'aria-label': t.portfolioStatsLabel },
        h('div', { className: 'dshw-stats' },
          h(Stat, { label: t.portfolioOpen, value: totals.open, icon: 'terminal', tone: 'brand' }),
          h(Stat, { label: t.portfolioAttention, value: totals.attention, icon: 'alert', tone: 'warn' }),
          h(Stat, { label: t.portfolioOverdue, value: totals.overdue, icon: 'clock', tone: 'warn' }),
          h(Stat, { label: t.portfolioReview, value: totals.review, icon: 'branch', tone: 'success' })),
        h('div', { className: 'dshwd-portfolio-total-extra' },
          metric('blocked', t.portfolioBlocked, String(totals.blocked)),
          metric('risk', t.portfolioRisk, fill(t.portfolioRiskTotal, { high: totals.highRisk, medium: totals.mediumRisk })),
          metric('points', t.portfolioPoints, pointsText(totals.estimatePoints)),
          metric('projects', t.portfolioProjects, String(totals.projects)))),

      h('section', { className: 'dshwd-portfolio-projects', 'aria-label': t.portfolioProjects },
        h('div', { className: 'dshwd-portfolio-sec-head' },
          h('h2', { className: 'dshw-block-label' }, t.portfolioProjects),
          hasProjects ? h('span', { className: 'dshwd-portfolio-sec-count dshw-mono' }, fill(t.portfolioProjectCount, { n: props.views.length })) : null),
        !hasProjects
          ? h('div', { className: 'dshwd-empty dshwd-portfolio-empty' },
            h('div', { className: 'dshwd-empty-title' }, t.portfolioEmptyTitle),
            h('div', { className: 'dshw-hint' }, t.portfolioEmptyHint),
            h('button', { type: 'button', className: 'dshwd-btn dshwd-btn-cta', onClick: props.onAddProject }, t.portfolioAddProject))
          : h('div', { className: 'dshwd-portfolio-table' },
            h('div', { className: 'dshwd-portfolio-columns', 'aria-hidden': 'true' },
              h('span', null, t.portfolioColProject),
              h('span', null, t.portfolioColOpen),
              h('span', null, t.portfolioColAttention),
              h('span', null, t.portfolioColOverdue),
              h('span', null, t.portfolioColBlocked),
              h('span', null, t.portfolioColReview),
              h('span', null, t.portfolioColRisk),
              h('span', null, t.portfolioColPoints),
              h('span', null, t.portfolioColOldest)),
            summary.ranked.map((row: PortfolioProject) => h('button', {
              key: row.projectId || row.repoPath || row.name,
              type: 'button',
              className: 'dshwd-portfolio-row' + (row.attention > 0 || row.overdue > 0 ? ' dshwd-portfolio-row--hot' : ''),
              'aria-label': rowLabel(row),
              title: rowLabel(row),
              'data-project-id': row.projectId,
              onClick: () => props.onSelectProject(row.projectId),
            },
              h('span', { className: 'dshwd-portfolio-project' },
                h('span', { className: 'dshwd-portfolio-project-name' }, row.name),
                h('span', { className: 'dshwd-portfolio-project-path dshw-mono' }, row.repoPath)),
              h('span', { className: 'dshwd-portfolio-cell dshw-mono', title: t.portfolioOpen + ': ' + row.open }, String(row.open)),
              h('span', { className: 'dshwd-portfolio-cell dshw-mono' + (row.attention > 0 ? ' dshwd-portfolio-cell--warn' : ''), title: t.portfolioAttention + ': ' + row.attention }, String(row.attention)),
              h('span', { className: 'dshwd-portfolio-cell dshw-mono' + (row.overdue > 0 ? ' dshwd-portfolio-cell--err' : ''), title: t.portfolioOverdue + ': ' + row.overdue }, String(row.overdue)),
              h('span', { className: 'dshwd-portfolio-cell dshw-mono' + (row.blocked > 0 ? ' dshwd-portfolio-cell--warn' : ''), title: t.portfolioBlocked + ': ' + row.blocked }, String(row.blocked)),
              h('span', { className: 'dshwd-portfolio-cell dshw-mono', title: t.portfolioReview + ': ' + row.review }, String(row.review)),
              h('span', { className: 'dshwd-portfolio-cell dshwd-portfolio-cell--text' + (row.highRisk > 0 || row.mediumRisk > 0 ? ' dshwd-portfolio-cell--warn' : ' dshwd-portfolio-cell--weak'), title: t.portfolioRisk + ': ' + riskText(row) }, riskText(row)),
              h('span', { className: 'dshwd-portfolio-cell dshw-mono' + (row.estimatePoints > 0 ? '' : ' dshwd-portfolio-cell--weak'), title: t.portfolioPoints + ': ' + pointsText(row.estimatePoints) }, pointsText(row.estimatePoints)),
              h('span', { className: 'dshwd-portfolio-cell dshw-mono' + (row.oldestOpenDays == null ? ' dshwd-portfolio-cell--weak' : ''), title: t.portfolioOldest + ': ' + oldestText(row.oldestOpenDays) }, oldestText(row.oldestOpenDays)))))),

      h('section', { className: 'dshwd-portfolio-chart dshwd-insights', 'aria-label': t.portfolioDaily },
        h('div', { className: 'dshw-block-label' }, t.portfolioDaily),
        h('div', { className: 'dshwd-insights-days', role: 'group', 'aria-label': t.portfolioDaily },
          summary.daily.map((day: any) => {
            const date = dayLabel(day.start)
            const tip = fill(t.portfolioDayTip, { date, created: day.created, merged: day.merged })
            return h('div', { key: day.offset, className: 'dshwd-insights-day', role: 'img', title: tip, 'aria-label': tip },
              h('div', { className: 'dshwd-insights-day-bars', 'aria-hidden': 'true' },
                h('span', { className: 'dshwd-insights-bar dshwd-insights-bar--created', style: { height: barHeight(day.created, maxDaily) } }),
                h('span', { className: 'dshwd-insights-bar dshwd-insights-bar--merged', style: { height: barHeight(day.merged, maxDaily) } })),
              h('span', { className: 'dshwd-insights-day-label dshw-mono' }, date))
          })),
        h('div', { className: 'dshwd-insights-legend' },
          h('span', null, h('i', { className: 'dshwd-insights-swatch dshwd-insights-swatch--created', 'aria-hidden': 'true' }), t.portfolioCreated),
          h('span', null, h('i', { className: 'dshwd-insights-swatch dshwd-insights-swatch--merged', 'aria-hidden': 'true' }), t.portfolioMerged)),
        h('div', { className: 'dshw-hint' }, fill(t.portfolioDaysHint, { n: PORTFOLIO_DAYS })))))
}
