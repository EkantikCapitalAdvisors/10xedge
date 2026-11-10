#!/usr/bin/env node
/* Build-time figure refresh for the EXPERIMENT page (the options record).
 *
 *   node _build/refresh-experiment.mjs                dry run — report, change nothing
 *   node _build/refresh-experiment.mjs --apply        write experiment.history / .run
 *   node _build/refresh-experiment.mjs --from=file    read a local copy of the journal
 *
 * Same design intent as refresh.mjs: nothing here runs in the browser and nothing runs
 * automatically. The page states a dated snapshot; a person re-runs this to move it.
 *
 * It owns only figures.json → experiment.history and experiment.run. The operator's
 * inputs (start date, account, protocol, sign-up endpoint) are never written here.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = join(here, 'figures.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const X = cfg.experiment;
if (!X) { console.error('figures.json has no "experiment" block'); process.exit(2); }
const APPLY = process.argv.includes('--apply');
const from = (process.argv.find(a => a.startsWith('--from=')) || '').slice(7);

/* ---------- load --------------------------------------------------------- */
let raw;
if (from) raw = JSON.parse(readFileSync(from, 'utf8'));
else {
  const res = await fetch(X.source);
  if (!res.ok) { console.error(`FAILED to fetch ${X.source} — ${res.status}`); process.exit(2); }
  raw = await res.json();
}
if (!Array.isArray(raw)) { console.error('journal is not an array'); process.exit(2); }

/* ---------- normalise ---------------------------------------------------- */
const num = v => (v == null || v === '' || !isFinite(Number(v)) ? 0 : Number(v));
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDate = s => {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
};
const dateOf = r => parseDate(r.trade_date) || parseDate(r.entry_time);

/* The dashboard counts every row whose outcome is not "Open". Mirror that first, so the
   two totals can be compared like for like. */
const closedRaw = raw.filter(r => r.outcome !== 'Open');

/* Count each trade once. Where a trade_num repeats, keep the dated row; if both (or
   neither) are dated, keep the first as journalled. Position in the journal is kept. */
const byNum = new Map();
for (const r of closedRaw) {
  const prev = byNum.get(r.trade_num);
  if (!prev) { byNum.set(r.trade_num, r); continue; }
  if (!dateOf(prev) && dateOf(r)) byNum.set(r.trade_num, r);
}
const counts = closedRaw.reduce((m, r) => m.set(r.trade_num, (m.get(r.trade_num) || 0) + 1), new Map());
const duplicated = [...counts].filter(([, n]) => n > 1).map(([k]) => k);
const rows = [...byNum.values()];

/* ---------- defects at source ------------------------------------------- */
const undated = rows.filter(r => !dateOf(r)).map(r => r.trade_num);
const riskless = rows.filter(r => !(num(r.risk_dollars) > 0)).map(r => r.trade_num);
/* Rows whose logged date is later than their own expiry month were imported in bulk:
   the date is the import date, not the trade date. */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const importDated = rows.filter(r => {
  const d = dateOf(r); if (!d) return false;
  const m = String(r.expiry || '').toLowerCase().match(/^([a-z]{3})/);
  if (!m) return false;
  const em = MONTHS.indexOf(m[1]);
  return em >= 0 && em < d.getMonth();
}).map(r => r.trade_num);

/* ---------- compute ------------------------------------------------------ */
function stats(set) {
  const pl = set.map(r => num(r.dollar_pl));
  const wins = pl.filter(p => p > 0), losses = pl.filter(p => p <= 0);
  const gp = wins.reduce((a, b) => a + b, 0), gl = -losses.reduce((a, b) => a + b, 0);
  const Rs = set.filter(r => num(r.risk_dollars) > 0).map(r => num(r.dollar_pl) / num(r.risk_dollars));
  const risks = set.map(r => num(r.risk_dollars)).filter(v => v > 0).sort((a, b) => a - b);
  let cum = 0, peak = 0, maxDD = 0;
  for (const p of pl) { cum += p; if (cum > peak) peak = cum; if (peak - cum > maxDD) maxDD = peak - cum; }
  const meanR = Rs.length ? Rs.reduce((a, b) => a + b, 0) / Rs.length : null;
  const sdR = Rs.length > 1 ? Math.sqrt(Rs.reduce((a, r) => a + (r - meanR) ** 2, 0) / (Rs.length - 1)) : null;
  return {
    trades: set.length, wins: wins.length, losses: losses.length,
    winRatePct: set.length ? +(wins.length / set.length * 100).toFixed(1) : null,
    netUsd: Math.round(cum), grossProfitUsd: Math.round(gp), grossLossUsd: Math.round(gl),
    profitFactor: gl > 0 ? +(gp / gl).toFixed(2) : null,
    avgR: meanR == null ? null : +meanR.toFixed(2),
    avgRCi95: sdR == null ? null : [+(meanR - 1.96 * sdR / Math.sqrt(Rs.length)).toFixed(2), +(meanR + 1.96 * sdR / Math.sqrt(Rs.length)).toFixed(2)],
    rSample: Rs.length,
    medianRiskUsd: risks.length ? risks[Math.floor((risks.length - 1) / 2)] : null,
    maxDrawdownUsd: Math.round(maxDD),
  };
}
const unique = stats(rows);
const asDashboard = stats(closedRaw);

