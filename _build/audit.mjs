#!/usr/bin/env node
/* Rendered-page audit — the DOM checks that a text linter cannot make.
     node _build/audit.mjs [--base=http://127.0.0.1:8765] [--page=name]
   Serve the repo root first (python3 -m http.server 8765); file:// blocks the fonts.
   For every page at 390 / 768 / 1440 it fails on: horizontal overflow, any text
   under 13px, any link/button/field under 44px tall, more than four dark/light
   band flips, more than one size for .sec-title or .caveat, and any script error. */
import { createRequire } from 'node:module';
/* Playwright is installed globally in this environment; resolve it the CommonJS way so
   the repo needs no node_modules of its own. */
const { chromium } = createRequire(import.meta.url)('playwright');
import { PAGES } from './pages.mjs';

const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
const base = arg('base') || 'http://127.0.0.1:8765';
const only = arg('page');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failed = 0;

for (const page of PAGES) {
  if (only && page.name !== only) continue;
  const url = `${base}/${page.outHtml.replace(/index\.html$/, '')}`;
  for (const w of [390, 768, 1440]) {
    const tab = await browser.newPage({ viewport: { width: w, height: 900 } });
    const errs = [];
    tab.on('pageerror', e => errs.push(String(e).slice(0, 80)));
    tab.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 80)); });
    await tab.goto(url, { waitUntil: 'networkidle' });
    await tab.evaluate(() => document.fonts.ready);
    const r = await tab.evaluate(() => {
      const d = document.documentElement;
      const visible = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const small = [...document.querySelectorAll('body *')].filter(e =>
        e.children.length === 0 && e.textContent.trim() && visible(e) &&
        !e.closest('svg') && parseFloat(getComputedStyle(e).fontSize) < 13);
      /* SVG text scales with its viewBox: measure the rendered height of the glyph box. */
      const svgSmall = [...document.querySelectorAll('svg text')].filter(t =>
        t.textContent.trim() && visible(t) && !t.closest('[aria-hidden="true"]') &&
        parseFloat(getComputedStyle(t).fontSize) * (t.ownerSVGElement.getBoundingClientRect().width /
          (t.ownerSVGElement.viewBox.baseVal.width || t.ownerSVGElement.getBoundingClientRect().width)) < 12.5);
      const taps = [...document.querySelectorAll('a, button, input:not([type=hidden]), select, textarea')]
        .filter(e => visible(e) && !e.closest('.sr-only') && !e.closest('[aria-hidden="true"]') &&
          e.getBoundingClientRect().height < 44 && getComputedStyle(e).position !== 'absolute' &&
          /* a checkbox whose own <label> is a 44px target is reachable through that label */
          !(e.type === 'checkbox' && e.labels && [...e.labels].some(l => l.getBoundingClientRect().height >= 44)));
      const bands = [...document.querySelectorAll('main > section, main > header, body > footer')]
        .map(s => (s.className.includes('band--dark') ? 'D' : 'L')).join('');
      let flips = 0; for (let i = 1; i < bands.length; i++) if (bands[i] !== bands[i - 1]) flips++;
      const sizes = sel => [...new Set([...document.querySelectorAll(sel)].filter(visible).map(e => getComputedStyle(e).fontSize))];
      const label = e => (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || e.tagName;
      return {
        overflow: d.scrollWidth - d.clientWidth,
        small: small.slice(0, 4).map(e => `${label(e)}:${getComputedStyle(e).fontSize}`), smallN: small.length + svgSmall.length,
        svgSmall: svgSmall.slice(0, 3).map(t => t.textContent.trim().slice(0, 18)),
        taps: taps.slice(0, 4).map(e => `${label(e)}:${e.getBoundingClientRect().height.toFixed(0)}px`), tapsN: taps.length,
        bands, flips, titles: sizes('.sec-title'), pulls: sizes('.caveat'),
      };
    });
    const problems = [];
    if (r.overflow > 1) problems.push(`horizontal overflow ${r.overflow}px`);
    if (r.smallN) problems.push(`${r.smallN} text node(s) under 13px: ${[...r.small, ...r.svgSmall].join(', ')}`);
    if (r.tapsN) problems.push(`${r.tapsN} tap target(s) under 44px: ${r.taps.join(', ')}`);
    if (r.flips > 4) problems.push(`${r.flips} band flips (${r.bands}) — the cap is 4`);
    if (r.titles.length > 1) problems.push(`.sec-title renders at ${r.titles.join(' / ')}`);
    if (r.pulls.length > 1) problems.push(`.caveat renders at ${r.pulls.join(' / ')}`);
    if (errs.length) problems.push(`script/console errors: ${errs.slice(0, 2).join(' | ')}`);
    console.log(`${problems.length ? '✗' : '✓'} [${page.name}] ${String(w).padStart(4)}px  bands ${r.bands}${problems.length ? '\n    ' + problems.join('\n    ') : ''}`);
    if (problems.length) failed++;
    await tab.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
