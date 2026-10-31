// Bundles the API and the add_teacher script into self-contained ESM files in dist/.
// Needed because @jide/shared is imported as TypeScript source; the server needs no node_modules.
import { build } from 'esbuild';
import { rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });

await build({
  entryPoints: { index: 'src/index.ts', add_teacher: 'src/scripts/add_teacher.ts' },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  // Some bundled dependencies are CommonJS and call require() for Node built-ins.
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: 'info',
});
