/**
 * Branch filtering for the searchable base-branch combobox.
 *
 * Kept as a pure helper (no React) so it can be unit-tested without a DOM.
 * Matching is a case-insensitive substring test on the branch name, so typing
 * `feat` finds `feature/login` as well as `Feature/PAY`. A blank query returns
 * the list unchanged so the dropdown can show every branch.
 */
export type BranchOption = { name: string; current?: boolean; [key: string]: any }

export function filterBranches(branches: BranchOption[] | null | undefined, query: string): BranchOption[] {
  const list = Array.isArray(branches) ? branches : []
  const q = String(query == null ? '' : query).trim().toLowerCase()
  if (!q) return list
  return list.filter((b) => String((b && b.name) || '').toLowerCase().includes(q))
}
