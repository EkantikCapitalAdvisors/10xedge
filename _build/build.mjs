#!/usr/bin/env node
/* Assembles edge/index.html from _build/shell.html + _sections/*.html,
   and edge/sections.css from _sections/*.css (ordered by filename). */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const secDir = join(root, '_sections');

const shell = readFileSync(join(here, 'shell.html'), 'utf8');

const html = shell.replace(/[ \t]*<!--#include ([a-z0-9-]+)-->/g, (_, name) => {
  const f = join(secDir, `${name}.html`);
  if (!existsSync(f)) {
    console.warn(`  ! missing section: ${name}.html`);
    return `<!-- MISSING SECTION: ${name} -->`;
  }
  return readFileSync(f, 'utf8').trimEnd();
});

writeFileSync(join(root, 'index.html'), html);

const cssFiles = readdirSync(secDir).filter(f => f.endsWith('.css')).sort();
const css = cssFiles
  .map(f => `/* ===== ${f} ${'='.repeat(Math.max(0, 62 - f.length))} */\n${readFileSync(join(secDir, f), 'utf8').trim()}`)
  .join('\n\n');
writeFileSync(join(root, 'sections.css'), css + '\n');

console.log(`built index.html (${(html.length / 1024).toFixed(1)} kB) · sections.css from ${cssFiles.length} files (${(css.length / 1024).toFixed(1)} kB)`);
