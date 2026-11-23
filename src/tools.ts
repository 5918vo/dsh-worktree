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

function brief(v: { task: { id: string; title: string; repoPath: string; baseBranch: string; branch: string; worktreePath: string; sessionId: string | null; parentId?: string; tags?: string[]; priority?: string; notes?: string; dependsOn?: string[]; dueAt?: number; estimate?: number; acceptanceCriteria?: string[] }; snapshot: { status: string; worktree: { ahead: number; dirtyCount: number }; repo: { currentBranch: string | null }; postMergeAhead?: number } }) {
  return {
    id: v.task.id,
    title: v.task.title,
    repoPath: v.task.repoPath,
    baseBranch: v.task.baseBranch,
    branch: v.task.branch,
    worktreePath: v.task.worktreePath,
    sessionId: v.task.sessionId,
    parentId: v.task.parentId || null,
    tags: Array.isArray(v.task.tags) ? v.task.tags : [],
    priority: v.task.priority || 'normal',
    notes: v.task.notes || '',
    dependsOn: Array.isArray(v.task.dependsOn) ? v.task.dependsOn : [],
    dueAt: Number(v.task.dueAt) || 0,
    estimate: Number(v.task.estimate) || 0,
    acceptanceCriteria: Array.isArray(v.task.acceptanceCriteria) ? v.task.acceptanceCriteria : [],
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
          carry_leftover: { type: 'boolean', description: 'When continuing: also migrate commits added to the old branch after its merge (default false).' },
          start: { type: 'boolean', description: 'Auto-start the bound session with the task prompt (default true).' },
          acceptance_criteria: { type: 'array', items: { type: 'string' }, description: 'Optional acceptance criteria, one checkable result per item.' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Optional free-form tags (max 8, 24 chars each).' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'], description: 'Optional display priority (default normal).' },
          due_at: { type: ['string', 'number'], description: 'Optional deadline as YYYY-MM-DD or epoch milliseconds (normalized to a local calendar day; overdue tasks are flagged on the board).' },
          estimate: { type: ['string', 'number'], enum: [1, 2, 3, 5, 8], description: 'Optional relative size in points: 1, 2, 3, 5 or 8.' },
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
            carryLeftover: args.carry_leftover === true,
            start: args.start === false ? false : true,
            acceptanceCriteria: Array.isArray(args.acceptance_criteria) ? args.acceptance_criteria.map(String) : undefined,
            tags: Array.isArray(args.tags) ? args.tags.map(String) : undefined,
            priority: args.priority !== undefined ? String(args.priority) : undefined,
            dueAt: args.due_at !== undefined ? args.due_at : undefined,
            estimate: args.estimate !== undefined ? args.estimate : undefined,
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
        'Act on a worktree task: checkout (switch the main repo to the task branch for acceptance), back (switch back to the recorded original branch), merge (merge --no-ff into the base branch), cleanup (remove the worktree, optionally delete the branch), archive (hide a merged/cleaned task from the board default list), unarchive (restore it), pin/unpin (pin the task to the top of the rail), delete (remove the record).',
      output: outDef(),
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Task id from worktree_tasks.' },
          action: { type: 'string', enum: ['checkout', 'back', 'merge', 'merge-preflight', 'cleanup', 'archive', 'unarchive', 'pin', 'unpin', 'meta', 'delete'], description: 'Operation.' },
          force: { type: 'boolean', description: 'For cleanup: remove even with uncommitted changes.' },
          delete_branch: { type: 'boolean', description: 'For cleanup: also delete the task branch.' },
          force_delete_branch: { type: 'boolean', description: 'For cleanup: delete an unmerged branch (data loss).' },
          switch_to_base: { type: 'boolean', description: 'For merge: check out the base branch first when the main repo is on another branch.' },
          restore_to: { type: 'boolean', description: 'For merge: switch back to the previous branch after merging (default true).' },
          restore_after: { type: 'boolean', description: 'For merge: alias of restore_to.' },
          expected_tip: { type: 'string', description: 'For merge: task branch tip SHA captured by a preflight (required for safety).' },
          expected_base: { type: 'string', description: 'For merge: base branch SHA captured by a preflight (required for safety).' },
          dirty_strategy: { type: 'string', enum: ['refuse', 'stash'], description: 'For merge: refuse (default) or stash when repo changes block switching.' },
          tags: { type: 'array', items: { type: 'string' }, description: 'For meta: replace the tag list (max 8, 24 chars each; [] clears).' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'], description: 'For meta: set the priority; normal clears it.' },
          notes: { type: 'string', description: 'For meta: set acceptance/handover notes (max 2000 chars; empty clears).' },
          depends_on: { type: 'array', items: { type: 'string' }, description: 'For meta: replace the prerequisite task ids (same project, max 8; [] clears).' },
          due_at: { type: ['string', 'number', 'null'], description: 'For meta: set the deadline as YYYY-MM-DD or epoch milliseconds; empty or null clears it.' },
          estimate: { type: ['string', 'number', 'null'], enum: [1, 2, 3, 5, 8, null], description: 'For meta: set the size estimate in points (1, 2, 3, 5 or 8); null or an empty string clears it.' },
        },
        required: ['id', 'action'],
      },
      async execute(args: any) {
        const id = String(args.id || '')
        const action = String(args.action || '')
        try {
          if (action === 'checkout') return clean({ ok: true, task: brief(await app.runtime.view(await app.runtime.checkout(id))) })
          if (action === 'back') return clean({ ok: true, task: brief(await app.runtime.view(await app.runtime.back(id))) })
          if (action === 'pin' || action === 'unpin') {
            return clean({ ok: true, task: brief(await app.runtime.view(app.runtime.setTaskPinned(id, action === 'pin'))) })
          }
          if (action === 'meta') {
            // Only keys the caller actually sent are patched; omitting a field
            // must never clear it.
            const patch: any = {}
            for (const key of ['tags', 'priority', 'notes']) {
              if (Object.prototype.hasOwnProperty.call(args, key) && args[key] !== undefined) patch[key] = args[key]
            }
            if (Object.prototype.hasOwnProperty.call(args, 'depends_on') && args.depends_on !== undefined) {
              patch.dependsOn = args.depends_on
            }
            if (Object.prototype.hasOwnProperty.call(args, 'due_at') && args.due_at !== undefined) patch.dueAt = args.due_at
            if (Object.prototype.hasOwnProperty.call(args, 'estimate') && args.estimate !== undefined) patch.estimate = args.estimate
            return clean({ ok: true, task: brief(await app.runtime.view(app.runtime.updateTaskMeta(id, patch))) })
          }
          if (action === 'merge-preflight') {
            return clean({ ok: true, preflight: await app.runtime.mergePreflight(id, { switchToBase: args.switch_to_base === true }) })
          }
          if (action === 'merge') {
            const opts: any = {
              switchToBase: args.switch_to_base === true,
              restoreAfter: args.restore_after !== undefined ? args.restore_after === true : args.restore_to !== false,
              dirtyStrategy: args.dirty_strategy === 'stash' ? 'stash' : 'refuse',
              expectedTip: args.expected_tip ? String(args.expected_tip) : undefined,
              expectedBase: args.expected_base ? String(args.expected_base) : undefined,
            }
            // Tools may omit the SHAs; derive them from a preflight (same checks).
            if (!opts.expectedTip || !opts.expectedBase) {
              const pf = await app.runtime.mergePreflight(id, { switchToBase: opts.switchToBase })
              const hard = pf.blockers.filter((b) => b.code !== 'dirty-blocks-switch')
              if (hard.length) throw new TaskError(hard.map((b) => b.message).join('；'), 409, hard[0]!.code)
              if (pf.blockers.some((b) => b.code === 'dirty-blocks-switch') && opts.dirtyStrategy !== 'stash') {
                throw new TaskError(pf.blockers.find((b) => b.code === 'dirty-blocks-switch')!.message, 409, 'dirty-blocks-switch')
              }
              opts.expectedTip = opts.expectedTip || pf.tipSha
              opts.expectedBase = opts.expectedBase || pf.baseSha
            }
            return clean({ ok: true, task: brief(await app.runtime.view(await app.runtime.merge(id, opts))) })
          }
          if (action === 'cleanup') {
            const t = await app.runtime.cleanup(id, { force: !!args.force, deleteBranch: !!args.delete_branch, forceDeleteBranch: !!args.force_delete_branch })
            return clean({ ok: true, task: brief(await app.runtime.view(t)) })
          }
          if (action === 'archive') return clean({ ok: true, task: brief(await app.runtime.view(await app.runtime.archive(id))) })
          if (action === 'unarchive') return clean({ ok: true, task: brief(await app.runtime.view(app.runtime.unarchive(id))) })
          if (action === 'delete') {
            await app.runtime.delete(id)
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
