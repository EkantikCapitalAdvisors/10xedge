/* Build-time charts and figure fragments for the EXPERIMENT page.
 *
 * Everything the page shows about the record or the run is generated here from
 * figures.json → experiment, at build time. No chart library ships and the page
 * fetches nothing at runtime: a figure on the page is one a person rebuilt and read.
 *
 * Returns { blocks, values }:
 *   blocks  → replace <!--#chart name-->  (HTML / inline SVG)
 *   values  → replace {{name}}            (plain scalars, safe inside attributes)
 *
 * Chart technique: the SVG holds only lines, stretched to its box with
 * preserveAspectRatio="none" and non-scaling strokes. Every label and marker is an
 * HTML element placed by percentage, so text is real 13px+ type at every width
 * instead of SVG text that shrinks with the viewport.
 *
 * Type discipline: .mono marks a number the journal measured. Rule values, targets
 * and arithmetic (the pace line, $30,000, 3.32 doublings) carry .num--rule instead.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const usd = v => (v < 0 ? '&minus;$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
const signed = v => (v < 0 ? '&minus;$' : '+$') + Math.abs(Math.round(v)).toLocaleString('en-US');
const signedR = v => (v < 0 ? '&minus;' : '+') + Math.abs(v).toFixed(2) + 'R';
const day = isoStr => { const [y, m, d] = isoStr.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
const f1 = v => v.toFixed(1), f2 = v => v.toFixed(2);
const pc = v => `${+v.toFixed(2)}%`;
const list = a => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const word = n => n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') : String(n);
const Word = n => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };

export async function charts(root) {
  const fig = JSON.parse(readFileSync(join(root, '_build', 'figures.json'), 'utf8'));
  const X = fig.experiment, H = X.history, R = X.run, C = X.challenge, P = X.protocol;
  const doublingsTarget = Math.log2(C.targetUsd / C.startUsd);          // 3.32
  const live = !!R.started;

  /* ===================== X2 · scoreboard ===================== */
  const lows = live ? R.fills.map(f => f.bal) : [];
  const yMin = Math.min(2000, ...lows.map(v => v * 0.8)), yMax = 34000;
  const ly = v => (1 - (Math.log(v) - Math.log(yMin)) / (Math.log(yMax) - Math.log(yMin))) * 100;   // % from top
  const lx = d => Math.max(0, Math.min(C.days, d)) / C.days * 100;
  const P10 = v => +(v * 10).toFixed(1);                                 // % → viewBox units (0..1000)

  const grid = [
    { v: C.startUsd, tag: null },
    { v: C.startUsd * 2, tag: '1 doubling' },
    { v: C.startUsd * 4, tag: '2 doublings' },
    { v: C.startUsd * 8, tag: '3 doublings' },
    { v: C.targetUsd, tag: `10&times; &middot; ${f2(doublingsTarget)} doublings` },
  ];
  const quarters = [0, 91, 182, 273, 365];

  let eqPath = '', endDot = '', endTag = '';
  if (live) {
    let d = `M0,${P10(ly(C.startUsd))}`;
    for (const f of R.fills) d += ` H${P10(lx(f.day))} V${P10(ly(Math.max(f.bal, yMin)))}`;
    d += ` H${P10(lx(R.day))}`;
    eqPath = `<path class="xc__eq" d="${d}"/>`;
    const ex = lx(R.day), ey = ly(Math.max(R.balanceUsd, yMin));
    endDot = `<span class="xc__dot xc__dot--now" style="--x:${pc(ex)};--y:${pc(ey)}" aria-hidden="true"></span>`;
    endTag = `<span class="xc__tag xc__tag--now${ex > 60 ? ' xc__tag--left' : ''}" style="--x:${pc(ex)};--y:${pc(ey)}"><span class="mono">${usd(R.balanceUsd)}</span> &middot; day <span class="mono">${R.day}</span></span>`;
  }
  const paceMidX = 64, paceMidY = ly(C.startUsd * Math.pow(C.targetUsd / C.startUsd, paceMidX / 100));
  const behind = live ? R.balanceUsd - R.paceUsd : 0;
  const readout = !live
    ? `The clock has not started. On day <span class="num--rule">0</span> the balance and the pace line are the same point: <span class="num--rule">${usd(C.startUsd)}</span>.`
    : `As of ${day(R.asOf)}, day <span class="mono">${R.day}</span>: balance <span class="mono">${usd(R.balanceUsd)}</span> against a pace of <span class="num--rule">${usd(R.paceUsd)}</span> &mdash; <strong><span class="mono">${usd(Math.abs(behind))}</span> ${behind >= 0 ? 'ahead of' : 'behind'} pace</strong>.`;

  const scoreboard = `<figure class="xc" role="group" aria-labelledby="xc-cap">
  <div class="xc__frame">
    <div class="xc__plot">
      <svg class="xc__svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
${quarters.slice(1, -1).map(q => `        <line class="xc__vgrid" x1="${P10(lx(q))}" x2="${P10(lx(q))}" y1="0" y2="1000"/>`).join('\n')}
${grid.map(g => `        <line class="xc__grid${g.v === C.targetUsd ? ' xc__grid--target' : ''}" x1="0" x2="1000" y1="${P10(ly(g.v))}" y2="${P10(ly(g.v))}"/>`).join('\n')}
        <path class="xc__pace" d="M0,${P10(ly(C.startUsd))} L1000,${P10(ly(C.targetUsd))}"/>
        ${eqPath}
      </svg>
${grid.map(g => `      <span class="xc__y num--rule" style="--y:${pc(ly(g.v))}">${usd(g.v)}</span>`).join('\n')}
${grid.filter(g => g.tag).map(g => `      <span class="xc__band" style="--y:${pc(ly(g.v))}">${g.tag}</span>`).join('\n')}
      <span class="xc__tag xc__tag--pace" style="--x:${pc(paceMidX)};--y:${pc(paceMidY)}">Pace to <span class="num--rule">10&times;</span></span>
      <span class="xc__dot" style="--x:0%;--y:${pc(ly(C.startUsd))}" aria-hidden="true"></span>
      <span class="xc__dot xc__dot--target" style="--x:100%;--y:${pc(ly(C.targetUsd))}" aria-hidden="true"></span>
      ${endDot}
      ${endTag}
    </div>
    <div class="xc__x" aria-hidden="true">
${quarters.map((q, i) => `      <span class="xc__xl num--rule" style="--x:${pc(lx(q))}">${i === 0 ? 'Day 0' : i === quarters.length - 1 ? 'Day 365' : q}</span>`).join('\n')}
    </div>
  </div>
  <figcaption class="xc__cap" id="xc-cap">
    <span class="xc__key"><span class="xc__sw xc__sw--pace" aria-hidden="true"></span><span>Pace line &mdash; the constant rate that turns <span class="num--rule">${usd(C.startUsd)}</span> into <span class="num--rule">${usd(C.targetUsd)}</span> in <span class="num--rule">${C.days}</span> days. It is arithmetic, not a forecast.</span></span>
    <span class="xc__key"><span class="xc__sw xc__sw--eq" aria-hidden="true"></span><span>Realised balance &mdash; ${live ? 'steps on each closed trade.' : 'drawn here from the first closed trade.'}</span></span>
    <span class="xc__scale">Log scale: every doubling is the same height.</span>
  </figcaption>
  <p class="xc__read">${readout}</p>
</figure>`;

  /* ===================== X2 · tiles ===================== */
  const bal = live ? R.balanceUsd : C.startUsd;
  const mult = bal / C.startUsd;
  const dbl = bal > 0 ? Math.log2(mult) : 0;
  const cls = live ? 'mono' : 'num--rule';
  const daysLeft = C.days - (live ? R.day : 0);
  const tiles = `<dl class="xt">
  <div class="xt__i"><dt class="xt__k">Balance</dt><dd class="xt__v ${cls}">${usd(bal)}</dd><dd class="xt__s">from <span class="num--rule">${usd(C.startUsd)}</span></dd></div>
  <div class="xt__i"><dt class="xt__k">Multiple</dt><dd class="xt__v ${cls}">${f2(mult)}&times;</dd><dd class="xt__s">target <span class="num--rule">10&times;</span></dd></div>
  <div class="xt__i"><dt class="xt__k">Doublings earned</dt><dd class="xt__v ${cls}">${f2(dbl)}</dd><dd class="xt__s">of <span class="num--rule">${f2(doublingsTarget)}</span></dd></div>
  <div class="xt__i"><dt class="xt__k">Days left</dt><dd class="xt__v ${cls}">${daysLeft}</dd><dd class="xt__s">of <span class="num--rule">${C.days}</span></dd></div>
</dl>`;

  /* ===================== X1 · state rail ===================== */
  const rail = `<dl class="xr">
  <div class="xr__i"><dt>Status</dt><dd>${live ? 'Live' : 'Pre-launch'}</dd></div>
  <div class="xr__i"><dt>Day</dt><dd><span class="${cls}">${live ? R.day : 0}</span> of <span class="num--rule">${C.days}</span></dd></div>
  <div class="xr__i"><dt>Balance</dt><dd><span class="${cls}">${usd(bal)}</span></dd></div>
  <div class="xr__i"><dt>Multiple</dt><dd><span class="${cls}">${f2(mult)}&times;</span></dd></div>
  <div class="xr__i"><dt>Doublings</dt><dd><span class="${cls}">${f2(dbl)}</span> of <span class="num--rule">${f2(doublingsTarget)}</span></dd></div>
  <div class="xr__i"><dt>Trades</dt><dd><span class="${cls}">${live ? R.trades : 0}</span></dd></div>
</dl>`;
  const railStamp = live
    ? `As of ${day(R.asOf)}. A dated snapshot, rebuilt by hand &mdash; not a live feed.`
    : `Not started &mdash; the start date has not been set. These are the opening values.`;

  /* ===================== X5 · ladder ===================== */
  const steps = P.ladderUsd.map((to, i) => {
    const fromBal = i === 0 ? C.startUsd : P.ladderUsd[i - 1];
    return { size: 2 ** i, from: fromBal, earn: to - fromBal, to };
  });
  const ladder = `<ol class="xl" role="list">
${steps.map((s, i) => `  <li class="xl__s" style="--h:${pc((i + 1) / steps.length * 100)}">
    <span class="xl__bar" aria-hidden="true"></span>
    <p class="xl__size"><span class="num--rule">${s.size}&times;</span></p>
    <p class="xl__earn">Earn <span class="num--rule">${usd(s.earn)}</span></p>
    <p class="xl__at">${i === steps.length - 1 ? 'reaches' : 'next step at'} <span class="num--rule">${usd(s.to)}</span></p>
  </li>`).join('\n')}
</ol>`;

  /* ===================== X4 · payoff sketch ===================== */
  const payoff = `<figure class="xp" role="group" aria-labelledby="xp-cap">
  <div class="xp__plot">
    <svg class="xp__svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line class="xp__zero" x1="0" x2="1000" y1="640" y2="640"/>
      <path class="xp__expiry" d="M0,830 H520 L1000,150"/>
      <path class="xp__value" d="M0,815 C420,800 640,640 1000,70"/>
    </svg>
    <span class="xp__t xp__t--floor">The loss stops at the premium paid</span>
    <span class="xp__t xp__t--zero">Break-even</span>
    <span class="xp__t xp__t--up">The payoff steepens as price moves through the strike</span>
  </div>
  <p class="xp__axis" aria-hidden="true">Price of the underlying &rarr;</p>
  <figcaption class="xs xp__cap" id="xp-cap">A long option, sketched: its value before expiry (solid) and at expiry (dashed). Illustrative and not to scale &mdash; it is not a projection of returns.</figcaption>
</figure>`;

  /* ===================== X7 · the historical record ===================== */
  const D = H.defects;
  const ledger = `<dl class="xh">
  <div class="xh__i"><dt class="xh__k">Closed alerts</dt><dd class="xh__v mono">${H.trades}</dd><dd class="xh__s">logged through ${day(H.asOf)}</dd></div>
  <div class="xh__i"><dt class="xh__k">Winners</dt><dd class="xh__v mono">${f1(H.winRatePct)}%</dd><dd class="xh__s"><span class="mono">${H.wins}</span> of <span class="mono">${H.trades}</span></dd></div>
  <div class="xh__i"><dt class="xh__k">Collected per $1.00 lost</dt><dd class="xh__v mono">$${f2(H.profitFactor)}</dd><dd class="xh__s">before commissions and fees</dd></div>
  <div class="xh__i"><dt class="xh__k">Average result</dt><dd class="xh__v mono">${signedR(H.avgR)}</dd><dd class="xh__s">per alert, where R is the risk logged</dd></div>
</dl>`;

  /* cumulative result, alert by alert */
  const cums = [0, ...H.series.map(s => s.cum)];
  const cMin = Math.min(...cums), cMax = Math.max(...cums);
  const sy = v => (1 - (v - cMin) / (cMax - cMin)) * 100;
  const sx = i => i / H.series.length * 100;
  let sp = `M0,${P10(sy(0))}`;
  H.series.forEach((s, i) => { sp += ` H${P10(sx(i + 1))} V${P10(sy(s.cum))}`; });
  const spark = `<figure class="xs-plot" role="group" aria-labelledby="xs-cap">
  <div class="xs-plot__box">
    <svg class="xs-plot__svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line class="xs-plot__zero" x1="0" x2="1000" y1="${P10(sy(0))}" y2="${P10(sy(0))}"/>
      <path class="xs-plot__line" d="${sp}"/>
    </svg>
    <span class="xs-plot__dot" style="--x:100%;--y:${pc(sy(H.netUsd))}" aria-hidden="true"></span>
  </div>
  <div class="xs-plot__ends">
    <span>Alert <span class="mono">1</span></span>
    <span>Alert <span class="mono">${H.trades}</span> &middot; <span class="mono">${signed(H.netUsd)}</span></span>
  </div>
  <figcaption class="xs xs-plot__cap" id="xs-cap">Cumulative result across the <span class="mono">${H.trades}</span> closed alerts, in the order journalled, at the size alerted and before commissions and fees. The deepest fall from a peak was <span class="mono">${usd(H.maxDrawdownUsd)}</span>.</figcaption>
</figure>`;

  /* Sentences that exist only while the source journal has the defect they describe. */
  const dc = H.dashboardCounts;
  const reconcile = [];
  if (D.duplicated.length)
    reconcile.push(`The dashboard currently lists <span class="mono">${dc.trades}</span> fills and <span class="mono">${signed(dc.netUsd)}</span> because ${word(D.duplicated.length)} alerts appear twice in its journal; this page counts each alert once, which gives <span class="mono">${H.trades}</span> and <span class="mono">${signed(H.netUsd)}</span>.`);
  if (D.undated.length || D.importDated.length) {
    const parts = [];
    if (D.importDated.length) parts.push(`${word(D.importDated.length)} early alerts carry the date they were imported, not the date they were traded`);
    if (D.undated.length) parts.push(`${word(D.undated.length)} carry no date`);
    reconcile.push(`${parts.join(', and ').replace(/^./, c => c.toUpperCase())}, so the calendar span of the record is approximate; the count and the results are not affected.`);
  }
  if (!X.dashboardBase.aligned)
    reconcile.push(`The dashboard plots the same fills against a <span class="num--ext">${usd(X.dashboardBase.startUsd)}</span> base and a <span class="num--ext">${usd(X.dashboardBase.targetUsd)}</span> target. This experiment is scored from <span class="num--rule">${usd(C.startUsd)}</span>.`);

  const blocks = {
    scoreboard, tiles, rail, ladder, payoff, ledger, spark,
    'rail-stamp': railStamp,
    reconcile: reconcile.map(s => `<p class="xs xd__note">${s}</p>`).join('\n        '),
    'ci-sentence': `Read that average with its error bars: on <span class="mono">${H.rSample}</span> alerts with a logged risk it sits somewhere between <span class="mono">${signedR(H.avgRCi95[0])}</span> and <span class="mono">${signedR(H.avgRCi95[1])}</span> at <span class="num--ext">95%</span> confidence.`,
  };
  const values = {
    'history.trades': String(H.trades),
    'history.asOf': day(H.asOf),
    'history.winRate': f1(H.winRatePct),
    'history.pf': f2(H.profitFactor),
    'history.wins': String(H.wins),
    'history.losses': String(H.losses),
    'history.index': String(H.index),
    'history.singleStock': String(H.singleStock),
    'history.Trades': Word(H.trades),
    'status.word': live ? 'Live' : 'Pre-launch',
    'status.since': live ? `Live since ${day(R.startDate)}` : 'Pre-launch &middot; start date to be set',
    'signup.action': X.signup.endpoint || '',
    'dashboard.url': X.dashboard,
    'protocol.unit': usd(P.premiumUnitUsd),
    'protocol.weeklyCap': usd(P.weeklyCapUsd),
    'protocol.weeklyPct': String(P.weeklyCapPct),
    'protocol.buffer': word(P.bufferTrades),
    'protocol.Buffer': Word(P.bufferTrades),
    'protocol.firstBuffer': usd(P.bufferTrades * P.premiumUnitUsd),
    'protocol.ladderSum': usd(C.targetUsd - C.startUsd),
    'doublings.target': f2(doublingsTarget),
  };
  return { blocks, values };
}
