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
  const useEn = String(lang).toLowerCase().startsWith('en')
  const primary: any = useEn ? FALLBACK.en : FALLBACK.zh
  const secondary: any = useEn ? FALLBACK.zh : FALLBACK.en
  // Never render a blank string for a missing key: fall back to the other
  // language, then to the key name itself. This makes a missing translation
  // obvious (e.g. "reconnecting") instead of silently showing nothing.
  return new Proxy({}, {
    get(_target, key) {
      if (typeof key !== 'string') return undefined
      if (key in primary && primary[key] != null) return primary[key]
      if (key in secondary && secondary[key] != null) return secondary[key]
      return key
    },
    has() { return true },
    ownKeys() { return Object.keys(primary) },
    getOwnPropertyDescriptor() { return { enumerable: true, configurable: true } },
  })
}
