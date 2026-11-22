/**
 * Host environment capabilities surfaced as rail warnings. The host reports
 * these from `GET config` (`environment`); both are advisory and never block an
 * action, they only explain a merge/checkout that may fail.
 */

export interface EnvironmentInfo {
  gitVersion?: string | null
  mergeTreeSupported?: boolean | null
  longPaths?: boolean | null
}

export type EnvironmentWarning = 'git' | 'longPaths'

export function environmentWarnings(env: EnvironmentInfo | null | undefined): EnvironmentWarning[] {
  const out: EnvironmentWarning[] = []
  if (!env) return out
  if (env.mergeTreeSupported === false) out.push('git')
  if (env.longPaths === false) out.push('longPaths')
  return out
}
