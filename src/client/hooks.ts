import { React } from './ui'
import { getJson } from './context'

/** Shared: fetch branch info for a repo path. Throws so callers can offer retry. */
export async function fetchBranches(dir: string) {
  return await getJson('branches?path=' + encodeURIComponent(dir))
}

export function useBranchInfo(repoPath: string, delay = 0) {
  const [state, setState] = React.useState({ status: 'idle', data: null, error: '' } as any)
  const [attempt, setAttempt] = React.useState(0)
  React.useEffect(() => {
    const dir = String(repoPath || '').trim()
    if (!dir) {
      setState({ status: 'idle', data: null, error: '' })
      return
    }
    let cancelled = false
    setState({ status: 'loading', data: null, error: '' })
    const timer = setTimeout(() => {
      fetchBranches(dir)
        .then((data: any) => {
          if (cancelled) return
          // A non-repository (or unborn repo) answers 200 with an empty list; treat it as a load failure
          // so the UI can offer the documented error + retry instead of an empty dropdown.
          const list = data && Array.isArray(data.branches) ? data.branches : []
          if (!list.length) setState({ status: 'error', data: null, error: 'empty' })
          else setState({ status: 'success', data, error: '' })
        })
        .catch((e: any) => { if (!cancelled) setState({ status: 'error', data: null, error: (e && e.message) || '' }) })
    }, delay)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [repoPath, delay, attempt])
  return Object.assign({}, state, { retry: () => setAttempt((n: number) => n + 1) })
}

export function useToast() {
  const [toast, setToast] = React.useState(null)
  const timer = React.useRef(null)
  const notify = (message: string, kind?: string) => {
    setToast({ message, kind: kind || 'ok' })
    if (timer.current) window.clearTimeout(timer.current)
    // Errors stay longer than success toasts (accessibility: enough time to read).
    const ttl = kind === 'error' ? 6500 : 2800
    timer.current = window.setTimeout(() => setToast(null), ttl)
  }
  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])
  const dismiss = () => {
    if (timer.current) window.clearTimeout(timer.current)
    setToast(null)
  }
  return { toast, notify, dismiss }
}
