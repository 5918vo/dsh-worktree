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
  const seq = React.useRef(0)
  // The toast component owns its hold/fade timer; a new seq restarts it even when
  // the same message is reported twice in a row.
  const notify = (message: string, kind?: string) => {
    seq.current += 1
    setToast({ message, kind: kind || 'ok', seq: seq.current })
  }
  const dismiss = () => setToast(null)
  return { toast, notify, dismiss }
}
