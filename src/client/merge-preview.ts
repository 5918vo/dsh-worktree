/**
 * Merge-preview request coordination.
 *
 * The task detail panel needs to answer two questions about the same task:
 *   - "is it safe to merge right now?" (shown as hints / chip), and
 *   - "re-check when the user opens the merge dialog" (must be fresh).
 *
 * Naively firing one request per action lets an older response overwrite a
 * newer one (and a background poll can clobber the dialog's result). This
 * controller keeps at most one request in flight per task, lets callers await
 * the running request, and lets a `force` call queue exactly one follow-up
 * request *after* the in-flight one finishes.
 *
 * It is deliberately framework-free so it can be unit-tested without a DOM.
 */

export interface PreviewReady {
  /** When the checked result was produced (ms since epoch). */
  checkedAt: number
  /** Task-branch tip the preview was computed from. */
  tipSha: string | null
  /** Base-branch tip the preview was computed from. */
  baseSha: string | null
  /** Raw preview payload (MergePreview). */
  preview: any
}

export type MergePreviewState =
  | { phase: 'idle' }
  | { phase: 'checking'; previous?: PreviewReady }
  | { phase: 'ready'; checkedAt: number; tipSha: string | null; baseSha: string | null; preview: any }
  | { phase: 'error'; message: string; previous?: PreviewReady }

export interface PreviewControllerOptions {
  taskId: string
  /** Perform the actual request. `force` should bypass any backend cache. */
  request: (force: boolean) => Promise<any>
  /** Injectable clock for deterministic tests. */
  now?: () => number
}

export interface PreviewController {
  getState(): MergePreviewState
  subscribe(listener: (state: MergePreviewState) => void): () => void
  /** Load a preview. Reuses an in-flight request; `force` queues one follow-up. */
  load(opts?: { force?: boolean }): Promise<void>
  dispose(): void
}

export function createPreviewController(opts: PreviewControllerOptions): PreviewController {
  const now = opts.now || (() => Date.now())
  let state: MergePreviewState = { phase: 'idle' }
  let seq = 0
  let inFlight: { seq: number; promise: Promise<void> } | null = null
  let forceQueued = false
  let disposed = false
  const listeners = new Set<(state: MergePreviewState) => void>()

  const emit = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener(state)
      } catch {
        /* a broken listener must never break the request pipeline */
      }
    }
  }
  const setState = (next: MergePreviewState): void => {
    state = next
    emit()
  }
  const previousReady = (): PreviewReady | undefined => {
    if (state.phase === 'ready') {
      return { checkedAt: state.checkedAt, tipSha: state.tipSha, baseSha: state.baseSha, preview: state.preview }
    }
    if (state.phase === 'checking' || state.phase === 'error') return state.previous
    return undefined
  }

  const run = (force: boolean): Promise<void> => {
    const mySeq = ++seq
    // A forced check always shows "checking" while keeping the last result
    // visible; a background poll stays silent when a result already exists so
    // it never blanks the dialog.
    if (force || state.phase !== 'ready') {
      setState({ phase: 'checking', previous: previousReady() })
    }
    const record: { seq: number; promise: Promise<void> } = { seq: mySeq, promise: Promise.resolve() }
    inFlight = record
    record.promise = (async () => {
      try {
        const preview = await opts.request(force)
        if (disposed || mySeq !== seq) return
        const checkedAt = now()
        setState({
          phase: 'ready',
          checkedAt,
          tipSha: (preview && preview.expectedTip) || null,
          baseSha: (preview && preview.expectedBase) || null,
          preview,
        })
      } catch (e: any) {
        if (disposed || mySeq !== seq) return
        setState({ phase: 'error', message: String((e && e.message) || e || 'error'), previous: previousReady() })
      } finally {
        if (inFlight === record) inFlight = null
      }
    })()
    return record.promise
  }

  const drainForce = (): Promise<void> => {
    if (disposed || !forceQueued) return Promise.resolve()
    forceQueued = false
    return run(true)
  }

  const load = (loadOpts?: { force?: boolean }): Promise<void> => {
    if (disposed) return Promise.resolve()
    const force = !!(loadOpts && loadOpts.force)
    if (inFlight) {
      if (force) {
        // Coalesce any number of forced requests into a single follow-up after
        // the running request settles (never two requests at once).
        forceQueued = true
        const current = inFlight
        return current.promise.catch(() => {}).then(() => drainForce())
      }
      // A plain call reuses (awaits) the running request instead of dropping it.
      return inFlight.promise
    }
    return run(force)
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    load,
    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}

/**
 * Should the periodic preview poll keep running?
 *
 * All must hold: page visible, task readable (not broken, branch exists),
 * there is something to merge (ahead of base, or post-merge commits), and the
 * repo is not currently running a git mutation. This intentionally does NOT key
 * off merged/cleaned: a merged task with post-merge commits, or a cleaned task
 * whose branch still has unmerged commits, must keep previewing.
 */
export function shouldPollPreview(input: {
  hidden?: boolean
  status?: string
  branchExists?: boolean
  ahead?: number
  postMergeAhead?: number
  repoBusy?: boolean
}): boolean {
  if (input.hidden) return false
  if (input.status === 'broken') return false
  if (input.branchExists === false) return false
  if (input.repoBusy) return false
  const ahead = Number(input.ahead || 0)
  const postMergeAhead = Number(input.postMergeAhead || 0)
  return ahead > 0 || postMergeAhead > 0
}
