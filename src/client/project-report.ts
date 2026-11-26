/**
 * Project acceptance report: one Markdown document covering every task of a
 * project, for batch handover. Pure functions only — the same text feeds the
 * clipboard action, the `.md` download and the unit tests.
 */

import type { Project, TaskView, WorktreeTask } from '../models'
import { compareTaskOrder, dueInputValue, parseEstimate } from '../task-meta'
import { workBudgetProgress } from '../task-budget'
import { formatWorkDuration } from '../task-timer'
import { workDurationUnits, workTimingText } from './work-format'
import { pad2 } from './format'
import { fill, mdBlock, mdCell, mdCodeCell, mdInline, reportTimestamp, safeSlug } from './markdown'
import { branchHeadSha, criteria, criteriaProgress } from './model'

export interface ProjectReportInput {
  project: Project
  views: TaskView[]
  t: Record<string, any>
  /** Localized status for one task view; the board and the report agree. */
  statusLabel: (view: TaskView) => string
  now?: number
}

/**
 * `id8` of the project id: ASCII letters and digits only, so a project whose
 * display name has no ASCII still gets a usable file name.
 */
function id8(project: Project): string {
  const clean = String((project && project.id) || '').replace(/[^0-9a-zA-Z]/g, '').slice(0, 8).toLowerCase()
  return clean || 'project'
}

/**
 * `project-<slug>-<YYYYMMDD>-<HHmm>.md` in the browser's local time. `now` is
 * injectable so tests do not depend on the clock.
 */
export function projectReportFilename(project: Project, now: number = Date.now()): string {
  const date = new Date(now)
  const stamp = String(date.getFullYear())
    + pad2(date.getMonth() + 1)
    + pad2(date.getDate())
    + '-'
    + pad2(date.getHours())
    + pad2(date.getMinutes())
  return `project-${safeSlug(project && project.name, id8(project))}-${stamp}.md`
}

function priorityText(t: Record<string, any>, value: string | undefined): string {
  return value === 'high' ? String(t.priorityHigh) : value === 'low' ? String(t.priorityLow) : String(t.priorityNormal)
}

function estimateText(t: Record<string, any>, value: unknown): string {
  const estimate = parseEstimate(value)
  return estimate.ok && estimate.value != null ? fill(t.taskEstimatePoints, { n: estimate.value }) : String(t.taskEstimateEmpty)
}

/**
 * Work time as one cell / one line: the accumulated total, the board's word for
 * "never timed", and a marker while the clock still runs. Optional padding
 * keeps the table cell and the detail line identical.
 */
function workText(t: Record<string, any>, task: WorktreeTask, now: number): string {
  return workTimingText(t, task, now)
}

/**
 * Budget as one cell / one line: the cap in the board's duration words, with
 * the overrun appended once the timed work has passed it. No budget reads as
 * the board's "not set", so the column never looks broken.
 */
function budgetText(t: Record<string, any>, task: WorktreeTask, now: number): string {
  const progress = workBudgetProgress(task, now)
  if (!progress) return String(t.taskBudgetEmpty)
  const budget = formatWorkDuration(progress.budgetMs, workDurationUnits(t))
  if (progress.state !== 'over') return budget
  const over = formatWorkDuration(progress.overMs, workDurationUnits(t))
  return budget + '\uff08' + fill(t.reportBudgetOver, { over }) + '\uff09'
}

function activityAt(view: TaskView): number {
  return Math.max(
    Number(view.task.updatedAt) || 0,
    Number(view.task.createdAt) || 0,
    Number(view.snapshot && view.snapshot.worktree && view.snapshot.worktree.lastCommitAt) || 0,
  )
}

/**
 * Build the project report body. Sections keep a fixed order — title, project
 * metadata, status summary, task table, per-task details — so two reports of
 * the same project stay comparable.
 */
