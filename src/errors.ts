/**
 * Error types shared by the store, the runtime, and the HTTP/tool layers.
 *
 * Kept in their own module so the ledger (`store.ts`) can raise errors the
 * route layer already understands without importing the runtime context (which
 * imports the store).
 */

/** A user-facing failure with an HTTP status and an optional machine code. */
export class TaskError extends Error {
  readonly status: number
  /** Machine-readable reason (e.g. stale/conflict/repoBusy/timeout) for 409 handling. */
  readonly code?: string
  constructor(message: string, status = 400, code?: string) {
    super(message)
    this.name = 'TaskError'
    this.status = status
    if (code) this.code = code
  }
}

/**
 * A ledger read/write failed in a way the caller must see.
 *
 * It carries an HTTP status so the route layer answers 5xx (write) or 503
 * (lock contention) instead of reporting success for a task that was never
 * persisted. Extending `TaskError` is what makes existing `instanceof TaskError`
 * handlers propagate it instead of collapsing it into a bare 500.
 */
export class StoreError extends TaskError {
  constructor(message: string, code: string, status = 500) {
    super(message, status, code)
    this.name = 'StoreError'
  }
}
