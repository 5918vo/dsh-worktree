import type { CommitLine } from '../gitx.js'
import type { WorktreeTask } from '../models.js'

export interface ParentPromptInfo {
  id: string
  title: string
  branch: string
  mergedCommits: CommitLine[]
  mergedFiles: string[]
  leftoverCommits: CommitLine[]
  leftoverRange?: string
}

function buildParentSection(parent: ParentPromptInfo, baseBranch: string): string[] {
  const lines: string[] = [
    `前序任务（已合并到 ${baseBranch}）：`,
    `- 标题：${parent.title}`,
    `- 分支：${parent.branch}`,
  ]

  if (parent.mergedCommits.length) {
    lines.push('- 已合并的提交：')
    for (const c of parent.mergedCommits) lines.push(`  - ${c.hash} ${c.subject}`)
  } else {
    lines.push('- 已合并的提交：—')
  }

  lines.push(
    `- 改动文件：${parent.mergedFiles.length ? parent.mergedFiles.join('、') : '—'}`,
    '',
    `当前 worktree 基于 ${baseBranch} 创建，已包含上述已合并改动。`,
    '请先阅读相关文件，了解现有实现，再在此基础上完成本次任务；不要重复实现或回退前序改动。',
  )

  if (parent.leftoverCommits.length && parent.leftoverRange) {
    lines.push(
      '',
      `注意：前序分支在合并后又有 ${parent.leftoverCommits.length} 个未合并提交，当前 worktree 尚未包含它们：`,
      ...parent.leftoverCommits.map((c) => `  - ${c.hash} ${c.subject}`),
      '开始开发前，请先把这些提交带入当前分支（在 worktree 内执行）：',
      `  git cherry-pick ${parent.leftoverRange}`,
      '遇到冲突逐个解决；涉及业务取舍时先问我。',
    )
  }

  return lines
}

export function buildFirstPrompt(task: WorktreeTask, parent?: ParentPromptInfo): string {
  const sections: string[] = [
    '这是一个 git worktree 任务。',
    '',
    `任务：${task.title}`,
    `描述：${task.description.trim()}`,
    '',
  ]

  if (parent) {
    sections.push(...buildParentSection(parent, task.baseBranch), '')
  }

  if (task.acceptanceCriteria?.length) {
    sections.push(
      '验收标准：',
      ...task.acceptanceCriteria.map((item) => `- ${item}`),
      '结束前逐条说明是否满足，未满足的说明原因。',
      '',
    )
  }

  sections.push(
    '环境：',
    `- worktree：${task.worktreePath}`,
    `  分支 ${task.branch}，基于 ${task.baseBranch} ← 所有开发都在这里进行`,
    `- 主仓库：${task.repoPath}（只读，不要修改其中任何文件）`,
    '',
    '开始前：',
    '1. 如果当前目录不是上面的 worktree，用 working_directory 工具切换过去。',
    '2. 运行 git rev-parse --show-toplevel 和 git branch --show-current，确认路径和分支正确；不一致时停下并告诉我。',
    '',
    '开发要求：',
    '- 文件读写优先使用 worktree 内的绝对路径。',
    '- 按阶段 commit，提交信息写清楚改了什么、为什么改。',
    `- 不要切换分支、rebase、push、fetch/pull，不要删除 worktree；验收和合并回 ${task.baseBranch} 由工作台完成。`,
    `- 不要主动同步基线。即使发现 ${task.baseBranch} 有新提交，也只在总结里说明。`,
    '- 遇到需求不明确或需要取舍时，直接问我。',
    '',
    '同步基线（仅在我明确要求时执行）：',
    `- 在 worktree 内执行 git merge ${task.baseBranch}（使用本地分支，不 rebase）。`,
    '- 有冲突时逐个解决；涉及业务取舍先列出冲突并问我。',
    '- 解决后运行验证（如 npm run typecheck / npm run build），通过后再提交合并；无法完成则 git merge --abort 恢复原状。',
    '',
    '完成后总结：',
    '- 改动的文件和要点',
    '- 提交列表',
    '- 运行过的验证及结果',
    '- 如果同步过基线：同步到的基线提交、冲突文件及解决方式',
    '- 没验证的部分和遗留风险',
  )

  return sections.join('\n')
}
