#!/usr/bin/env node
/* Produces a single self-contained HTML file for one page (CSS + JS + fonts inlined
   as data URIs) for private preview. Not the deploy artifact.
     node _build/inline.mjs --page=name [outPath] [--body-only]
   In a preview the sign-up form is pointed at a stub, so reviewing a preview can
   never write a row to the real sign-up sheet. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, pageByName } from './pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const pageName = (args.find(a => a.startsWith('--page=')) || '').slice(7) || PAGES[0].name;
const page = pageByName(pageName);
if (!page) { console.error(`unknown page "${pageName}"`); process.exit(2); }
const bodyOnly = args.includes('--body-only');
const out = args.find(a => !a.startsWith('--')) || join(root, '_build', `preview-${page.name}.html`);

const html = readFileSync(join(root, page.outHtml), 'utf8');
let css = readFileSync(join(root, 'styles.css'), 'utf8') + '\n' + readFileSync(join(root, page.outCss), 'utf8');

/* Inline fonts as data URIs; drop latin-ext (English content never triggers it). */
css = css
  .split('\n')
  .filter(l => !/latin-ext\.woff2/.test(l))
  .join('\n')
  .replace(/url\(fonts\/([^)]+)\)/g, (_, f) =>
    `url(data:font/woff2;base64,${readFileSync(join(root, 'fonts', f)).toString('base64')})`);

const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, 'Preview'])[1];
let body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, html])[1];

/* Inline every local script the page loads, in order. */
const scripts = [];
body = body.replace(/<script src="((?:\.\.\/)?[a-z0-9-]+\.js)"[^>]*><\/script>\n?/g, (_, src) => {
  const f = join(root, src.replace(/^\.\.\//, ''));
  if (existsSync(f)) scripts.push(readFileSync(f, 'utf8'));
  return '';
});
/* Never let a preview post to the real endpoint. */
body = body.replace(/(<form\b[^>]*\baction=")https:\/\/script\.google\.com\/[^"]*"/g, '$1about:blank" data-preview-stub="1"');

const js = scripts.join('\n;\n');
const doc = bodyOnly
  ? `<title>${title}</title>\n<style>\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`
  : `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#1B2A4A">
<title>${title}</title>
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${js}
</script>
</body>
</html>
`;

writeFileSync(out, doc);
console.log(`[${page.name}] ${out} — ${(doc.length / 1024 / 1024).toFixed(2)} MB self-contained`);
