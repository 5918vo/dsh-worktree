/**
 * Test runner: bundles every `test/**\/*.test.ts` with esbuild (the same tool
 * the production build uses, so `.js` -> `.ts` import mapping and JSON imports
 * behave identically) into `.test-dist`, then runs Node's built-in test runner
 * against the compiled output.
 *
 * Why bundle instead of `node --experimental-strip-types`?
 * The sources import types without `import type`, and the client imports JSON
 * and extensionless modules. Native type stripping cannot elide those imports;
 * esbuild already handles all of it for the shipped build, so we reuse it.
 */
import { build } from 'esbuild'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
process.chdir(root)

const outdir = '.test-dist'

async function collect(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await collect(full)))
    else if (entry.name.endsWith('.test.ts')) out.push(full.split(sep).join('/'))
  }
  return out
}

const entryPoints = (await collect('test')).sort()
if (entryPoints.length === 0) {
  console.error('no test files found under test/')
  process.exit(1)
}

await fs.rm(outdir, { recursive: true, force: true })

await build({
  entryPoints,
  outdir,
  outbase: 'test',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['node:*'],
  sourcemap: 'inline',
  logLevel: 'warning',
})

async function collectOutput(dir) {
  const out = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await collectOutput(full)))
    else if (entry.name.endsWith('.test.js')) out.push(full)
  }
  return out
}

const testFiles = (await collectOutput(outdir)).sort()
if (testFiles.length === 0) {
  console.error('esbuild produced no test files')
  process.exit(1)
}

// `--test-force-exit` keeps a stray debounce timer or abort timer from holding
// the process open after the assertions have finished.
const forward = process.argv.slice(2)
const args = ['--test', '--test-reporter=spec', '--test-force-exit', '--test-concurrency=1', ...forward, ...testFiles]

const child = spawn(process.execPath, args, { stdio: 'inherit' })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
