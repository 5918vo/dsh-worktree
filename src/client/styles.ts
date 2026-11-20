import { LEGACY_BASE_CSS } from './styles/legacy-base'
import { TOKENS_CSS } from './styles/tokens'
import { LAYOUT_CSS } from './styles/layout'
import { COMPONENTS_CSS } from './styles/components'
import { DETAIL_CSS } from './styles/detail'

export const CSS = [LEGACY_BASE_CSS, TOKENS_CSS, LAYOUT_CSS, COMPONENTS_CSS, DETAIL_CSS].join('\n')
export const STYLES = CSS
