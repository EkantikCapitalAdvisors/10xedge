#!/usr/bin/env node
/* Build-time figure refresh.
 *
 * Pulls the public trade journal, recomputes the engine figures, and compares them
 * against the locked values the page currently states.
 *
 *   node refresh.mjs            dry run — report drift, change nothing (default)
 *   node refresh.mjs --apply    rewrite the locked figures and the page copy
 *
 * DESIGN INTENT: this deliberately does NOT run automatically and does NOT update the
 * page in the browser. Every figure on this page is a reviewed claim. A number that
 * rewrites itself emits a claim nobody gated, which is the exact failure the CEG
 * constraint exists to prevent. Refresh is a human-initiated build step, and any
 * material change re-opens counsel review.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const secDir = join(here, '..', '_sections');
const cfgPath = join(here, 'figures.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const APPLY = process.argv.includes('--apply');

/* ---------- fetch ------------------------------------------------------- */
const res = await fetch(cfg.source);
if (!res.ok) { console.error(`FAILED to fetch ${cfg.source} — ${res.status}`); process.exit(2); }
const rows = await res.json();

/* ---------- compute ------------------------------------------------------ */
const num = v => Number(v ?? 0);
const withRisk = rows.filter(r => num(r.risk_dollars) > 0);
const pl = rows.map(r => num(r.dollar_pl));
const grossProfit = pl.filter(p => p > 0).reduce((a, b) => a + b, 0);
const grossLoss = -pl.filter(p => p < 0).reduce((a, b) => a + b, 0);

const cost = cfg.costModel.roundTurnUsd;
const netPl = pl.map(p => p - cost);
const netProfit = netPl.filter(p => p > 0).reduce((a, b) => a + b, 0);
const netLoss = -netPl.filter(p => p < 0).reduce((a, b) => a + b, 0);

const parseDate = s => {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
};
const dates = rows.map(r => parseDate(r.trade_date)).filter(Boolean).sort((a, b) => a - b);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const first = dates[0], last = dates[dates.length - 1];
const spanDays = (last - first) / 864e5;
const rTotal = withRisk.reduce((a, r) => a + num(r.dollar_pl) / num(r.risk_dollars), 0);

const live = {
  trades: rows.length,
  winRatePct: +(rows.filter(r => r.is_win).length / rows.length * 100).toFixed(1),
  winRateHeadlinePct: Math.round(rows.filter(r => r.is_win).length / rows.length * 100),
  profitFactorGross: +(grossProfit / grossLoss).toFixed(3),
  profitFactorNet: +(netProfit / netLoss).toFixed(2),
  windowLabel: `${MON[first.getMonth()]}&ndash;${MON[last.getMonth()]} ${last.getFullYear()}`,
  tradesPerYear: Math.round(withRisk.length / (spanDays / 30.44) * 12),
  edgePerTradeR: +(rTotal / withRisk.length).toFixed(2),
};

/* ---------- compare ------------------------------------------------------ */
const L = cfg.locked, T = cfg.tolerance;
const drift = [];
const cmp = (key, lockedV, liveV, material) => {
  if (String(lockedV) === String(liveV)) return;
  drift.push({ key, locked: lockedV, live: liveV, material });
};
cmp('trades', L.trades, live.trades, Math.abs(live.trades - L.trades) / L.trades > T.tradesPctRel);
cmp('winRatePct', L.winRatePct, live.winRatePct, Math.abs(live.winRatePct - L.winRatePct) > T.winRatePctAbs);
cmp('winRateHeadlinePct', L.winRateHeadlinePct, live.winRateHeadlinePct, true);
cmp('profitFactorNet', L.profitFactorNet, live.profitFactorNet, Math.abs(live.profitFactorNet - L.profitFactorNet) > T.profitFactorAbs);
cmp('windowLabel', L.windowLabel, live.windowLabel, true);
cmp('tradesPerYear', L.tradesPerYear, live.tradesPerYear, false);
cmp('edgePerTradeR', L.edgePerTradeR, live.edgePerTradeR, Math.abs(live.edgePerTradeR - L.edgePerTradeR) > 0.02);

/* ---------- report ------------------------------------------------------- */
const bar = '─'.repeat(74);
console.log(bar);
console.log(`live journal: ${live.trades} closed trades · ${MON[first.getMonth()]} ${first.getDate()} → ${MON[last.getMonth()]} ${last.getDate()} ${last.getFullYear()} (${Math.round(spanDays)} days)`);
console.log(`gross profit factor ${live.profitFactorGross}  →  net ${live.profitFactorNet} at $${cost.toFixed(2)}/trade`);
if (!cfg.costModel.verified)
  console.log(`  ! cost model UNVERIFIED — the feed carries no fee field. The net profit factor\n    on the page rests entirely on this assumption. Verify before republishing.`);
console.log(bar);

if (!drift.length) {
  console.log('IN SYNC — the page matches the live record. Nothing to do.');
  process.exit(0);
}
console.log(`${drift.length} figure${drift.length > 1 ? 's have' : ' has'} drifted:\n`);
for (const d of drift)
  console.log(`  ${d.material ? '‼ MATERIAL' : '· minor   '}  ${d.key.padEnd(20)} page ${String(d.locked).padStart(14)}  →  live ${d.live}`);

const material = drift.filter(d => d.material);
console.log(`\n${bar}`);

if (!APPLY) {
  console.log('Dry run — nothing changed. Re-run with --apply to rewrite the page.');
  if (material.length) console.log('Note: this refresh carries MATERIAL drift and will require counsel re-review.');
  process.exit(1);
}

/* ---------- apply -------------------------------------------------------- */
/* Only substitutes inside explicitly tagged spans: <span data-fig="trades">246</span>.
   Untagged prose is never touched — a regex loose enough to catch every "246" in the
   copy is loose enough to corrupt a sentence. */
let edits = 0;
for (const file of readdirSync(secDir).filter(f => f.endsWith('.html'))) {
  const p = join(secDir, file);
  const before = readFileSync(p, 'utf8');
  const after = before.replace(/(<(?:span|em|strong)[^>]*\bdata-fig="([a-zA-Z]+)"[^>]*>)([\s\S]*?)(<\/(?:span|em|strong)>)/g,
    (whole, open, key, _old, close) => (key in live) ? `${open}${live[key]}${close}` : whole);
  if (after !== before) { writeFileSync(p, after); edits++; console.log(`  rewrote ${file}`); }
}

cfg.locked = { ...L, ...Object.fromEntries(Object.keys(L).map(k => [k, live[k] ?? L[k]])) };
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

console.log(`\nUpdated ${edits} section file${edits === 1 ? '' : 's'} and figures.json.`);
console.log('NEXT, all of it, in order:');
console.log('  1. node build.mjs && node lint.mjs      (the linter gates the new figures)');
console.log('  2. re-read the sample caveat by hand — "246 trades is six months of one kind of');
console.log('     market" ties a COUNT to a DURATION and to "one kind of market"; a new count');
console.log('     may falsify the sentence around it, and no substitution can detect that.');
console.log('  3. re-run the CEG compliance critic over the whole page.');
if (material.length) console.log('  4. MATERIAL drift — counsel must re-review before this is republished.');
