/**
 * Stash creation, SHA-addressed restoration/inspection/drop, and legacy
 * message-based stash lookup helpers.
 */

import { GIT_OP_TIMEOUT_MS, run, tryRun } from './exec.js'
import { revParse } from './history.js'

export async function stashPush(gitPath: string, dir: string, message: string): Promise<void> {
  await run(gitPath, dir, ['stash', 'push', '-u', '-m', message], GIT_OP_TIMEOUT_MS)
}

/** Find a stash entry by exact message; returns its stash@{n} ref. */
async function stashRefForMessage(gitPath: string, dir: string, message: string): Promise<string | null> {
  const result = await tryRun(gitPath, dir, ['stash', 'list', '--format=%gd\t%s'])
  if (!result) return null
  for (const line of result.stdout.split(/\r?\n/)) {
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    if (line.slice(tab + 1) === message) return line.slice(0, tab)
  }
  return null
}

export async function stashApplyByMessage(gitPath: string, dir: string, message: string): Promise<void> {
  const ref = await stashRefForMessage(gitPath, dir, message)
  if (!ref) throw new Error(`stash not found: ${message}`)
  await run(gitPath, dir, ['stash', 'apply', ref], GIT_OP_TIMEOUT_MS)
}

export async function stashDropByMessage(gitPath: string, dir: string, message: string): Promise<void> {
  const ref = await stashRefForMessage(gitPath, dir, message)
  if (!ref) return
  await run(gitPath, dir, ['stash', 'drop', ref], GIT_OP_TIMEOUT_MS)
}

/** Unified patch for a stash entry (used by the "view stash" dialog). */
export async function stashShowByMessage(gitPath: string, dir: string, message: string): Promise<string> {
  const ref = await stashRefForMessage(gitPath, dir, message)
  if (!ref) return ''
  const result = await tryRun(gitPath, dir, ['stash', 'show', '-p', ref])
  return result ? result.stdout : ''
}

export interface StashEntry {
  /** Reflog selector, e.g. stash@{0}. */
  ref: string
  /** Stash commit SHA — stable even as the reflog shifts. */
  sha: string
  message: string
}

/** List stash entries with their stable commit SHAs. */
export async function stashListEntries(gitPath: string, dir: string): Promise<StashEntry[]> {
  const result = await tryRun(gitPath, dir, ['stash', 'list', '--format=%gd%x09%H%x09%s'])
  if (!result) return []
  const out: StashEntry[] = []
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue
    const [ref, sha, ...rest] = line.split('\t')
    if (!ref || !sha) continue
    out.push({ ref, sha, message: rest.join('\t') })
  }
  return out
}

/** Find a stash entry by its message; unverified when no unique match exists. */
export async function stashEntryForMessage(gitPath: string, dir: string, message: string): Promise<{ entry: StashEntry | null; unique: boolean }> {
  const matches = (await stashListEntries(gitPath, dir)).filter(
    (entry) => entry.message === message || entry.message.endsWith(': ' + message),
  )
  if (matches.length === 1) return { entry: matches[0], unique: true }
  return { entry: matches.length ? matches[0] : null, unique: false }
}

/** Push a stash (including untracked) and return the created stash commit SHA. */
export async function stashPushSha(gitPath: string, dir: string, message: string): Promise<string> {
  await run(gitPath, dir, ['stash', 'push', '-u', '-m', message], GIT_OP_TIMEOUT_MS)
  const sha = await revParse(gitPath, dir, 'stash@{0}')
  if (!sha) throw new Error(`stash push did not create an entry: ${message}`)
  return sha
}

/** Files captured by a stash commit. */
export async function stashFiles(gitPath: string, dir: string, sha: string): Promise<string[]> {
  const result = await tryRun(gitPath, dir, ['stash', 'show', '--name-only', sha])
  if (!result) return []
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

export async function stashApplyBySha(gitPath: string, dir: string, sha: string): Promise<void> {
  await run(gitPath, dir, ['stash', 'apply', sha], GIT_OP_TIMEOUT_MS)
}

export async function stashShowBySha(gitPath: string, dir: string, sha: string): Promise<string> {
  const result = await tryRun(gitPath, dir, ['stash', 'show', '-p', sha])
  return result ? result.stdout : ''
}

/** Drop a stash by its commit SHA (locates the current reflog ref first). */
export async function stashDropBySha(gitPath: string, dir: string, sha: string): Promise<boolean> {
  const entry = (await stashListEntries(gitPath, dir)).find((item) => item.sha === sha)
  if (!entry) return false
  await run(gitPath, dir, ['stash', 'drop', entry.ref], GIT_OP_TIMEOUT_MS)
  return true
}
