import { randomBytes } from 'node:crypto'
import { App } from './app.js'
import { TaskError } from './runtime.js'

const PREFIX = '/dsh-worktree/api'
const MAX_BODY = 64 * 1024
const BOARD_CLIENT = 'worktree-board'

interface RouteDef {
  kind: 'exact'
  path: string
  handler: (req: any, res: any) => void | Promise<void>
}

function header(req: any, name: string): string | undefined {
  const v = req.headers?.[name]
  return Array.isArray(v) ? v[0] : v
}

function readJson(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const type = String(header(req, 'content-type') || '').toLowerCase()
    if (!type.includes('application/json')) {
      reject(Object.assign(new Error('json required'), { status: 415 }))
      return
    }
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('too large'), { status: 413 }))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch {
        reject(Object.assign(new Error('bad json'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

function send(res: any, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

export function registerHttp(app: App): () => void {
  const table = new Map<string, Map<string, (req: any, res: any) => void | Promise<void>>>()

  const trusted = (req: any): boolean => {
    if ((header(req, 'sec-fetch-site') || '').toLowerCase() === 'cross-site') return false
    const origin = header(req, 'origin')
    if (origin === undefined) return true
    try {
      return new URL(origin).host === header(req, 'host')
    } catch {
      return false
    }
  }
  const requireToken = (req: any): void => {
    const token = header(req, 'x-dsh-worktree-token')
    if (!token || !app.tokens.has(token)) throw Object.assign(new Error('bad token'), { status: 403, code: 'bad-token' })
  }
  const q = (req: any, name: string): string => {
    try {
      return new URL(req.url, 'http://localhost').searchParams.get(name) || ''
    } catch {
      return ''
    }
  }

  const route = (path: string, method: string, handler: (req: any, res: any) => void | Promise<void>) => {
    let m = table.get(path)
    if (!m) {
      m = new Map()
      table.set(path, m)
    }
    m.set(method, handler)
  }

  const mintBoardToken = (clientId: string, res: any) => {
    // The board is a global page, not a session dock: one client key is enough.
    if (clientId !== BOARD_CLIENT) return send(res, 403, { error: 'unknown client' })
    const token = randomBytes(24).toString('hex')
    app.tokens.set(token, clientId)
    send(res, 200, { token })
  }

  route('session', 'POST', async (req, res) => {
    const body = await readJson(req)
    mintBoardToken(String(body.sessionId || BOARD_CLIENT), res)
  })

  // Compatibility: the client always POSTs, but hosts that prefetch a panel's
  // endpoint with GET got a 405 here. Minting is idempotent, so answer both.
  route('session', 'GET', async (req, res) => {
    mintBoardToken(q(req, 'sessionId') || BOARD_CLIENT, res)
  })

  route('config', 'GET', async (_req, res) => send(res, 200, { config: app.config, environment: await app.runtime.environment() }))

  route('recents', 'GET', async (_req, res) => send(res, 200, { dirs: app.store.listRecents() }))
  route('recents/clear', 'POST', async (_req, res) => {
    app.store.clearRecents()
    send(res, 200, { ok: true })
  })

  route('acceptance-criteria', 'GET', async (_req, res) => send(res, 200, { items: app.runtime.listAcceptanceCriteria() }))
  route('acceptance-criteria/add', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      const items = app.runtime.addAcceptanceCriteria(Array.isArray(body.items) ? body.items.map(String) : [String(body.text || '')])
      send(res, 200, { items })
    } catch (error) {
      send(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  })
  route('acceptance-criteria/delete', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      send(res, 200, { items: app.runtime.removeAcceptanceCriterion(String(body.text || '')) })
    } catch (error) {
      send(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  })
  route('acceptance-criteria/set', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      send(res, 200, { items: app.runtime.setAcceptanceCriteria(Array.isArray(body.items) ? body.items.map(String) : []) })
    } catch (error) {
      send(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('templates', 'GET', async (_req, res) => send(res, 200, { templates: app.runtime.listTaskTemplates() }))
  route('templates/save', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      send(res, 200, {
        templates: app.runtime.saveTaskTemplate({
          id: body.id === undefined ? undefined : String(body.id),
          name: String(body.name || ''),
          title: body.title === undefined ? undefined : String(body.title),
          description: body.description === undefined ? undefined : String(body.description),
          criteria: Array.isArray(body.criteria) ? body.criteria.map(String) : undefined,
        }),
      })
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message, ...(error.code ? { code: error.code } : {}) })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })
  route('templates/delete', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    send(res, 200, { templates: app.runtime.deleteTaskTemplate(String(body.id || '')) })
  })

  route('branches', 'GET', async (req, res) => {
    const dir = q(req, 'path')
    if (!dir) return send(res, 400, { error: 'path required' })
    try {
      const info = await app.runtime.branches(dir)
      send(res, 200, info)
    } catch (error) {
      send(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('publish', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      const task = await app.runtime.publish({
        projectId: body.projectId ? String(body.projectId) : undefined,
        repoPath: body.repoPath ? String(body.repoPath) : undefined,
        baseBranch: body.baseBranch ? String(body.baseBranch) : undefined,
        title: String(body.title || ''),
        description: String(body.description || ''),
        branchName: body.branchName ? String(body.branchName) : undefined,
        parentId: body.parentId ? String(body.parentId) : undefined,
        carryLeftover: body.carryLeftover === true,
        start: body.start !== false,
        autoBind: false,
        model: body.model && typeof body.model === 'object' ? body.model : undefined,
        acceptanceCriteria: Array.isArray(body.acceptanceCriteria) ? body.acceptanceCriteria.map(String) : undefined,
      })
      send(res, 200, { task })
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('projects', 'GET', async (req, res) => {
    requireToken(req)
    const includeArchived = q(req, 'includeArchived') === '1'
    const views = await app.runtime.projectViews({ includeArchived })
    send(res, 200, { projects: views })
  })

  route('projects/add', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      const project = await app.runtime.addProject({
        repoPath: String(body.repoPath || ''),
        name: body.name ? String(body.name) : undefined,
        baseBranch: body.baseBranch ? String(body.baseBranch) : undefined,
        dirName: body.dirName ? String(body.dirName) : undefined,
        branchPrefix: body.branchPrefix ? String(body.branchPrefix) : undefined,
      })
      send(res, 200, { project })
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('projects/update', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      const project = await app.runtime.updateProject(String(body.id || ''), {
        name: body.name === undefined ? undefined : String(body.name),
        baseBranch: body.baseBranch === undefined ? undefined : String(body.baseBranch),
        dirName: body.dirName === undefined ? undefined : String(body.dirName),
        branchPrefix: body.branchPrefix === undefined ? undefined : String(body.branchPrefix),
        mergeGate: body.mergeGate === undefined ? undefined : String(body.mergeGate) as 'off' | 'criteria',
      })
      send(res, 200, { project })
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('projects/delete', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      send(res, 200, await app.runtime.deleteProject(String(body.id || ''), {
        withTasks: !!body.withTasks,
        withWorktrees: body.withWorktrees === undefined ? true : !!body.withWorktrees,
      }))
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('tasks', 'GET', async (req, res) => {
    requireToken(req)
    const includeArchived = q(req, 'includeArchived') === '1'
    const views = await app.runtime.views({ includeArchived })
    send(res, 200, { tasks: views })
  })

  // Per-file diff for the review screen. Read-only, so it stays on GET with an
  // id query param alongside the other board reads.
  route('task/diff', 'GET', async (req, res) => {
    requireToken(req)
    const id = q(req, 'id')
    if (!id) return send(res, 400, { error: 'id required' })
    try {
      send(res, 200, { diff: await app.runtime.diff(id) })
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('task/stash-diff', 'GET', async (req, res) => {
    requireToken(req)
    const id = q(req, 'id')
    if (!id) return send(res, 400, { error: 'id required' })
    try {
      send(res, 200, await app.runtime.stashDiff(id, q(req, 'sha') || undefined))
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message, ...(error.code ? { code: error.code } : {}) })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('bind', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    const id = String(body.id || '')
    const sessionId = String(body.sessionId || '')
    if (!id || !sessionId) return send(res, 400, { error: 'id and sessionId required' })
    try {
      send(res, 200, { task: await app.runtime.bind(id, sessionId) })
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('task/merge-preflight', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      const preflight = await app.runtime.mergePreflight(String(body.id || ''), {
        switchToBase: body.switchToBase !== false,
        restoreAfter: body.restoreAfter !== false,
      })
      send(res, 200, { preflight })
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message, code: error.code })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('task/merge-preview', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      const preview = await app.runtime.mergePreview(String(body.id || ''), { force: body.force === true })
      send(res, 200, { preview })
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('task/checkout-preflight', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      send(res, 200, { preflight: await app.runtime.checkoutPreflight(String(body.id || '')) })
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  route('task/back-preflight', 'POST', async (req, res) => {
    requireToken(req)
    const body = await readJson(req)
    try {
      send(res, 200, { preflight: await app.runtime.backPreflight(String(body.id || '')) })
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message })
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  const act = (name: string, fn: (id: string, body: any) => Promise<unknown>) => {
    route(`task/${name}`, 'POST', async (req, res) => {
      requireToken(req)
      const body = await readJson(req)
      try {
        await fn(String(body.id || ''), body)
        const id = String(body.id || '')
        const task = app.store.getTask(id)
        const warning = app.runtime.takeWarning(id)
        const partial = app.runtime.takePartial(id)
        const extra = { ...(warning ? { warning } : {}), ...(partial ? { partial } : {}) }
        if (!task) return send(res, 200, { ok: true, deleted: true, ...extra })
        send(res, 200, { ok: true, view: await app.runtime.view(task), ...extra })
      } catch (error) {
        if (error instanceof TaskError) return send(res, error.status, { error: error.message, ...(error.code ? { code: error.code } : {}) })
        send(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    })
  }

  act('checkout', async (id, body) => app.runtime.checkout(id, { strategy: body.strategy, expectedSha: body.expectedSha ? String(body.expectedSha) : undefined }))
  act('back', async (id, body) => app.runtime.back(id, { strategy: body.strategy, expectedSha: body.expectedSha ? String(body.expectedSha) : undefined }))
  act('stash', async (id, body) => (String(body.action || '') === 'drop'
    ? app.runtime.dropStash(id, body.sha ? String(body.sha) : undefined)
    : app.runtime.applyStash(id, body.sha ? String(body.sha) : undefined)))
  act('merge', async (id, body) => app.runtime.merge(id, {
    switchToBase: body.switchToBase === true,
    restoreAfter: body.restoreAfter !== undefined ? body.restoreAfter === true : body.restoreTo !== false,
    expectedTip: body.expectedTip ? String(body.expectedTip) : undefined,
    expectedBase: body.expectedBase ? String(body.expectedBase) : undefined,
    dirtyStrategy: body.dirtyStrategy === 'stash' ? 'stash' : 'refuse',
  }))
  act('merge-restore', async (id) => app.runtime.restoreAfterMerge(id))
  act('cleanup', async (id, body) => app.runtime.cleanup(id, { force: !!body.force, deleteBranch: !!body.deleteBranch, forceDeleteBranch: !!body.forceDeleteBranch }))
  act('archive', async (id) => app.runtime.archive(id))
  act('unarchive', async (id) => app.runtime.unarchive(id))
  act('criteria', async (id, body) => app.runtime.setCriterionChecked(id, String(body.text || ''), body.checked === true))
  act('pin', async (id, body) => app.runtime.setTaskPinned(id, body.pinned === true))
  act('delete', async (id) => app.runtime.delete(id))

  const routes: RouteDef[] = []
  for (const [path, methods] of table) {
    routes.push({
      kind: 'exact',
      path: `${PREFIX}/${path}`,
      async handler(req: any, res: any) {
        try {
          if (!trusted(req)) return send(res, 403, { error: 'untrusted-origin' })
          const fn = methods.get(req.method)
          if (!fn) return send(res, 405, { error: 'method-not-allowed' })
          await fn(req, res)
        } catch (error: any) {
          send(res, error?.status || 500, { error: error?.code || 'internal', message: error instanceof Error ? error.message : String(error) })
        }
      },
    })
  }

  return app.ctx.inject(['webServer'], (host: any) => {
    const ws = host.webServer
    if (!ws || typeof ws.register !== 'function') return () => {}
    const offs: Array<() => void> = []
    for (const r of routes) {
      try {
        offs.push(ws.register(r))
      } catch {
        /* noop */
      }
    }
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
