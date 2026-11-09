/**
 * Filtering for the task's model picker.
 *
 * The catalog is grouped by provider, exactly like the official conversation
 * model dropdown. Filtering keeps the group order and drops empty groups, and
 * matches a case-insensitive substring of either the model name or its id.
 * Pure (no React) so it can be unit-tested without a DOM.
 */
export type ModelEntry = { id: string; name: string; [key: string]: any }
export type ModelGroup = { id: string; name: string; models: ModelEntry[]; [key: string]: any }

export function filterModelGroups(groups: ModelGroup[] | null | undefined, query: string): ModelGroup[] {
  const list = Array.isArray(groups) ? groups : []
  const q = String(query == null ? '' : query).trim().toLowerCase()
  const normalized = list.map((g) => ({
    ...g,
    models: Array.isArray(g && g.models) ? g.models : [],
  }))
  if (!q) return normalized
  return normalized
    .map((g) => ({
      ...g,
      models: g.models.filter((m) => {
        const name = String((m && m.name) || '').toLowerCase()
        const id = String((m && m.id) || '').toLowerCase()
        return name.includes(q) || id.includes(q)
      }),
    }))
    .filter((g) => g.models.length > 0)
}