/* Is dollar_pl gross? Where an exit price is logged, compare with (exit − entry) × 100. */
const priced = rows.filter(r => r.exit_price != null && r.entry_price != null);
const grossMatches = priced.filter(r => Math.abs((num(r.exit_price) - num(r.entry_price)) * 100 - num(r.dollar_pl)) < 0.51).length;

const dated = rows.map(dateOf).filter(Boolean).sort((a, b) => a - b);
const tickers = rows.reduce((m, r) => (m[r.ticker] = (m[r.ticker] || 0) + 1, m), {});
let c = 0;
const series = rows.map((r, i) => {
  c += num(r.dollar_pl);
  const d = dateOf(r);
  return { n: i + 1, id: r.trade_num, date: d ? iso(d) : null, ticker: r.ticker, pl: num(r.dollar_pl), cum: c };
});

const history = {
  asOf: dated.length ? iso(dated[dated.length - 1]) : null,
  refreshedOn: iso(new Date()),
  rawRows: raw.length,
  closedRows: closedRaw.length,
  ...unique,
  index: (tickers.SPX || 0) + (tickers.SPY || 0),
  singleStock: rows.length - (tickers.SPX || 0) - (tickers.SPY || 0),
  tickers,
  lastDated: dated.length ? iso(dated[dated.length - 1]) : null,
  firstDated: dated.length ? iso(dated[0]) : null,
  grossOfCosts: { pricedRows: priced.length, matchPriceDifference: grossMatches },
  dashboardCounts: { trades: asDashboard.trades, netUsd: asDashboard.netUsd, winRatePct: asDashboard.winRatePct, profitFactor: asDashboard.profitFactor },
  defects: { duplicated, undated, riskless, importDated },
  series,
};

/* ---------- the experiment run ------------------------------------------ */
const ch = X.challenge;
let run = { started: false, startDate: null, fills: [], balanceUsd: ch.startUsd, multiple: 1, doublings: 0, day: 0, asOf: null };
if (ch.startDate) {
  const start = parseDate(ch.startDate);
  const inRun = rows.filter(r => { const d = dateOf(r); return d && d >= start; });
  let bal = ch.startUsd;
  const fills = inRun.map(r => {
    bal += num(r.dollar_pl);
    const d = dateOf(r);
    return { id: r.trade_num, date: iso(d), day: Math.round((d - start) / 864e5), pl: num(r.dollar_pl), bal };
  });
  const asOf = fills.length ? fills[fills.length - 1].date : iso(start);
  const asOfDay = fills.length ? fills[fills.length - 1].day : 0;
  run = {
    started: true, startDate: iso(start), fills, balanceUsd: bal,
    multiple: +(bal / ch.startUsd).toFixed(2),
    doublings: bal > 0 ? +Math.log2(bal / ch.startUsd).toFixed(2) : null,
    day: asOfDay, asOf, ...(() => { const s = stats(inRun); return { trades: s.trades, wins: s.wins, losses: s.losses, netUsd: s.netUsd }; })(),
    paceUsd: Math.round(ch.startUsd * Math.pow(ch.targetUsd / ch.startUsd, asOfDay / ch.days)),
    undatedAfterStartPossible: undated,
  };
}

/* ---------- report ------------------------------------------------------- */
const bar = '─'.repeat(72);
console.log(bar);
console.log(`Options journal — ${raw.length} rows, ${closedRaw.length} closed, ${rows.length} unique closed trades`);
console.log(`  unique      : ${unique.wins}W / ${unique.losses}L · ${unique.winRatePct}% · net $${unique.netUsd} · PF ${unique.profitFactor} · avg ${unique.avgR}R (n=${unique.rSample}, 95% ${unique.avgRCi95?.join(' to ')}) · max DD $${unique.maxDrawdownUsd} · median premium $${unique.medianRiskUsd}`);
console.log(`  as dashboard: ${asDashboard.trades} fills · ${asDashboard.winRatePct}% · net $${asDashboard.netUsd} · PF ${asDashboard.profitFactor}`);
console.log(`  dated ${history.firstDated} → ${history.lastDated} · gross check: ${grossMatches}/${priced.length} priced rows equal (exit − entry) × 100`);
console.log(`  defects     : duplicated ${duplicated.join(', ') || 'none'} · undated ${undated.join(', ') || 'none'} · no risk ${riskless.join(', ') || 'none'} · import-dated ${importDated.join(', ') || 'none'}`);
console.log(run.started
  ? `Experiment run — from ${run.startDate}: ${run.trades} fills · balance $${run.balanceUsd} · ${run.multiple}× · day ${run.day} of ${ch.days} · pace $${run.paceUsd}`
  : 'Experiment run — no start date set (challenge.startDate is null): the page renders its pre-launch state');
console.log(bar);

if (APPLY) {
  X.history = history; X.run = run;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  console.log('figures.json → experiment.history and experiment.run written. Rebuild: node _build/build.mjs');
} else {
  const prev = X.history || {};
  const drift = ['trades', 'winRatePct', 'netUsd', 'profitFactor', 'avgR'].filter(k => prev[k] !== history[k]);
  console.log(drift.length ? `DRIFT vs figures.json: ${drift.map(k => `${k} ${prev[k]} → ${history[k]}`).join(' · ')}\nRe-run with --apply to accept.` : 'No drift against figures.json.');
}
