import { build } from 'esbuild'

const common = { bundle: true, sourcemap: false, logLevel: 'info' }

await build({
  ...common,
  entryPoints: ['src/index.ts'],
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist/index.js',
  external: ['node:*'],
})

await build({
  ...common,
  entryPoints: ['src/client-entry.ts'],
  platform: 'browser',
  format: 'iife',
  target: ['chrome110', 'safari16', 'firefox115'],
  outfile: 'dist/client.js',
  external: ['react', 'react-dom'],
})

console.log('built dist/index.js and dist/client.js')
