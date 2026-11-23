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
/** Git actions can run slow repo hooks (eslint/pre-commit) for minutes. */
export const LONG_REQUEST_TIMEOUT_MS = 10 * 60 * 1000

/** Never let a dead localhost connection hold the board in a loading state forever. */
function request(path: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
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

export async function sendJson(path: string, body: any, method: string, timeoutMs?: number) {
  return withToken((token) =>
    request(path, { method, headers: { 'content-type': 'application/json', 'x-dsh-worktree-token': token }, body: JSON.stringify(body || {}) }, timeoutMs).then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw Object.assign(new Error(data.error || data.message || 'HTTP ' + res.status), { status: res.status, code: data.code })
      return data
    }),
  )
}

export const post = (path: string, body: any) => sendJson(path, body, 'POST')
/** Same as post, but survives slow git hooks (merge/checkout/cleanup). */
export const postLong = (path: string, body: any) => sendJson(path, body, 'POST', LONG_REQUEST_TIMEOUT_MS)

/**
 * Identifies this board window when claiming a task before session creation.
 * Stable within a window so a retry of the same action re-claims the same lease
 * instead of fighting itself; cleared with the tab.
 */
const BIND_OWNER = (() => {
  try {
    const key = 'dsh-worktree:bind-owner'
    const existing = window.sessionStorage.getItem(key)
    if (existing) return existing
    const fresh = uuid()
    window.sessionStorage.setItem(key, fresh)
    return fresh
  } catch {
    // No sessionStorage (e.g. sandboxed panel): a per-load id still keeps retries
    // inside this document idempotent.
    return uuid()
  }
})()

/** Path comparison that tolerates Windows separators and a trailing slash. */
function samePath(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return norm(a) === norm(b)
}

/** cwd the host reports for a freshly created session, '' when it reports none. */
function reportedCwd(value: any): string {
  if (!value || typeof value !== 'object') return ''
  const inner = value.session && typeof value.session === 'object' ? value.session : value
  const cwd = inner.cwd ?? inner.workingDirectory ?? inner.workspacePath ?? ''
  return typeof cwd === 'string' ? cwd : ''
}

/** Best-effort removal of a session we created but will not use. */
async function removeSession(remotes: any, sessionId: string): Promise<void> {
  const service = remotes && remotes.session
  if (!service || !sessionId) return
  for (const method of ['delete', 'close', 'dispose', 'remove']) {
    const fn = service[method]
    if (typeof fn !== 'function') continue
    try {
      await fn({ sessionId })
      return
    } catch {
      /* try the next spelling; the host may not expose any of them */
    }
  }
}

/** Workspace grouping: one workspace per main repo, titled after the project. */
async function ensureWorkspace(remotes: any, task: any, projectTitle?: string): Promise<string | undefined> {
  if (!remotes || typeof remotes.workspace?.create !== 'function') return undefined
  try {
    const w = await remotes.workspace.create({ path: task.repoPath })
    if (!w || !w.ok || !w.value) return undefined
    const ws = w.value.workspace ?? w.value
    const workspaceId = String(ws.workspaceId ?? ws.id ?? '')
    if (projectTitle && workspaceId && typeof remotes.workspace.rename === 'function') {
      try {
        await remotes.workspace.rename({ workspaceId, title: projectTitle })
      } catch {
        /* best effort */
      }
    }
    return workspaceId || undefined
  } catch {
    return undefined
  }
}

/**
 * Create the session for a task *inside its worktree*.
 *
 * Grouping under the project workspace is preferred, but a grouped session runs
 * in the workspace path — the main repo. The host is therefore asked for
 * `{ workspaceId, cwd }` and the reported cwd is verified; if the host ignores
 * the override (or reports a different directory) that session is discarded and
 * a plain cwd-bound session is created. Never silently develop in the main repo:
 * if the reported cwd is wrong for the fallback too, this throws.
 */
