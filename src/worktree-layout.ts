/**
 * Where task worktrees live. Shared by the host runtime and the browser client,
 * so this module must stay dependency-free (no `node:path`, no `fs`).
 *
 * `dirName` has two modes:
 * - `~`/absolute (`~/.dsh/worktrees`, `D:\wt`, `/srv/wt`): an external root.
 *   Each project gets `<root>/<project>/` and each task `<root>/<project>/<id8>`,
 *   mirroring how T3 Code keeps its worktrees outside the repository.
 * - relative (`.dsh-worktrees`): the historical in-repo placement
 *   `<repo>/<dirName>/<id8>`, kept for existing projects and configs.
 */

export const DEFAULT_WORKTREE_DIR = '~/.dsh/worktrees'

export function isExternalWorktreeDir(dir: string): boolean {
  const value = String(dir || '').trim()
  if (!value) return false
  return (
    value.startsWith('~') ||
    value.startsWith('/') ||
    value.startsWith('\\\\') ||
    /^[A-Za-z]:[\\/]/.test(value)
  )
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** One filesystem-safe path segment for a project's worktrees. */
export function worktreeProjectSegment(name: string): string {
  const cleaned = String(name || '')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .trim()
  if (!cleaned) return 'project'
  return WINDOWS_RESERVED.test(cleaned) ? `${cleaned}-wt` : cleaned
}

/**
 * The worktree directory in effect for a project: the project's own `dirName`
 * wins, then the runtime config, then the default. The host applies the same
 * precedence in `effectiveConfig()`, so previews and real paths cannot drift.
 */
export function effectiveDirName(
  project?: { dirName?: string } | null,
  fallbackDirName?: string | null,
): string {
  const own = String((project && project.dirName) || '').trim()
  if (own) return own
  const fallback = String(fallbackDirName || '').trim()
  return fallback || DEFAULT_WORKTREE_DIR
}

/**
 * Client-side display root for a project's worktrees, without touching the
 * filesystem: the external root already includes the project segment; the
 * legacy in-repo directory does not.
 */
export function worktreePreviewRoot(
  project: { name?: string; dirName?: string } | null | undefined,
  fallbackDirName?: string | null,
): string {
  const dir = effectiveDirName(project, fallbackDirName)
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
  if (!isExternalWorktreeDir(dir)) return dir
  const name = worktreeProjectSegment(project && project.name ? project.name : 'project')
  return `${dir}/${name}`
}
