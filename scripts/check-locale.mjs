#!/usr/bin/env node
/**
 * Locale consistency check (CI):
 *  - every `t.<key>` referenced in src/client must exist in BOTH locale files
 *  - zh and en must have identical key sets
 *  - report keys that look unused (warning only; some are addressed dynamically)
 * Exits non-zero on a missing key or a zh/en key mismatch.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CLIENT = join(ROOT, 'src', 'client')

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const zh = readJson(join(ROOT, 'locale', 'zh.json'))
const en = readJson(join(ROOT, 'locale', 'en.json'))

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (extname(p) === '.ts') out.push(p)
  }
  return out
}

const used = new Set()
const keyRe = /\bt\.([A-Za-z_][A-Za-z0-9_]*)/g
// Pure helpers / infra that do not read the locale dictionary (avoid false positives
// such as `t.task` where `t` is a task view, not the translation table).
const EXCLUDE = new Set(['board-data.ts', 'branch-filter.ts', 'i18n.ts', 'context.ts', 'icons.ts', 'hooks.ts', 'ui.ts', 'styles.ts', 'palette.ts'])
for (const file of walk(CLIENT)) {
  if (EXCLUDE.has(file.split(/[\\/]/).pop())) continue
  const src = readFileSync(file, 'utf8')
  let m
  while ((m = keyRe.exec(src))) used.add(m[1])
}

// Keys whose visible label is selected dynamically from the status value.
const dynamic = new Set(['ready', 'developing', 'reviewing', 'review', 'merged', 'cleaned', 'broken'])

const zhKeys = Object.keys(zh)
const enKeys = Object.keys(en)
const zhSet = new Set(zhKeys)
const enSet = new Set(enKeys)

const missingZh = [...used].filter((k) => !zhSet.has(k)).sort()
const missingEn = [...used].filter((k) => !enSet.has(k)).sort()
const onlyZh = zhKeys.filter((k) => !enSet.has(k))
const onlyEn = enKeys.filter((k) => !zhSet.has(k))
const unused = zhKeys.filter((k) => !used.has(k) && !dynamic.has(k)).sort()

let failed = false
console.log(`locale keys: zh=${zhKeys.length} en=${enKeys.length}, referenced in client: ${used.size}`)

if (onlyZh.length || onlyEn.length) {
  failed = true
  if (onlyZh.length) console.error('✗ keys only in zh:', onlyZh.join(', '))
  if (onlyEn.length) console.error('✗ keys only in en:', onlyEn.join(', '))
}
if (missingZh.length) { failed = true; console.error('✗ referenced but missing in zh:', missingZh.join(', ')) }
if (missingEn.length) { failed = true; console.error('✗ referenced but missing in en:', missingEn.join(', ')) }
if (!failed) console.log('✓ all referenced keys exist in both locale files')
if (unused.length) console.warn(`ℹ unused (may be dynamic): ${unused.join(', ')}`)

process.exit(failed ? 1 : 0)
