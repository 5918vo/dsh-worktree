import type { WorktreeTask } from '../models'
import type { PublishDraft } from './publish-state'
import { TASK_ESTIMATES } from '../task-meta'
import { normalizeCriteria } from '../criteria'

/**
 * Duplicate-to-publish helpers.
 *
 * A duplicate is a *publish draft*, not a copy of the record: the title,
 * description, criteria, tags, priority and estimate carry over, while the
 * session, branch, lifecycle state and deadline are deliberately dropped so the
 * copy is reviewed and published like any other new task.
 */

const ESTIMATE_TEXTS: string[] = TASK_ESTIMATES.map(String)

/** Keep only a valid estimate; numbers and numeric strings both count. */
function estimateText(value: any): string {
  const text = String(value == null ? '' : value).trim()
  return ESTIMATE_TEXTS.includes(text) ? text : ''
}

/** One task row as a raw tag string; the publish form parses it on submit. */
function tagsText(values: any): string {
  return Array.isArray(values) ? values.map(String).join(', ') : ''
}

/** Only low/high survive; normal (and anything invalid) reads as normal. */
function priorityText(value: any): string {
  return value === 'low' || value === 'high' ? String(value) : 'normal'
}

/**
 * Build the publish draft for a duplicate. `copySuffix` comes from
 * t.cloneTitleSuffix and is appended once: an already-suffixed title (a copy of
 * a copy) is left alone, and an empty title keeps just the suffix.
 */
export function cloneTaskDraft(task: WorktreeTask, copySuffix: string): PublishDraft {
  const source = (task || {}) as WorktreeTask
  const suffix = String(copySuffix == null ? '' : copySuffix)
  const title = String(source.title == null ? '' : source.title).trim()
  const alreadySuffixed = !!suffix && title.endsWith(suffix)
  return {
    title: alreadySuffixed ? title : title + suffix,
    description: String(source.description == null ? '' : source.description),
    manualCriteria: normalizeCriteria(source.acceptanceCriteria).join('\n'),
    // Library membership is unknown here, so every criterion stays manual
    // instead of being silently checked in the publish form.
    pickedCriteria: [],
    branchName: '',
    tags: tagsText(source.tags),
    priority: priorityText(source.priority),
    // A deadline belongs to the original schedule, not to the new draft.
    dueAt: '',
    estimate: estimateText(source.estimate),
  }
}
