import { appCtx, bindSession } from './context'
import { uuid } from './format'

/** Open the host's native conversation view for a task session. */
export function openNativeSession(sessionId: string): boolean {
  if (!sessionId) return false
  try {
    const ws = appCtx && appCtx.get ? appCtx.get('uiWorkspace') : null
    if (ws && typeof ws.openSession === 'function') {
      void ws.openSession(sessionId)
      return true
    }
  } catch {
    /* host may not expose the workspace service */
  }
  return false
}

/** Send the first prompt to an already-bound but not-yet-started session. */
export async function sendTaskPrompt(remotes: any, task: any): Promise<void> {
  if (!remotes || !remotes.session || !task || !task.sessionId || !task.firstPrompt) return
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    } catch {
      return ''
    }
  })()
  const sent = await remotes.session.prompt({
    requestId: uuid(),
    sessionId: String(task.sessionId),
    mode: 'queue',
    content: [{ type: 'text', text: String(task.firstPrompt) }],
    ...(tz ? { clientTimeZone: tz } : {}),
  })
  if (sent && sent.ok === false) {
    const err = sent.error
    throw new Error(String((err && (err.message || err.code)) || 'prompt failed'))
  }
}

/** Start an unbound task, or resend the first prompt to a bound one. */
export async function startTask(remotes: any, task: any, projectName: string): Promise<string> {
  if (task.sessionId) {
    await sendTaskPrompt(remotes, task)
    return String(task.sessionId)
  }
  return bindSession(remotes, task, projectName, true)
}
