/**
 * Task prompt construction, branch/model validation, and shared text helpers.
 */

import { ModelSelection, WorktreeTask } from '../models.js'
import { ParentPromptInfo, TaskError } from './types.js'

/** Files named by git's conflict output, deduplicated. */
export function conflictFiles(text: string): string[] {
  const files = new Set<string>()
  for (const match of text.matchAll(/Merge conflict in ([^\r\n]+)/g)) files.add(match[1].trim())
  for (const match of text.matchAll(/CONFLICT \([^)]*\):\s*(.+?)\s+(?:deleted|modified) in/gi)) files.add(match[1].trim())
  return [...files]
}

export function id8(id: string): string {
  return id.replace(/-/g, '').slice(0, 8)
}

export function assertTaskBranchName(name: string): void {
  const valid = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(name)
  if (!valid || name.includes('..') || name.includes('@{') || name.endsWith('/') || name.endsWith('.') || name.endsWith('.lock')) {
    throw new TaskError('任务分支只能使用英文、数字、点、下划线和斜杠')
  }
}

/** Trim and validate a client-supplied model route; undefined when unusable. */
export function normalizeModelSelection(value: unknown): ModelSelection | undefined {
  if (!value || typeof value !== 'object') return undefined
  const rec = value as Record<string, unknown>
  const provider = typeof rec.provider === 'string' ? rec.provider.trim() : ''
  const model = typeof rec.model === 'string' ? rec.model.trim() : ''
  if (!provider || !model) return undefined
  const reasoningEffort = typeof rec.reasoningEffort === 'string' && rec.reasoningEffort.trim()
    ? rec.reasoningEffort.trim()
    : undefined
  return { provider, model, ...(reasoningEffort ? { reasoningEffort } : {}) }
}

function parentPromptLines(parent: ParentPromptInfo, baseBranch: string): string[] {
  const lines: string[] = []
  lines.push(`前序任务（已合并到 ${baseBranch}）：`)
  lines.push(`- 标题：${parent.title}`)
  lines.push(`- 分支：${parent.branch}`)
  if (parent.mergedCommits.length) {
    lines.push('- 已合并的提交：')
    for (const commit of parent.mergedCommits) lines.push(`  - ${commit.hash} ${commit.subject}`)
  } else {
    lines.push('- 已合并的提交：—')
  }
  lines.push(`- 改动文件：${parent.mergedFiles.length ? parent.mergedFiles.join('、') : '—'}`)
  lines.push('')
  lines.push(`当前 worktree 基于 ${baseBranch} 创建，已包含上述已合并改动。`)
  lines.push('请先阅读相关文件，了解现有实现，再在此基础上完成本次任务；不要重复实现或回退前序改动。')
  if (parent.leftoverCommits.length && parent.leftoverRange) {
    lines.push('')
    lines.push(`注意：前序分支在合并后又有 ${parent.leftoverCommits.length} 个未合并提交，当前 worktree 尚未包含它们：`)
    for (const commit of parent.leftoverCommits) lines.push(`  - ${commit.hash} ${commit.subject}`)
    lines.push('开始开发前，请先把这些提交带入当前分支（在 worktree 内执行）：')
    lines.push(`  git cherry-pick ${parent.leftoverRange}`)
    lines.push('遇到冲突逐个解决；涉及业务取舍时先问我。')
  }
  return lines
}

export function buildFirstPrompt(task: WorktreeTask, parent?: ParentPromptInfo): string {
  const lines = [
    '这是一个 git worktree 任务。',
    '',
    `任务：${task.title}`,
    `描述：${task.description.trim()}`,
    '',
  ]
  if (parent) {
    lines.push(...parentPromptLines(parent, task.baseBranch))
    lines.push('')
  }
  if (task.acceptanceCriteria && task.acceptanceCriteria.length) {
    lines.push('验收标准：')
    for (const item of task.acceptanceCriteria) lines.push(`- ${item}`)
    lines.push('结束前逐条说明是否满足，未满足的说明原因。')
    lines.push('')
  }
  lines.push(
    '环境：',
    `- worktree：${task.worktreePath}`,
    `  分支 ${task.branch}，基于 ${task.baseBranch} ← 所有开发都在这里进行`,
    `- 主仓库：${task.repoPath}（只读，不要修改其中任何文件）`,
    '',
    '开始前：',
    '1. 如果当前目录不是上面的 worktree，用 working_directory 工具切换过去。',
    '2. 运行 git rev-parse --show-toplevel 和 git branch --show-current，',
    '   确认路径和分支正确；不一致时停下并告诉我。',
    '',
    '开发要求：',
    '- 文件读写优先使用 worktree 内的绝对路径。',
    '- 按阶段 commit，提交信息写清楚改了什么、为什么改。',
    '- 不要切换分支、rebase、push、fetch/pull，不要删除 worktree；',
    `  验收和合并回 ${task.baseBranch} 由工作台完成。`,
    `- 不要主动同步基线。即使发现 ${task.baseBranch} 有新提交，也只在总结里说明。`,
    '- 遇到需求不明确或需要取舍时，直接问我。',
    '',
    '同步基线（仅在我明确要求时执行）：',
    `- 在 worktree 内执行 git merge ${task.baseBranch}（使用本地分支，不 rebase）。`,
    '- 有冲突时逐个解决；如果涉及业务取舍，先列出冲突并问我。',
    '- 解决后运行验证（例如 npm run typecheck / npm run build），通过后再提交合并。',
    '- 如果无法完成，执行 git merge --abort 恢复原状，并说明原因。',
    '',
    '完成后总结：',
    '- 改动的文件和要点',
    '- 提交列表',
    '- 运行过的验证及结果',
    '- 如果同步过基线：同步到的基线提交、冲突文件及解决方式',
    '- 没验证的部分和遗留风险',
  )
  return lines.join('\n')
}
