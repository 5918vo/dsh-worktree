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
 * Client-side display root for a project's worktrees, without touching the
 * filesystem: the external root already includes the project segment; the
 * legacy in-repo directory does not.
 */
export function worktreePreviewRoot(project: { name?: string; dirName?: string } | null | undefined): string {
  const dir = String((project && project.dirName) || DEFAULT_WORKTREE_DIR)
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
  if (!isExternalWorktreeDir(dir)) return dir
  const name = worktreeProjectSegment(project && project.name ? project.name : 'project')
  return `${dir}/${name}`
}
