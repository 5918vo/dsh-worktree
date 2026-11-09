import en from '../../locale/en.json'
import zh from '../../locale/zh.json'

/**
 * Dictionaries live in `locale/*.json` so the host and the client share one
 * source of truth. The JSON files are also shipped with the package.
 */
export const FALLBACK: Record<string, any> = { en, zh }

export function pickDict(locale: any): any {
  let lang = ''
  try {
    if (typeof locale === 'string') lang = locale
    else if (locale && typeof locale === 'object') {
      let cur: any
      // The host locale service is a LocaleFace: { active, locales, revision }.
      if (typeof locale.getSnapshot === 'function') {
        const snap = locale.getSnapshot()
        cur = snap && (snap.active ?? snap.locale ?? snap.language)
      }
      if (cur === undefined && typeof locale.current === 'function') cur = locale.current()
      lang = String(cur ?? locale.active ?? locale.locale ?? locale.language ?? locale.code ?? '')
    }
  } catch {
    lang = ''
  }
  return String(lang).toLowerCase().startsWith('en') ? FALLBACK.en : FALLBACK.zh
}
