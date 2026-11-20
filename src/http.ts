import { randomBytes } from 'node:crypto'
import type { App } from './app.js'
import { TaskError } from './core/errors.js'

const PREFIX = '/dsh-worktree/api'
const MAX_BODY = 64 * 1024
const BOARD_CLIENT = 'worktree-board'

type HttpMethod = 'GET' | 'POST'
type RouteHandler = (ctx: RequestContext) => unknown | Promise<unknown>

interface RequestContext {
  req: any
  res: any
  query: URLSearchParams
  body: any
}

function getHeader(req: any, name: string): string | undefined {
  const v = req.headers?.[name]
  return Array.isArray(v) ? v[0] : v
}

function isTrustedOrigin(req: any): boolean {
  if ((getHeader(req, 'sec-fetch-site') || '').toLowerCase() === 'cross-site') return false
  const origin = getHeader(req, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === getHeader(req, 'host')
  } catch {
    return false
  }
}

function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const type = String(getHeader(req, 'content-type') || '').toLowerCase()
    if (!type.includes('application/json')) {
      return reject(new TaskError('json required', 415))
    }
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new TaskError('too large', 413))
        req.destroy()
      } else {
        chunks.push(c)
      }
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch {
        reject(new TaskError('bad json', 400))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: any, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

export function registerHttp(app: App): () => void {
  const table = new Map<string, Map<HttpMethod, { auth: boolean; handler: RouteHandler }>>()

  const on = (method: HttpMethod, path: string, handler: RouteHandler, auth = true) => {
    let methods = table.get(path)
    if (!methods) {
      methods = new Map()
      table.set(path, methods)
    }
    methods.set(method, { auth, handler })
  }

  const requireQuery = (query: URLSearchParams, key: string): string => {
    const val = query.get(key) || ''
    if (!val) throw new TaskError(`${key} required`, 400)
    return val
  }

  // ---- 公开 / 鉴权入口 ----
  on('POST', 'session', ({ body }) => {
    const clientId = String(body.sessionId || BOARD_CLIENT)
    if (clientId !== BOARD_CLIENT) throw new TaskError('unknown client', 403)
    const token = randomBytes(24).toString('hex')
    app.tokens.set(token, clientId)
    return { token }
  }, false)

  on('GET', 'config', async () => ({ config: app.config, environment: await app.runtime.environment() }), false)
  on('GET', 'recents', () => ({ dirs: app.store.listRecents() }), false)
  on('POST', 'recents/clear', () => { app.store.clearRecents(); return { ok: true } }, false)
  on('GET', 'acceptance-criteria', () => ({ items: app.runtime.listAcceptanceCriteria() }), false)
  on('GET', 'branches', async ({ query }) => app.runtime.branches(requireQuery(query, 'path')), false)

  // ---- 验收标准库 ----
  on('POST', 'acceptance-criteria/add', ({ body }) => ({
    items: app.runtime.addAcceptanceCriteria(Array.isArray(body.items) ? body.items.map(String) : [String(body.text || '')]),
  }))
  on('POST', 'acceptance-criteria/delete', ({ body }) => ({
    items: app.runtime.removeAcceptanceCriterion(String(body.text || '')),
  }))
  on('POST', 'acceptance-criteria/set', ({ body }) => ({
    items: app.runtime.setAcceptanceCriteria(Array.isArray(body.items) ? body.items.map(String) : []),
  }))

  // ---- 项目管理 ----
  on('GET', 'projects', async ({ query }) => ({
    projects: await app.runtime.projectViews({ includeArchived: query.get('includeArchived') === '1' }),
  }))
  on('POST', 'projects/add', async ({ body }) => ({
    project: await app.runtime.addProject({
      repoPath: String(body.repoPath || ''),
      name: body.name ? String(body.name) : undefined,
      baseBranch: body.baseBranch ? String(body.baseBranch) : undefined,
      dirName: body.dirName ? String(body.dirName) : undefined,
      branchPrefix: body.branchPrefix ? String(body.branchPrefix) : undefined,
    }),
  }))
  on('POST', 'projects/update', ({ body }) => ({
    project: app.runtime.updateProject(String(body.id || ''), {
      name: body.name === undefined ? undefined : String(body.name),
      baseBranch: body.baseBranch === undefined ? undefined : String(body.baseBranch),
      dirName: body.dirName === undefined ? undefined : String(body.dirName),
      branchPrefix: body.branchPrefix === undefined ? undefined : String(body.branchPrefix),
    }),
  }))
  on('POST', 'projects/delete', ({ body }) =>
    app.runtime.deleteProject(String(body.id || ''), {
      withTasks: !!body.withTasks,
      withWorktrees: body.withWorktrees === undefined ? true : !!body.withWorktrees,
    }),
  )

  // ---- 任务发布与查询 ----
  on('POST', 'publish', async ({ body }) => ({
    task: await app.runtime.publish({
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
    }),
  }))
  on('GET', 'tasks', async ({ query }) => ({
    tasks: await app.runtime.views({ includeArchived: query.get('includeArchived') === '1' }),
  }))
  on('GET', 'task/diff', async ({ query }) => ({ diff: await app.runtime.diff(requireQuery(query, 'id')) }))
  on('GET', 'task/stash-diff', ({ query }) => app.runtime.stashDiff(requireQuery(query, 'id'), query.get('sha') || undefined))

  on('POST', 'bind', async ({ body }) => {
    const id = String(body.id || '')
    const sessionId = String(body.sessionId || '')
    if (!id || !sessionId) throw new TaskError('id and sessionId required', 400)
    return { task: await app.runtime.bind(id, sessionId) }
  })

  // ---- 预检接口 ----
  on('POST', 'task/merge-preflight', async ({ body }) => ({
    preflight: await app.runtime.mergePreflight(String(body.id || ''), {
      switchToBase: body.switchToBase !== false,
      restoreAfter: body.restoreAfter !== false,
    }),
  }))
  on('POST', 'task/merge-preview', async ({ body }) => ({
    preview: await app.runtime.mergePreview(String(body.id || ''), { force: body.force === true }),
  }))
  on('POST', 'task/checkout-preflight', async ({ body }) => ({
    preflight: await app.runtime.checkoutPreflight(String(body.id || '')),
  }))
  on('POST', 'task/back-preflight', async ({ body }) => ({
    preflight: await app.runtime.backPreflight(String(body.id || '')),
  }))

  // ---- 任务变更操作（统一返回最新 view + warning/partial） ----
  const onTaskAction = (name: string, fn: (id: string, body: any) => Promise<unknown>) => {
    on('POST', `task/${name}`, async ({ body }) => {
      const id = String(body.id || '')
      await fn(id, body)
      const task = app.store.getTask(id)
      const warning = app.runtime.takeWarning(id)
      const partial = app.runtime.takePartial(id)
      const extra = { ...(warning ? { warning } : {}), ...(partial ? { partial } : {}) }
      if (!task) return { ok: true, deleted: true, ...extra }
      return { ok: true, view: await app.runtime.view(task), ...extra }
    })
  }

  onTaskAction('checkout', (id, b) => app.runtime.checkout(id, { strategy: b.strategy, expectedSha: b.expectedSha ? String(b.expectedSha) : undefined }))
  onTaskAction('back', (id, b) => app.runtime.back(id, { strategy: b.strategy, expectedSha: b.expectedSha ? String(b.expectedSha) : undefined }))
  onTaskAction('stash', (id, b) =>
    String(b.action || '') === 'drop'
      ? app.runtime.dropStash(id, b.sha ? String(b.sha) : undefined)
      : app.runtime.applyStash(id, b.sha ? String(b.sha) : undefined),
  )
  onTaskAction('merge', (id, b) =>
    app.runtime.merge(id, {
      switchToBase: b.switchToBase === true,
      restoreAfter: b.restoreAfter !== undefined ? b.restoreAfter === true : b.restoreTo !== false,
      expectedTip: b.expectedTip ? String(b.expectedTip) : undefined,
      expectedBase: b.expectedBase ? String(b.expectedBase) : undefined,
      dirtyStrategy: b.dirtyStrategy === 'stash' ? 'stash' : 'refuse',
    }),
  )
  onTaskAction('merge-restore', (id) => app.runtime.restoreAfterMerge(id))
  onTaskAction('cleanup', (id, b) => app.runtime.cleanup(id, { force: !!b.force, deleteBranch: !!b.deleteBranch, forceDeleteBranch: !!b.forceDeleteBranch }))
  onTaskAction('archive', (id) => app.runtime.archive(id))
  onTaskAction('unarchive', async (id) => app.runtime.unarchive(id))
  onTaskAction('delete', (id) => app.runtime.delete(id))

  // ---- 注册到宿主 webServer ----
  const routes = [...table.entries()].map(([path, methods]) => ({
    kind: 'exact' as const,
    path: `${PREFIX}/${path}`,
    async handler(req: any, res: any) {
      try {
        if (!isTrustedOrigin(req)) return sendJson(res, 403, { error: 'untrusted-origin' })
        const entry = methods.get(req.method as HttpMethod)
        if (!entry) return sendJson(res, 405, { error: 'method-not-allowed' })
        if (entry.auth) {
          const token = getHeader(req, 'x-dsh-worktree-token')
          if (!token || !app.tokens.has(token)) {
            throw new TaskError('bad token', 403, 'bad-token')
          }
        }
        const query = new URL(req.url, 'http://localhost').searchParams
        const body = req.method === 'POST' ? await readJsonBody(req) : {}
        const result = await entry.handler({ req, res, query, body })
        sendJson(res, 200, result)
      } catch (error: any) {
        if (error instanceof TaskError) {
          return sendJson(res, error.status, { error: error.message, ...(error.code ? { code: error.code } : {}) })
        }
        sendJson(res, error?.status || 500, {
          error: error?.code || 'internal',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }))

  return app.ctx.inject(['webServer'], (host: any) => {
    const ws = host.webServer
    if (!ws || typeof ws.register !== 'function') return () => {}
    const offs = routes.map((r) => {
      try { return ws.register(r) } catch { return () => {} }
    })
    return () => {
      for (const off of offs) {
        try { off() } catch { /* noop */ }
      }
    }
  })
}
