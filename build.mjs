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
  // The host serves React and the shared UI primitives as static modules, so
  // they must stay out of the bundle and be resolved through factory(require).
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})

console.log('built dist/index.js and dist/client.js')
