/**
 * Acceptance-criteria helpers shared by the host, the client and the tests.
 *
 * A criterion is one trimmed, non-empty line. Blank lines and duplicates are
 * dropped so "all empty" input stores nothing and renders nothing.
 */
export function normalizeCriteria(values: any): string[] {
  const list = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(/\r?\n/)
      : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of list) {
    if (typeof value !== 'string') continue
    const text = value.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

/** Split a multi-line textarea value into individual criteria. */
export function parseCriteriaText(text: any): string[] {
  return normalizeCriteria(String(text == null ? '' : text))
}