export function buildProjectReport(input: ProjectReportInput): string {
  const { project, t, statusLabel } = input
  const now = input.now == null ? Date.now() : input.now
  const views = (input.views || []).slice().sort((a, b) => compareTaskOrder(a.task, b.task))
  const lines: string[] = []

  lines.push(`# ${mdInline(t.projectReportTitle)}`, '')

  lines.push(`- ${t.projectReportProject}: ${mdInline(project.name || '—')}`)
  lines.push(`- ${t.projectReportRepo}: ${mdCodeCell(project.repoPath || '—')}`)
  lines.push(`- ${t.projectReportBase}: ${mdCodeCell(project.baseBranch || '—')}`)
  lines.push(`- ${t.projectReportMergeGate}: ${mdInline(project.mergeGate === 'criteria' ? t.mergeGateCriteria : t.mergeGateOff)}`)
  lines.push(`- ${t.projectReportGeneratedAt}: ${reportTimestamp(now)}`)
  lines.push('')

  lines.push(`## ${t.projectReportSummary}`)
  lines.push(`- ${fill(t.projectReportTotal, { n: views.length })}`)
  const byLabel = new Map<string, number>()
  for (const view of views) {
    const label = String(statusLabel(view) || '—')
    byLabel.set(label, (byLabel.get(label) || 0) + 1)
  }
  for (const [label, count] of byLabel) {
    lines.push(`- ${fill(t.projectReportStatusCount, { status: mdInline(label), n: count })}`)
  }
  lines.push('')

  lines.push(`## ${t.projectReportTasks}`)
  if (!views.length) {
    lines.push(String(t.projectReportEmpty))
    return lines.join('\n') + '\n'
  }
  lines.push(`| ${t.projectReportColNo} | ${t.projectReportColStatus} | ${t.projectReportColTask} | ${t.projectReportColBranch} | ${t.projectReportColProgress} | ${t.projectReportColPriority} | ${t.projectReportColEstimate} | ${t.projectReportColDue} | ${t.projectReportColWork} | ${t.projectReportColBudget} | ${t.projectReportColTags} | ${t.projectReportColActivity} |`)
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  views.forEach((view, index) => {
    const { task, snapshot } = view
    const items = criteria(task, snapshot.status)
    const progress = criteriaProgress(items)
    const tags = Array.isArray(task.tags) && task.tags.length ? task.tags.join(' ') : '—'
    const cells = [
      String(index + 1),
      mdCell(statusLabel(view)),
      mdCell(task.title || '—'),
      mdCodeCell(task.branch || '—'),
      progress.total ? `${progress.checked}/${progress.total}` : '—',
      mdCell(priorityText(t, task.priority)),
      mdCell(estimateText(t, task.estimate)),
      mdCell(dueInputValue(task.dueAt) || '—'),
      mdCell(workText(t, task, now)),
      mdCell(budgetText(t, task, now)),
      mdCell(tags),
      activityAt(view) ? mdCell(reportTimestamp(activityAt(view))) : '—',
    ]
    lines.push('| ' + cells.join(' | ') + ' |')
  })
  lines.push('')

  views.forEach((view, index) => {
    const { task, snapshot } = view
    const items = criteria(task, snapshot.status)
    const recorded = task.notes ? String(task.notes).trim() : ''
    const archived = task.archivedAt ? ` · ${mdInline(t.projectReportArchived)}` : ''
    lines.push(`### ${fill(t.projectReportTaskHead, { n: index + 1, title: mdInline(task.title || '—') })}`)
    lines.push(`- ${t.reportStatus}: ${mdInline(statusLabel(view) || '—')}${archived}`)
    lines.push(`- ${t.reportTaskBranch}: ${mdCodeCell(task.branch || '—')}`)
    lines.push(`- ${t.reportBaseBranch}: ${mdCodeCell(task.baseBranch || '—')}`)
    lines.push(`- ${t.reportDue}: ${mdCell(dueInputValue(task.dueAt) || t.reportDueNone)}`)
    lines.push(`- ${t.taskEstimate}: ${mdCell(estimateText(t, task.estimate))}`)
    lines.push(`- ${t.taskWork}: ${mdCell(workText(t, task, now))}`)
    lines.push(`- ${t.reportBudget}: ${mdCell(budgetText(t, task, now))}`)
    if (task.mergedCommit) lines.push(`- ${t.projectReportMergedCommit}: ${mdCodeCell(task.mergedCommit)}`)
    lines.push(`- ${t.projectReportHead}: ${mdCodeCell(branchHeadSha(task, snapshot) || '—')}`)
    lines.push('')
    if (items.length) {
      for (const item of items) lines.push(`- [${item.checked ? 'x' : ' '}] ${mdInline(item.text)}`)
    } else {
      lines.push(`- ${t.projectReportNoCriteria}`)
    }
    lines.push('')
    if (!recorded) {
      lines.push(`**${t.reportNotes}**: ${mdInline(t.projectReportNoNotes)}`)
    } else if (recorded.includes('\n')) {
      // Notes are free text: keep line breaks instead of collapsing them.
      lines.push(`**${t.reportNotes}**:`)
      lines.push('')
      lines.push(mdBlock(recorded))
    } else {
      lines.push(`**${t.reportNotes}**: ${mdInline(recorded)}`)
    }
    lines.push('')
  })

  return lines.join('\n').replace(/\n+$/, '\n')
}
