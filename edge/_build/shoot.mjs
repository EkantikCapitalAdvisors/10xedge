#!/usr/bin/env node
/* Screenshot harness. Usage:
     node shoot.mjs <fileOrUrl> <outDir> [--full] [--sel=#id] [--w=390,768,1440]
   Writes <outDir>/<w>.png for each width. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const target = args[0];
const outDir = resolve(args[1] || './shots');
const full = args.includes('--full');
const selArg = args.find(a => a.startsWith('--sel='));
const wArg = args.find(a => a.startsWith('--w='));
const widths = (wArg ? wArg.slice(4) : '390,768,1440').split(',').map(Number);

mkdirSync(outDir, { recursive: true });
const url = /^https?:/.test(target) ? target : 'file://' + resolve(target);

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  ...(/^https?:/.test(target) && proxy ? { proxy: { server: proxy } } : {}),
});
for (const w of widths) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: w < 500 ? 844 : w < 1000 ? 1024 : 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference'
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    // trigger every reveal so screenshots capture settled state
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 400));
  });
  const shot = selArg ? page.locator(selArg.slice(6)) : page;
  await shot.screenshot({ path: `${outDir}/${w}.png`, fullPage: selArg ? undefined : full, animations: 'disabled' });
  // horizontal-overflow check
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    const bad = [];
    if (d.scrollWidth > d.clientWidth + 1) {
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > d.clientWidth + 1 || r.left < -1) {
          bad.push((el.tagName + '.' + (el.className || '')).slice(0, 70) + ` [${Math.round(r.left)},${Math.round(r.right)}]`);
        }
      });
    }
    return { page: d.scrollWidth, view: d.clientWidth, bad: bad.slice(0, 8) };
  });
  if (overflow.page > overflow.view + 1) console.log(`  ⚠ ${w}px H-OVERFLOW ${overflow.page}>${overflow.view}: ${overflow.bad.join(' | ')}`);
  if (errs.length) console.log(`  ⚠ ${w}px JS errors: ${errs.slice(0, 3).join(' | ')}`);
  console.log(`  ✓ ${outDir}/${w}.png`);
  await ctx.close();
}
await browser.close();
