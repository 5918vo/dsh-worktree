import { App } from './app.js'
import { Json } from './types.js'
import { TaskError } from './runtime.js'

function outDef(): { schema: Record<string, unknown>; render: (a: unknown, v: Json) => Array<{ type: 'text'; text: string }> } {
  return {
    schema: { type: 'object', additionalProperties: true },
    render(_args: unknown, value: Json) {
      let text: string
      try {
        text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      } catch {
        text = String(value)
      }
      if (text.length > 12000) text = text.slice(0, 12000) + '…[truncated]'
      return [{ type: 'text', text }]
    },
  }
}

function clean(value: unknown): Json {
  try {
    return JSON.parse(JSON.stringify(value)) as Json
  } catch {
    return { error: 'unserializable result' }
  }
}

function brief(v: { task: { id: string; title: string; repoPath: string; baseBranch: string; branch: string; worktreePath: string; sessionId: string | null; parentId?: string }; snapshot: { status: string; worktree: { ahead: number; dirtyCount: number }; repo: { currentBranch: string | null }; postMergeAhead?: number } }) {
  return {
    id: v.task.id,
    title: v.task.title,
    repoPath: v.task.repoPath,
    baseBranch: v.task.baseBranch,
    branch: v.task.branch,
    worktreePath: v.task.worktreePath,
    sessionId: v.task.sessionId,
    parentId: v.task.parentId || null,
    status: v.snapshot.status,
    ahead: v.snapshot.worktree.ahead,
    dirtyWorktree: v.snapshot.worktree.dirtyCount,
    mainRepoBranch: v.snapshot.repo.currentBranch,
    postMergeAhead: v.snapshot.postMergeAhead || 0,
  }
}

export function registerTools(app: App): () => void {
  return app.ctx.inject(['tools'], (host: any) => {
    const tools = host.tools as { register(def: any, opts?: any): () => void }
    const offs: Array<() => void> = []
    const reg = (def: any) => offs.push(tools.register(def, { when: () => true }))

    reg({
      name: 'worktree_publish',
      description:
        'Publish a git-worktree task: create a worktree + task branch from a base branch in the target repo, record it on the workbench board. Pass project_id to pin it to a registered project (inherits repo path and default base branch); otherwise the repo is auto-registered. Pass parent_id to derive a follow-up task from an already-merged task (the predecessor must be merged into the base). The user (or the workbench) binds a DSH session to the worktree; the session does the actual development.',
      output: outDef(),
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string', description: 'Registered project id from worktree_projects. Omit when passing repository.' },
          repository: { type: 'string', description: 'Absolute path of the target git repo working tree (required when project_id is omitted).' },
          base_branch: { type: 'string', description: 'Base branch. Defaults to the project base or the repo current branch.' },
          title: { type: 'string', description: 'Short task title.' },
          task: { type: 'string', description: 'Full task description for the session that will develop it.' },
          branch_name: { type: 'string', description: 'Optional task branch name; auto-generated when omitted.' },
          parent_id: { type: 'string', description: 'Optional id of an already-merged task to continue from; creates a follow-up task on a new branch of the base.' },
          start: { type: 'boolean', description: 'Auto-start the bound session with the task prompt (default true).' },
        },
        required: ['title', 'task'],
      },
      async execute(args: any) {
        try {
          if (!args.project_id && !args.repository) return clean({ ok: false, error: 'project_id 或 repository 至少提供一个' })
          const task = await app.runtime.publish({
            projectId: args.project_id ? String(args.project_id) : undefined,
            repoPath: args.repository ? String(args.repository) : undefined,
            baseBranch: args.base_branch ? String(args.base_branch) : undefined,
            title: String(args.title || ''),
            description: String(args.task || ''),
            branchName: args.branch_name ? String(args.branch_name) : undefined,
            parentId: args.parent_id ? String(args.parent_id) : undefined,
            start: args.start === false ? false : true,
          })
          return clean({
            ok: true,
            taskId: task.id,
            projectId: task.projectId,
            parentId: task.parentId || null,
            worktreePath: task.worktreePath,
            branch: task.branch,
            baseBranch: task.baseBranch,
            note: '任务已上工作台；工作台打开时会自动创建绑定该 worktree 的会话并开始开发。',
          })
        } catch (error) {
          return clean({ ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    })

    reg({
      name: 'worktree_projects',
      description: 'List registered worktree projects (target repos) with their default base branch and task counts.',
      output: outDef(),
      parameters: { type: 'object', properties: {} },
      async execute() {
        const views = await app.runtime.projectViews()
        return clean({
          projects: views.map((v) => ({
            id: v.project.id,
            name: v.project.name,
            repoPath: v.project.repoPath,
            baseBranch: v.project.baseBranch,
            tasks: v.stats.tasks,
            byStatus: v.stats.byStatus,
          })),
        })
      },
    })

    reg({
      name: 'worktree_tasks',
      description: 'List published worktree tasks with their git-derived status (ahead commits, dirty state, review/merged state).',
      output: outDef(),
      parameters: { type: 'object', properties: {} },
      async execute() {
        const views = await app.runtime.views()
        return clean({ tasks: views.map(brief) })
      },
    })

    reg({
      name: 'worktree_act',
      description:
        'Act on a worktree task: checkout (switch the main repo to the task branch for acceptance), back (switch back to the recorded original branch), merge (merge --no-ff into the base branch), cleanup (remove the worktree, optionally delete the branch), delete (remove the record).',
      output: outDef(),
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Task id from worktree_tasks.' },
          action: { type: 'string', enum: ['checkout', 'back', 'merge', 'cleanup', 'delete'], description: 'Operation.' },
          force: { type: 'boolean', description: 'For cleanup: remove even with uncommitted changes.' },
          delete_branch: { type: 'boolean', description: 'For cleanup: also delete the task branch.' },
        },
        required: ['id', 'action'],
      },
      async execute(args: any) {
        const id = String(args.id || '')
        const action = String(args.action || '')
        try {
          if (action === 'checkout') return clean({ ok: true, task: brief(await app.runtime.view(await app.runtime.checkout(id))) })
          if (action === 'back') return clean({ ok: true, task: brief(await app.runtime.view(await app.runtime.back(id))) })
          if (action === 'merge') return clean({ ok: true, task: brief(await app.runtime.view(await app.runtime.merge(id))) })
          if (action === 'cleanup') {
            const t = await app.runtime.cleanup(id, { force: !!args.force, deleteBranch: !!args.delete_branch })
            return clean({ ok: true, task: brief(await app.runtime.view(t)) })
          }
          if (action === 'delete') {
            app.runtime.delete(id)
            return clean({ ok: true })
          }
          return clean({ ok: false, error: `unknown action ${action}` })
        } catch (error) {
          return clean({ ok: false, error: error instanceof TaskError || error instanceof Error ? error.message : String(error) })
        }
      },
    })

    return () => {
      for (const off of offs) {
        try {
          off()
        } catch {
          /* noop */
        }
      }
    }
  })
}
