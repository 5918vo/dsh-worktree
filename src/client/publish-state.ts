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
