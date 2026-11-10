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

const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, 'Preview'])[1].replace(/\s+[—-]\s+Ekantik Capital Advisors$/, '');
let body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, html])[1];

/* Inline every local script the page loads, in order. */
const scripts = [];
body = body.replace(/<script src="((?:\.\.\/)?[a-z0-9-]+\.js)"[^>]*><\/script>\n?/g, (_, src) => {
  const f = join(root, src.replace(/^\.\.\//, ''));
  if (existsSync(f)) scripts.push(readFileSync(f, 'utf8'));
  return '';
});
/* A preview never posts anywhere. The form is detached from its endpoint and marked
   with a stub, which signup.js answers locally: a reviewer can walk the whole flow and
   nothing is written to the sign-up sheet. The invite shown is the public one. */
body = body.replace(/<form\b([^>]*)\bdata-signup\b([^>]*)>/g, (m, pre, post) =>
  `<form${pre}data-signup data-preview-stub="https://discord.gg/GawjC6ef7t"${post}>`.replace(/\saction="[^"]*"/, ' action=""'));
/* Relative links have nowhere to go inside a single-file preview. */
const site = 'https://10xedge.ekantikcapital.com/';
body = body.replace(/href="program\/"/g, `href="${site}" target="_blank" rel="noopener"`)
  .replace(/href="\.\.\/"/g, `href="${site}" target="_blank" rel="noopener"`);

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
