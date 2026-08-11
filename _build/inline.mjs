#!/usr/bin/env node
/* Produces a single self-contained HTML file (CSS + JS + fonts inlined as data URIs)
   for preview/sharing. Not the deploy artifact — deploy serves edge/ as separate files.
   Usage: node inline.mjs [outPath] [--body-only] */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, '_build', 'preview.html');
const bodyOnly = process.argv.includes('--body-only');

const html = readFileSync(join(root, 'index.html'), 'utf8');
let css = readFileSync(join(root, 'styles.css'), 'utf8') + '\n' + readFileSync(join(root, 'sections.css'), 'utf8');
const js = readFileSync(join(root, 'motion.js'), 'utf8');

/* Inline fonts as data URIs; drop latin-ext (English content never triggers it). */
css = css
  .split('\n')
  .filter(l => !/latin-ext\.woff2/.test(l))
  .join('\n')
  .replace(/url\(fonts\/([^)]+)\)/g, (_, f) => {
    const b64 = readFileSync(join(root, 'fonts', f)).toString('base64');
    return `url(data:font/woff2;base64,${b64})`;
  });

const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, 'Preview'])[1];
const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, html])[1]
  .replace(/<script src="motion\.js" defer><\/script>/, '')
  .replace(/<a class="skip"[\s\S]*?<\/a>\n?/, m => m); // keep skip link

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
console.log(`${out} — ${(doc.length / 1024 / 1024).toFixed(2)} MB self-contained`);
