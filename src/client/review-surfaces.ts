/**
 * Pure helpers for the merge / acceptance surfaces of the task detail panel:
 * the base-sync prompt, the merge-preview risk chip, the post-merge banner and
 * the stale-review warning.
 *
 * Everything here is framework-free so the copy, the caps and the show/hide
 * rules can be unit-tested without a DOM.
 */

/** `busy` key used while a base-sync prompt is being sent. */
export const SYNC_BUSY = 'sync-baseline'

/** How many files the injected sync prompt may list. */
export const SYNC_FILE_LIMIT = 20

/** How many files the merge-check panel may list. */
export const PREVIEW_FILE_LIMIT = 8

export type MergeRiskTone = 'err' | 'warn' | 'neutral'

export interface MergeRiskChip {
  tone: MergeRiskTone
  label: string
}

const asFiles = (value: any): string[] => (Array.isArray(value) ? value.map((v) => String(v)) : [])

/**
 * The files a merge would touch: predicted conflicts win, otherwise the files
 * both sides changed. Returned raw (not trimmed) so callers can cap separately.
 */
export function mergePreviewFiles(preview: any): string[] {
  if (!preview) return []
  const conflicts = asFiles(preview.conflictFiles)
  if (preview.conflict || conflicts.length) return conflicts
  return asFiles(preview.overlapFiles)
}

/** Strip backticks and control characters so a file name cannot break the prompt. */
function cleanFile(name: string): string {
  return String(name == null ? '' : name)
    .replace(/`/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
}

/**
 * Render a bounded file list for display: `a、b…` and `—` when empty.
 * The cap keeps a huge preview from pushing the panel into a wall of text.
 */
export function previewFilesText(files: string[], limit: number = PREVIEW_FILE_LIMIT): string {
  if (!Array.isArray(files) || !files.length) return '—'
  const shown = files.slice(0, limit).map(cleanFile).join('、')
  return shown + (files.length > limit ? '…' : '')
}

/** Same list, but each name is wrapped in backticks for the prompt. */
export function syncFileText(files: string[]): string {
  if (!Array.isArray(files) || !files.length) return '—'
  const shown = files.slice(0, SYNC_FILE_LIMIT).map((f) => '`' + cleanFile(f) + '`').join('、')
  return shown + (files.length > SYNC_FILE_LIMIT ? '…' : '')
}

/**
 * The instruction sent to the session to sync the base branch. File names are
 * quoted and capped so injected text cannot be mistaken for an instruction.
 */
export function syncPromptText(t: any, task: any, files: string[]): string {
  // Function replacements keep `$&` / `$1` in a branch or file name literal.
  return String(t.syncPrompt)
    .replace('{base}', () => String((task && task.baseBranch) || ''))
    .replace('{branch}', () => String((task && task.branch) || ''))
    .replace('{files}', () => syncFileText(files))
}

/** Is there anything for the base-sync action to act on? */
export function syncApplicable(preview: any): boolean {
  if (!preview) return false
  return Number(preview.baseAhead || 0) > 0 || mergePreviewFiles(preview).length > 0
}

/** Did this Git version actually pre-check conflicts? */
export function previewNoCheck(preview: any): boolean {
  return !!preview && (preview.supported === false || preview.checked === false)
}

/**
 * One risk chip for the merge-check panel, by priority:
 * predicted conflict → overlapping files → base simply moved ahead.
 */
export function mergeRiskChip(t: any, preview: any): MergeRiskChip | null {
  if (!preview) return null
  const conflicts = asFiles(preview.conflictFiles).length
  if (preview.conflict) {
    return { tone: 'err', label: String(t.mergePreviewConflict).replace('{n}', String(Math.max(1, conflicts))) }
  }
  const overlap = asFiles(preview.overlapFiles).length
  if (overlap) {
    return { tone: 'warn', label: String(t.mergePreviewOverlap).replace('{n}', String(overlap)) }
  }
  const baseAhead = Number(preview.baseAhead || 0)
  if (baseAhead > 0) {
    return { tone: 'neutral', label: String(t.mergePreviewBaseAhead).replace('{n}', String(baseAhead)) }
  }
  return null
}

/** New unmerged commits recorded after the merge, when there are any. */
export function postMergeCount(snapshot: any): number {
  return Math.max(0, Number((snapshot && snapshot.postMergeAhead) || 0))
}

/**
 * Commits added to the branch after the reviewed commit. Only meaningful while
 * the checkout is pinned for review (`reviewing`); anything else reads 0.
 */
export function reviewStaleCount(status: string, snapshot: any): number {
  if (status !== 'reviewing') return 0
  return Math.max(0, Number((snapshot && snapshot.reviewBehind) || 0))
}
