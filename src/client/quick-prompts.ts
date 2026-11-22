/**
 * Quick prompt helpers for the live session tab.
 *
 * The chip list and the instruction texts are pure data/string functions so the
 * UI only decides *when* to offer them; tests can assert the exact wording
 * without a DOM.
 */
export type QuickPromptKey = 'continue' | 'tests' | 'summary' | 'commit'

export interface QuickPrompt {
  key: QuickPromptKey
  /** locale key for the chip label */
  label: string
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  { key: 'continue', label: 'quickPromptContinue' },
  { key: 'tests', label: 'quickPromptTests' },
  { key: 'summary', label: 'quickPromptSummary' },
  { key: 'commit', label: 'quickPromptCommit' },
]

/** Build the instruction text; `{title}` is filled with the task title. */
export function quickPromptText(key: QuickPromptKey, task: { title: string }): string {
  const title = String((task && task.title) || '')
  switch (key) {
    case 'continue':
      return `请继续完成「${title}」的剩余工作；开始前先检查当前 diff 与验收标准，完成后按阶段提交。`
    case 'tests':
      return '请运行项目的验证命令，修复失败项并重新验证；不要修改与失败无关的代码。'
    case 'summary':
      return '请总结当前进展：已完成的改动、未完成项、风险与下一步；不要修改代码。'
    case 'commit':
      return '请检查工作区改动，按逻辑分组提交，写清楚每个提交的目的；不要合并或推送分支。'
    default:
      return ''
  }
}

export type QuickPromptBlock = '' | 'no-session' | 'pending' | 'busy'

/**
 * Why sending is blocked right now. A running (but not waiting) session is not
 * blocked: the host queues the prompt, which the UI explains separately.
 */
export function quickPromptDisabledReason(input: {
  hasSession: boolean
  pendingKind?: string
  busy?: boolean
}): QuickPromptBlock {
  if (!input.hasSession) return 'no-session'
  if (input.pendingKind) return 'pending'
  if (input.busy) return 'busy'
  return ''
}

export function quickPromptReasonKey(reason: QuickPromptBlock): string {
  switch (reason) {
    case 'no-session': return 'quickPromptNoSession'
    case 'pending': return 'quickPromptPending'
    case 'busy': return 'quickPromptBusy'
    default: return ''
  }
}
