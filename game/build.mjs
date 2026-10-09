// بناء نسخة بملف واحد: dist/rada3.html (تعمل دون خادم ودون CDN لمكتبة three)
// الاستخدام: npm install && npm run build
// خيار --artifact ينتج نسخة بلا وسوم html/head/body (لصفحات Claude Artifacts)
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const artifact = process.argv.includes('--artifact');
const threeDir = path.resolve(path.dirname(require.resolve('three')), '..');

const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: 'es2020',
  alias: {
    three: path.join(threeDir, 'build/three.module.js'),
    'three/addons': path.join(threeDir, 'examples/jsm'),
  },
  legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('style.css', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');
html = html
  .replace(/<link rel="manifest"[^>]*>\n?/, '')
  .replace(/<link rel="icon"[^>]*>\n?/, '')
  .replace(/<link rel="stylesheet" href="style.css">/, () => `<style>\n${css}\n</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '')
  .replace(/<script type="module" src="src\/main.js"><\/script>/, () => `<script type="module">\n${js}\n</script>`);
if (artifact) {
  html = html
    .replace(/<!doctype html>\n?/i, '')
    .replace(/<html[^>]*>\n?/i, '')
    .replace(/<\/html>\n?/i, '')
    .replace(/<head>\n?/i, '')
    .replace(/<\/head>\n?/i, '')
    .replace(/<body>\n?/i, '')
    .replace(/<\/body>\n?/i, '')
    .replace(/<meta charset="utf-8">\n?/i, '')
    .replace(/<meta name="viewport"[^>]*>\n?/i, '');
  html = `<div dir="rtl" lang="ar" style="display:contents">\n${html}\n</div>`;
}
fs.mkdirSync('dist', { recursive: true });
const out = artifact ? 'dist/rada3-artifact.html' : 'dist/rada3.html';
fs.writeFileSync(out, html);
console.log(`✓ ${out} (${(html.length / 1024).toFixed(0)} KB)`);