async function createTaskSession(
  remotes: any,
  task: any,
  workspaceId?: string,
): Promise<{ sessionId: string; discard: () => Promise<void> }> {
  const desired = String(task.worktreePath || '')
  if (!desired) throw new Error('任务缺少 worktree 路径，已阻止创建会话')
  const attempt = async (params: Record<string, unknown>) => {
    const created = await remotes.session.create(params)
    if (!created || created.ok === false) {
      const err = created && created.error
      throw new Error(String((err && (err.message || err.code)) || 'session create failed'))
    }
    const sessionId = String(created.value.sessionId)
    return { sessionId, cwd: reportedCwd(created.value) }
  }
  if (workspaceId) {
    try {
      const grouped = await attempt({ workspaceId, cwd: desired })
      if (!grouped.cwd || samePath(grouped.cwd, desired)) {
        return { sessionId: grouped.sessionId, discard: () => removeSession(remotes, grouped.sessionId) }
      }
      // The host ran the session elsewhere; drop it before it can touch the repo.
      await removeSession(remotes, grouped.sessionId)
    } catch {
      /* fall through to the cwd-bound attempt below */
    }
  }
  const plain = await attempt({ cwd: desired })
  if (plain.cwd && !samePath(plain.cwd, desired)) {
    await removeSession(remotes, plain.sessionId)
    throw new Error(`主机把该会话的工作目录设成了 ${plain.cwd}，而不是任务 worktree ${desired}`)
  }
  return { sessionId: plain.sessionId, discard: () => removeSession(remotes, plain.sessionId) }
}

/**
 * Claim the exclusive right to start one task, *before* any remote work.
 *
 * Session creation and the first prompt cannot be rolled back, so the decision
 * to start belongs to the ledger: a second window that publishes the same task
 * gets a 409 here and never creates a session, instead of racing the first one.
 */
async function claimTask(taskId: string): Promise<string> {
  let res: any
  try {
    res = await post('bind/claim', { id: taskId, owner: BIND_OWNER })
  } catch (error: any) {
    // A host reload updates the server before the browser bundle. Refusing to
    // create a session is safe; silently bypassing the claim is not.
    if (error?.status === 404 || error?.status === 405) {
      throw Object.assign(new Error('Host 已更新但工作台仍是旧版；请刷新页面后再创建会话'), { code: 'host-reload-required', status: error.status })
    }
    throw error
  }
  const lease = res && res.lease && res.lease.token ? String(res.lease.token) : ''
  if (!lease) throw Object.assign(new Error('未能取得绑定租约，请刷新看板后重试'), { code: 'lease-missing' })
  return lease
}

/** Hand the claim back so the task is startable again immediately. */
async function releaseClaim(taskId: string, lease: string): Promise<void> {
  if (!lease) return
  try {
    await post('bind/release', { id: taskId, lease })
  } catch {
    /* the lease TTL expires on its own */
  }
}

/**
 * True when a bind failure leaves the outcome unknown.
 *
 * A 4xx (409 lease-lost, 400 missing id, ...) is the ledger refusing the write,
 * so the task certainly is not bound. Everything else — network error, abort,
 * timeout, 5xx — may have happened after the write landed.
 */
function isUncertainBindError(error: any): boolean {
  const status = typeof error?.status === 'number' ? error.status : 0
  return !(status >= 400 && status < 500 && status !== 408)
}

/** Bind, tolerating a lost response: a successful write makes the retry a no-op. */
async function bindClaimedSession(taskId: string, sessionId: string, lease: string): Promise<void> {
  try {
    await post('bind', { id: taskId, sessionId, lease })
  } catch (error: any) {
    if (!isUncertainBindError(error)) throw error
    // Unknown outcome (network/timeout/5xx): the binding may already be written.
    await post('bind', { id: taskId, sessionId, lease })
  }
}

/**
 * Read the ledger back after an uncertain bind.
 *
 * The write may have landed while both responses were lost, so the only safe
 * way to decide whether the session is bound is to ask the store. GET tasks is
 * a read-only, token-authenticated view of the same ledger; a view whose task id
 * is this task and whose sessionId is this session is proof the binding exists.
 * Readback failures propagate: the caller must not turn "cannot tell" into
 * "not bound".
 */
