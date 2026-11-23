/**
 * WCAG 2.1 contrast helpers.
 *
 * The palette is a plain object of real colour values, so contrast can be
 * asserted in unit tests instead of eyeballed in a browser. Only the formats
 * the palette actually uses are supported: `#rgb`, `#rrggbb`, `#rrggbbaa`,
 * `rgb()/rgba()` and `transparent`.
 */

export interface Rgba {
  r: number
  g: number
  b: number
  /** 0..1 */
  a: number
}

const HEX = /^#([0-9a-f]{3,8})$/i
const FUNC = /^rgba?\(([^)]+)\)$/i

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function clampAlpha(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Parse one CSS colour token; `null` means "not a colour this module knows". */
export function parseColor(value: string): Rgba | null {
  const text = String(value == null ? '' : value).trim()
  if (!text) return null
  if (text.toLowerCase() === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  const hex = HEX.exec(text)
  if (hex) {
    const body = hex[1]
    const expand = (part: string) => parseInt(part.length === 1 ? part + part : part, 16)
    if (body.length === 3 || body.length === 4) {
      return {
        r: expand(body[0]),
        g: expand(body[1]),
        b: expand(body[2]),
        a: body.length === 4 ? expand(body[3]) / 255 : 1,
      }
    }
    if (body.length === 6 || body.length === 8) {
      return {
        r: parseInt(body.slice(0, 2), 16),
        g: parseInt(body.slice(2, 4), 16),
        b: parseInt(body.slice(4, 6), 16),
        a: body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1,
      }
    }
    return null
  }
  const fn = FUNC.exec(text)
  if (!fn) return null
  const parts = fn[1].split(/[,/\s]+/).filter(Boolean)
  if (parts.length < 3) return null
  const channel = (part: string) => {
    if (part.endsWith('%')) return (parseFloat(part) / 100) * 255
    return parseFloat(part)
  }
  const r = channel(parts[0])
  const g = channel(parts[1])
  const b = channel(parts[2])
  const a = parts.length > 3 ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1
  if (![r, g, b, a].every((n) => Number.isFinite(n))) return null
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: clampAlpha(a) }
}

/** Alpha-composite `fg` over an opaque `bg`. */
export function composite(fg: Rgba, bg: Rgba): Rgba {
  const a = clampAlpha(fg.a)
  const blend = (front: number, back: number) => clampByte(front * a + back * (1 - a))
  return { r: blend(fg.r, bg.r), g: blend(fg.g, bg.g), b: blend(fg.b, bg.b), a: 1 }
}

function channelLuminance(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance of an opaque colour. */
export function relativeLuminance(color: Rgba): number {
  return 0.2126 * channelLuminance(color.r) + 0.7152 * channelLuminance(color.g) + 0.0722 * channelLuminance(color.b)
}

/**
 * Contrast ratio between two colours, `foreground` composited over
 * `background` first so translucent ink is measured as rendered.
 * Returns 1 when either value cannot be parsed, never NaN.
 */
export function contrastRatio(foreground: string, background: string): number {
  const bg = parseColor(background)
  const fg = parseColor(foreground)
  if (!bg || !fg) return 1
  const opaqueBg = bg.a >= 1 ? bg : composite(bg, { r: 255, g: 255, b: 255, a: 1 })
  const painted = fg.a >= 1 ? fg : composite(fg, opaqueBg)
  const x = relativeLuminance(painted)
  const y = relativeLuminance(opaqueBg)
  const light = Math.max(x, y)
  const dark = Math.min(x, y)
  return (light + 0.05) / (dark + 0.05)
}

/** Round to two decimals so failure messages stay readable. */
export function contrastOf(foreground: string, background: string): number {
  return Math.round(contrastRatio(foreground, background) * 100) / 100
}

/** AA for normal text (4.5:1). Large text is 3:1; `large` opts into it. */
export function meetsAA(foreground: string, background: string, large = false): boolean {
  return contrastRatio(foreground, background) >= (large ? 3 : 4.5)
}

/** AA for UI components and graphical objects (3:1). */
export function meetsNonTextAA(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= 3
}
