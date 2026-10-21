// Admin panel build/dev (esbuild). Usage:
//   node build.mjs                 -> production build in dist/
//   node build.mjs --serve         -> dev server http://localhost:5173 (auto rebuild)
// API ka address: SUNLO_API_URL=https://api.yourdomain.com/api/v1 node build.mjs
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const serve = process.argv.includes('--serve');
const outdir = path.resolve('dist');
const apiUrl = process.env.SUNLO_API_URL ?? 'http://localhost:4000/api/v1';

fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });
const html = fs
  .readFileSync('index.html', 'utf8')
  .replace('<script type="module" src="/src/main.tsx"></script>', '<link rel="stylesheet" href="/main.css" /><script type="module" src="/main.js"></script>');
fs.writeFileSync(path.join(outdir, 'index.html'), html);

const opts = {
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outdir,
  format: 'esm',
  splitting: false,
  sourcemap: serve,
  minify: !serve,
  target: ['es2020', 'chrome100', 'safari15'],
  jsx: 'automatic',
  alias: { '@': path.resolve('src') },
  define: {
    'process.env.NODE_ENV': JSON.stringify(serve ? 'development' : 'production'),
    'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
  },
  loader: { '.css': 'css' },
  logLevel: 'info',
};

if (serve) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: outdir, port: 5173, fallback: path.join(outdir, 'index.html') });
  console.log(`Admin panel: http://localhost:${port}`);
} else {
  await esbuild.build(opts);
  console.log('✅ dist/ tayyar');
}
