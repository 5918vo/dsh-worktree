/** Why the primary button is disabled, phrased for the button's tooltip. */
export function submitBlockedReason(t: any, repoPath: string, baseBranch: string, status: string): string {
  if (!String(repoPath || '').trim()) return t.chooseDirFirst
  if (status === 'loading') return t.loadingBranches
  if (!String(baseBranch || '').trim()) return t.chooseBaseFirst
  return ''
}

const WINDOWS_SEPARATOR = String.fromCharCode(92)

/** Same repository: only separators, trailing slashes and Windows case differ. */
export function sameRepoPath(a: any, b: any): boolean {
  const norm = (value: any) =>
    String(value || '').trim().split(WINDOWS_SEPARATOR).join('/').replace(/\/+$/, '').toLowerCase()
  const left = norm(a)
  return !!left && left === norm(b)
}
