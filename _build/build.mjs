#!/usr/bin/env node
/* Assembles every page in pages.mjs: its HTML from a shell + section partials, and
   its CSS bundle from that page's own section stylesheets (ordered by filename).
   Usage: node _build/build.mjs [--page=name] */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from './pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = (process.argv.find(a => a.startsWith('--page=')) || '').slice(7);

for (const page of PAGES) {
  if (only && page.name !== only) continue;
  const secDir = join(root, page.sections);
  const shell = readFileSync(join(root, page.shell), 'utf8');

  let html = shell.replace(/[ \t]*<!--#include ([a-z0-9-]+)-->/g, (_, name) => {
    const f = join(secDir, `${name}.html`);
    if (!existsSync(f)) {
      console.warn(`  ! missing section: ${name}.html`);
      return `<!-- MISSING SECTION: ${name} -->`;
    }
    return readFileSync(f, 'utf8').trimEnd();
  });

  /* Build-time charts: <!--#chart name--> is replaced by inline SVG generated from
     figures.json. No chart library ships and the page fetches nothing at runtime. */
  if (page.charts) {
    const charts = await page.charts(root);
    html = html.replace(/[ \t]*<!--#chart ([a-z0-9-]+)-->/g, (_, name) =>
      charts[name] ?? `<!-- MISSING CHART: ${name} -->`);
  }

  const outHtml = join(root, page.outHtml);
  mkdirSync(dirname(outHtml), { recursive: true });
  writeFileSync(outHtml, html);

  const cssFiles = readdirSync(secDir).filter(f => f.endsWith('.css')).sort();
  const css = cssFiles
    .map(f => `/* ===== ${f} ${'='.repeat(Math.max(0, 62 - f.length))} */\n${readFileSync(join(secDir, f), 'utf8').trim()}`)
    .join('\n\n');
  writeFileSync(join(root, page.outCss), css + '\n');

  console.log(`[${page.name}] built ${page.outHtml} (${(html.length / 1024).toFixed(1)} kB) · ${page.outCss} from ${cssFiles.length} files (${(css.length / 1024).toFixed(1)} kB)`);
}
