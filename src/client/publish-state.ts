import type { TaskTemplate } from '../models'
import { TASK_ESTIMATES } from '../task-meta'

/**
 * Pure helpers for the publish modal's in-session draft and for reconciling a
 * publish whose result was unknown (timeout) with the refreshed task list.
 *
 * The draft never leaves the workbench session: it lives in board state and is
 * dropped on a full page reload, matching the 1.7.0 behaviour.
 */

export interface PublishDraft {
  title: string
  description: string
  manualCriteria: string
  pickedCriteria: string[]
  branchName: string
  /** Raw tag text; parsed only on submit so typing stays untouched. */
  tags: string
  /** One of '', 'low', 'normal', 'high'; '' means the untouched default. */
  priority: string
  /** `YYYY-MM-DD` from the date input; '' means no deadline. */
  dueAt: string
  /** One of '', '1', '2', '3', '5', '8'; '' means unestimated. */
  estimate: string
}

/** Estimate choices rendered by the publish select; '' (unestimated) is separate. */
export const ESTIMATE_OPTIONS: string[] = TASK_ESTIMATES.map(String)

/** Keep only a valid estimate; anything else reads as unestimated. */
function estimateText(value: any): string {
  const text = String(value == null ? '' : value).trim()
  return ESTIMATE_OPTIONS.includes(text) ? text : ''
}

export interface PublishCheckInfo {
  projectId?: string
  branchName?: string
  title?: string
}

/** Initial form values, seeded from a draft when one exists. */
export function initialPublishForm(draft?: any, fallbackTitle = ''): PublishDraft {
  const d = draft || {}
  return {
    // An explicit empty draft title (the user cleared it) must win over the
    // continuation default; only a missing key falls back.
    title: d.title !== undefined ? String(d.title) : String(fallbackTitle || ''),
    description: String(d.description || ''),
    manualCriteria: String(d.manualCriteria || ''),
    pickedCriteria: Array.isArray(d.pickedCriteria) ? d.pickedCriteria.map(String) : [],
    branchName: String(d.branchName || ''),
    tags: String(d.tags || ''),
    priority: d.priority === 'low' || d.priority === 'high' ? String(d.priority) : 'normal',
    dueAt: String(d.dueAt || ''),
    estimate: estimateText(d.estimate),
  }
}

/** Order-insensitive key for the picked criteria set. */
function criteriaKey(list: any): string {
  const items = Array.isArray(list) ? list.map(String) : []
  return items.slice().sort().join('\u0000')
}

/** Whether the form differs from the values it was opened with. */
export function publishDraftDirty(initial: PublishDraft, current: PublishDraft): boolean {
  if (!initial || !current) return false
  return initial.title !== current.title
    || initial.description !== current.description
    || initial.manualCriteria !== current.manualCriteria
    || criteriaKey(initial.pickedCriteria) !== criteriaKey(current.pickedCriteria)
    || initial.branchName !== current.branchName
    || initial.tags !== current.tags
    || initial.priority !== current.priority
    || initial.dueAt !== current.dueAt
    || initial.estimate !== current.estimate
}

/**
 * Find a published task after an unknown-result timeout. A branch name is the
 * strongest signal (the backend may decorate/suffix nothing, but a typed branch
 * is exact); the title is the fallback when no branch was supplied or the
 * branch is not in the list yet.
 */
export function findPublishedTask<T extends { branch?: string | null; title?: string | null }>(
  tasks: T[] | null | undefined,
  info: PublishCheckInfo | null | undefined,
): T | null {
  const list = Array.isArray(tasks) ? tasks : []
  const branch = info && info.branchName ? String(info.branchName).trim() : ''
  const title = info && info.title ? String(info.title).trim() : ''
  if (branch) {
    const byBranch = list.find((task) => task && String(task.branch || '').trim() === branch)
    if (byBranch) return byBranch
  }
  if (title) {
    const byTitle = list.find((task) => task && String(task.title || '').trim() === title)
    if (byTitle) return byTitle
  }
  return null
}

/**
 * Fill the publish form from a saved template.
 *
 * Template criteria that exist in the global library become checkbox picks; the
 * rest go to the manual textarea so nothing is silently dropped. The template
 * intentionally carries no project/base/branch: choosing one must never move a
 * task to another branch.
 */
export function applyPublishTemplate(
  template: TaskTemplate,
  library: string[],
): { title: string; description: string; picked: string[]; manual: string } {
  const known = (Array.isArray(library) ? library : []).map(String)
  const items = (template && Array.isArray(template.criteria) ? template.criteria : []).map(String)
  return {
    title: String((template && template.title) || ''),
    description: String((template && template.description) || ''),
    picked: items.filter((item) => known.includes(item)),
    manual: items.filter((item) => !known.includes(item)).join('\n'),
  }
}

/** Trunk names that a task should normally branch from. */
const TRUNK = /^(main|master|develop|development|trunk|dev)$/i

/** `git branch` prints detached HEAD as `(HEAD detached at <sha>)`. */
export function isDetachedBranchLabel(name: string): boolean {
  return /^\(.*\)$/.test(String(name || '').trim())
}

export interface BranchChoices {
  /** Branches to show by default: trunks plus the currently selected base. */
  primary: string[]
  /** Task branches / everything else, hidden behind "show all". */
  rest: string[]
}

/**
 * Split a raw branch list into trunks and the rest. Task branches
 * (`dsh-wt/<id>`) and git's detached-HEAD pseudo entry never belong in the
 * default base picker; the current base always stays visible.
 */
export function branchChoices(names: any, base = ''): BranchChoices {
  const list = Array.isArray(names) ? names.map(String).filter(Boolean) : []
  const primary: string[] = []
  const rest: string[] = []
  const chosen = String(base || '').trim()
  for (const name of list) {
    if (isDetachedBranchLabel(name)) continue
    if (TRUNK.test(name) || name === chosen) primary.push(name)
    else rest.push(name)
  }
  // The base may be missing from the list (deleted/filtered): keep a slot for
  // it so the select cannot silently show a different branch.
  if (chosen && !primary.includes(chosen) && !rest.includes(chosen)) primary.unshift(chosen)
  return { primary, rest }
}