async function bindingConfirmed(taskId: string, sessionId: string): Promise<boolean> {
  const data: any = await getJson('tasks')
  const views = data && Array.isArray(data.tasks) ? data.tasks : []
  return views.some((view: any) => {
    const task = view && view.task ? view.task : view
    return task && String(task.id) === taskId && String(task.sessionId || '') === sessionId
  })
}

/**
 * Keep the original bind error, and say what the reader (and the user) can do.
 *
 * The session was kept because its binding could not be ruled out; replacing the
 * error would hide the actual failure, so the note is appended in place.
 */
function annotateUncertainBind(error: any, readback: any): any {
  const note = '绑定状态未知，已保留会话；请刷新看板确认任务状态'
  const detail = readback instanceof Error ? readback.message : String(readback || '')
  if (error && typeof error === 'object') {
    try {
      const message = String(error.message || error)
      if (!message.includes('刷新看板')) error.message = `${message}（${note}）`
      if (detail) error.readbackError = detail
      return error
    } catch {
      /* frozen error: fall through to a wrapper */
    }
  }
  return Object.assign(new Error(`${String(error)}（${note}）`), { readbackError: detail || undefined })
}

/**
 * Create the DSH conversation for a task and optionally kick it off.
 *
 * Order matters: claim → create session in `task.worktreePath` → rename/model →
 * first prompt → bind. The claim is what makes concurrent windows safe; the cwd
 * is what makes "the agent works in its own worktree" true rather than a prompt
 * suggestion. Every failure path releases the claim and removes the orphan
 * session, so a crash cannot leave a hidden conversation or a wedged task.
 */
export async function bindSession(remotes: any, task: any, projectTitle?: string, start = task.startOnBind !== false): Promise<string> {
  const lease = await claimTask(task.id)
  let discard: (() => Promise<void>) | null = null
  // Set once the binding exists or cannot be ruled out. Cleanup must never run
  // in that case: deleting a session the ledger points at would strand the task
  // on a conversation that no longer exists.
  let keep = false
  try {
    const workspaceId = await ensureWorkspace(remotes, task, projectTitle)
    const created = await createTaskSession(remotes, task, workspaceId)
    discard = created.discard
    const sessionId = created.sessionId
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
    try {
      await bindClaimedSession(task.id, sessionId, lease)
    } catch (error: any) {
      // A 4xx is a refusal: the task certainly is not bound, so the normal
      // cleanup below is correct and no readback is needed.
      if (!isUncertainBindError(error)) throw error
      // Both responses were lost. The first write may have landed, so ask the
      // ledger before deciding the session is an orphan.
      let confirmed: boolean
      try {
        confirmed = await bindingConfirmed(task.id, sessionId)
      } catch (readback: any) {
        // The ledger itself is unreadable: the binding may exist, and a kept
        // session is recoverable while a deleted one is not. Keep both the
        // session and the (possibly consumed) lease, and report the original
        // failure with the recovery hint.
        keep = true
        throw annotateUncertainBind(error, readback)
      }
      if (confirmed) {
        // Binding already recorded: the lost responses did not undo the write.
        keep = true
        return sessionId
      }
      throw error
    }
    keep = true
    return sessionId
  } finally {
    if (!keep) {
      // The bind was refused or read back as absent, so the session is a real
      // orphan: remove it, and hand the claim back so a retry can start
      // immediately. Both steps are secondary: neither may replace the original
      // failure the caller needs to see (a lost bind is reported as a bind
      // error, not as "session delete failed").
      if (discard) {
        try {
          await discard()
        } catch {
          /* the host may already have dropped the session */
        }
      }
      try {
        await releaseClaim(task.id, lease)
      } catch {
        /* releaseClaim swallows; the lease TTL is the final fallback */
      }
    }
  }
}
