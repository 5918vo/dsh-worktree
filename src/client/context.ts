import { uuid } from './format'

/** Host application context; set once by the module's apply(). */
export let appCtx: any = null

export function setAppCtx(ctx: any) {
  appCtx = ctx
}

export const api = (p: string) => `/dsh-worktree/api/${p}`

// Board-wide auth token, auto-refreshed on 401/403 (e.g. after a host restart).
let boardToken: string | null = null

async function fetchBoardToken(): Promise<string> {
  const r = await sendJsonRaw('session', { sessionId: 'worktree-board' }, 'POST')
  boardToken = String(r.token || '')
  return boardToken
}

async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = boardToken || (await fetchBoardToken())
  try {
    return await fn(token)
  } catch (e: any) {
    if (e && (e.status === 401 || e.status === 403)) {
      boardToken = null
      const fresh = await fetchBoardToken()
      return fn(fresh)
    }
    throw e
  }
}

/** Reject a pending request after `ms` so a lost response cannot lock a modal forever. */
export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(Object.assign(new Error(message), { timeout: true, code: 'timeout' }))
    }, ms)
    p.then(
      (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v) } },
      (e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e) } },
    )
  })
}

const REQUEST_TIMEOUT_MS = 12_000

/** Never let a dead localhost connection hold the board in a loading state forever. */
function request(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  return fetch(api(path), Object.assign({}, init || {}, { signal: controller.signal })).finally(() => {
    window.clearTimeout(timer)
  })
}

export async function getJson(path: string) {
  return withToken((token) =>
    request(path, { headers: { 'x-dsh-worktree-token': token } }).then(async (res) => {
      if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status })
      return res.json()
    }),
  )
}

export async function sendJsonRaw(path: string, body: any, method: string) {
  const res = await request(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || data.message || 'HTTP ' + res.status), { status: res.status })
  return data
}

export async function sendJson(path: string, body: any, method: string) {
  return withToken((token) =>
    request(path, { method, headers: { 'content-type': 'application/json', 'x-dsh-worktree-token': token }, body: JSON.stringify(body || {}) }).then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw Object.assign(new Error(data.error || data.message || 'HTTP ' + res.status), { status: res.status })
      return data
    }),
  )
}

export const post = (path: string, body: any) => sendJson(path, body, 'POST')

/**
 * Create the DSH conversation for a task and optionally kick it off.
 * The session lands in the project's workspace (created idempotently over
 * the main repo) so the sidebar groups it under the project instead of
 * ungrouped; the first prompt tells the agent to cd into the worktree.
 * Falls back to a cwd-bound session when the workspace call fails.
 */
export async function bindSession(remotes: any, task: any, projectTitle?: string, start = task.startOnBind !== false): Promise<string> {
  let workspaceId: string | undefined
  try {
    const w = await remotes.workspace.create({ path: task.repoPath })
    if (w && w.ok && w.value) {
      const ws = w.value.workspace ?? w.value
      workspaceId = String(ws.workspaceId ?? ws.id ?? '')
      if (projectTitle && workspaceId && typeof remotes.workspace.rename === 'function') {
        try {
          await remotes.workspace.rename({ workspaceId, title: projectTitle })
        } catch {
          /* best effort */
        }
      }
    }
  } catch {
    /* fall back below */
  }
  const created = workspaceId
    ? await remotes.session.create({ workspaceId })
    : await remotes.session.create({ cwd: task.worktreePath })
  if (!created.ok) {
    const msg = created.error && (created.error.message || created.error.code) ? created.error.message || created.error.code : 'session create failed'
    throw new Error(String(msg))
  }
  const sessionId = String(created.value.sessionId)
  try {
    await remotes.session.rename({ sessionId, title: task.title })
  } catch {
    /* best effort */
  }
  // Apply the model route chosen at publish time before the first prompt, so the
  // very first request runs on that model. The catalog and RPC are the same ones
  // the official conversation model dropdown uses.
  const model = task.model
  if (model && typeof model.provider === 'string' && typeof model.model === 'string' && typeof remotes.session.selectModel === 'function') {
    const selected = await remotes.session.selectModel({
      sessionId,
      provider: model.provider,
      model: model.model,
      ...(typeof model.reasoningEffort === 'string' && model.reasoningEffort ? { reasoningEffort: model.reasoningEffort } : {}),
    })
    if (selected && selected.ok === false) {
      const err = selected.error
      throw new Error(String((err && (err.message || err.code)) || 'model selection failed'))
    }
  }
  if (start && task.firstPrompt) {
    const tz = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      } catch {
        return ''
      }
    })()
    const sent = await remotes.session.prompt({
      requestId: uuid(),
      sessionId,
      mode: 'queue',
      content: [{ type: 'text', text: task.firstPrompt }],
      ...(tz ? { clientTimeZone: tz } : {}),
    })
    if (sent && sent.ok === false) {
      const msg = sent.error && (sent.error.message || sent.error.code) ? sent.error.message || sent.error.code : 'prompt failed'
      // Do not bind a session whose first prompt never ran: a blank session is
      // hidden by the host sidebar and would leave the task "developing" with no
      // visible conversation. Keep the task unbound so it can be started again.
      throw new Error(String(msg))
    }
  }
  await post('bind', { id: task.id, sessionId })
  return sessionId
}
