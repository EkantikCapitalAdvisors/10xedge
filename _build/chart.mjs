/* Build-time charts and figure fragments for the EXPERIMENT page (Ekantik Ascent).
 *
 * Everything the page shows about the run, the rules' numbers or the demo data is
 * generated here from figures.json → experiment, at build time. No chart library ships
 * and the page fetches nothing at runtime: a figure on the page is one a person rebuilt
 * and read.
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
 * Type discipline: .mono marks a number that was measured (the live account, or the
 * demo journal — which is always labelled demo). Rule values, the ceiling and
 * arithmetic (the pace line, 10×, the floor) carry .num--rule instead.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const usd = v => (v < 0 ? '&minus;$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
const signed = v => (v < 0 ? '&minus;$' : '+$') + Math.abs(Math.round(v)).toLocaleString('en-US');
const signedR = v => (v < 0 ? '&minus;' : '+') + Math.abs(v).toFixed(2) + 'R';
const parts = isoStr => isoStr.split('-').map(Number);
const day = isoStr => { const [y, m, d] = parts(isoStr); return `${d} ${MON[m - 1]} ${y}`; };
const dayLong = isoStr => { const [y, m, d] = parts(isoStr); return `${d} ${MONTH[m - 1]} ${y}`; };
const f1 = v => v.toFixed(1), f2 = v => v.toFixed(2);
const pc = v => `${+v.toFixed(2)}%`;
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const word = n => n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') : String(n);
const Word = n => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };

export async function charts(root) {
  const fig = JSON.parse(readFileSync(join(root, '_build', 'figures.json'), 'utf8'));
  const X = fig.experiment, H = X.history, R = X.run, C = X.challenge, P = X.protocol;
  const live = !!R.started;
  const mult = v => v / C.startUsd;
  const multLabel = m => `${Number.isInteger(m) ? m : f2(m)}&times;`;

  /* ===================== X2 · scoreboard ===================== */
  const lows = live ? R.fills.map(f => f.bal) : [];
  const yMin = Math.min(P.floorUsd * 0.8, ...lows.map(v => v * 0.8)), yMax = C.targetUsd * 1.13;
  const ly = v => (1 - (Math.log(v) - Math.log(yMin)) / (Math.log(yMax) - Math.log(yMin))) * 100;   // % from top
  const lx = d => Math.max(0, Math.min(C.days, d)) / C.days * 100;
  const P10 = v => +(v * 10).toFixed(1);                                 // % → viewBox units (0..1000)

  /* The axis is in multiples of the start — the charter's target is a multiple. Dollars
     ride inside the plot as the secondary reading. */
  const grid = [1, 2, 4, 8, C.multiple].map(m => ({ m, v: C.startUsd * m }));
  const quarters = [0, 91, 182, 273, 365];
  const fy = ly(P.floorUsd);

  let eqPath = '', endDot = '', endTag = '';
  if (live) {
    let d = `M0,${P10(ly(C.startUsd))}`;
    for (const f of R.fills) d += ` H${P10(lx(f.day))} V${P10(ly(Math.max(f.bal, yMin)))}`;
    d += ` H${P10(lx(R.day))}`;
    eqPath = `<path class="xc__eq" d="${d}"/>`;
    const ex = lx(R.day), ey = ly(Math.max(R.balanceUsd, yMin));
    endDot = `<span class="xc__dot xc__dot--now" style="--x:${pc(ex)};--y:${pc(ey)}" aria-hidden="true"></span>`;
    endTag = `<span class="xc__tag xc__tag--now${ex > 60 ? ' xc__tag--left' : ''}" style="--x:${pc(ex)};--y:${pc(ey)}"><span class="mono">${f2(mult(R.balanceUsd))}&times;</span> &middot; day <span class="mono">${R.day}</span></span>`;
  }
  const paceMidX = 64, paceMidY = ly(C.startUsd * Math.pow(C.multiple, paceMidX / 100));
  const gap = live ? R.balanceUsd - R.paceUsd : 0;
  const readout = !live
    ? `The clock starts on ${dayLong(C.startDate)}. On day <span class="num--rule">0</span> the account and the pace line are the same point: <span class="num--rule">1&times;</span>, or <span class="num--rule">${usd(C.startUsd)}</span>.`
    : `As of ${day(R.asOf)}, day <span class="mono">${R.day}</span>: equity <span class="mono">${usd(R.balanceUsd)}</span>, or <span class="mono">${f2(mult(R.balanceUsd))}&times;</span>, against a ceiling pace of <span class="num--rule">${f2(mult(R.paceUsd))}&times;</span> &mdash; <strong><span class="mono">${usd(Math.abs(gap))}</span> ${gap >= 0 ? 'ahead of' : 'behind'} it</strong>, and <span class="mono">${usd(R.toFloorUsd)}</span> above the floor.`;

  const scoreboard = `<figure class="xc" role="group" aria-labelledby="xc-cap">
  <div class="xc__frame">
    <div class="xc__plot">
      <svg class="xc__svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
${quarters.slice(1, -1).map(q => `        <line class="xc__vgrid" x1="${P10(lx(q))}" x2="${P10(lx(q))}" y1="0" y2="1000"/>`).join('\n')}
${grid.map(g => `        <line class="xc__grid${g.m === C.multiple ? ' xc__grid--target' : ''}" x1="0" x2="1000" y1="${P10(ly(g.v))}" y2="${P10(ly(g.v))}"/>`).join('\n')}
        <line class="xc__floor" x1="0" x2="1000" y1="${P10(fy)}" y2="${P10(fy)}"/>
        <path class="xc__pace" d="M0,${P10(ly(C.startUsd))} L1000,${P10(ly(C.targetUsd))}"/>
        ${eqPath}
      </svg>
${grid.map(g => `      <span class="xc__y num--rule" style="--y:${pc(ly(g.v))}">${multLabel(g.m)}</span>`).join('\n')}
${grid.filter(g => g.m > 1).map(g => `      <span class="xc__band num--rule" style="--y:${pc(ly(g.v))}">${usd(g.v)}${g.m === C.multiple ? ' &middot; the ceiling' : ''}</span>`).join('\n')}
      <span class="xc__band xc__band--floor num--rule" style="--y:${pc(fy)}">Floor &middot; ${usd(P.floorUsd)}</span>
      <span class="xc__tag xc__tag--pace" style="--x:${pc(paceMidX)};--y:${pc(paceMidY)}">Pace to <span class="num--rule">${C.multiple}&times;</span></span>
      <span class="xc__dot" style="--x:0%;--y:${pc(ly(C.startUsd))}" aria-hidden="true"></span>
      <span class="xc__dot xc__dot--target" style="--x:100%;--y:${pc(ly(C.targetUsd))}" aria-hidden="true"></span>
      ${endDot}
      ${endTag}
    </div>
    <div class="xc__x" aria-hidden="true">
${quarters.map((q, i) => `      <span class="xc__xl num--rule" style="--x:${pc(lx(q))}">${i === 0 ? 'Day 0' : i === quarters.length - 1 ? `Day ${C.days}` : q}</span>`).join('\n')}
    </div>
  </div>
  <figcaption class="xc__cap" id="xc-cap">
    <span class="xc__key"><span class="xc__sw xc__sw--pace" aria-hidden="true"></span><span>Pace line &mdash; the constant rate that would take the account from <span class="num--rule">1&times;</span> to <span class="num--rule">${C.multiple}&times;</span> in <span class="num--rule">${C.days}</span> days. It is arithmetic, not a forecast.</span></span>
    <span class="xc__key"><span class="xc__sw xc__sw--eq" aria-hidden="true"></span><span>Account equity &mdash; ${live ? 'steps on each closed trade.' : 'drawn here from the first closed trade.'}</span></span>
    <span class="xc__key"><span class="xc__sw xc__sw--floor" aria-hidden="true"></span><span>Floor &mdash; equity closing at or below <span class="num--rule">${usd(P.floorUsd)}</span> ends the experiment.</span></span>
    <span class="xc__scale">Log scale: every doubling is the same height. Dollar figures are multiples of the <span class="num--rule">${usd(C.startUsd)}</span> start.</span>
  </figcaption>
  <p class="xc__read">${readout}</p>
</figure>`;

  /* ===================== X2 · tiles / X1 · rail ===================== */
  const bal = live ? R.balanceUsd : C.startUsd;
  const cls = live ? 'mono' : 'num--rule';
  const daysLeft = C.days - (live ? R.day : 0);
  const contracts = live ? R.contracts : Math.max(1, Math.floor(C.startUsd / P.contractPerUsd));
  const tiles = `<dl class="xt">
  <div class="xt__i"><dt class="xt__k">Equity</dt><dd class="xt__v ${cls}">${usd(bal)}</dd><dd class="xt__s">started at <span class="num--rule">${usd(C.startUsd)}</span></dd></div>
  <div class="xt__i"><dt class="xt__k">Multiple</dt><dd class="xt__v ${cls}">${f2(mult(bal))}&times;</dd><dd class="xt__s">ceiling <span class="num--rule">${C.multiple}&times;</span></dd></div>
  <div class="xt__i"><dt class="xt__k">Contracts in play</dt><dd class="xt__v ${cls}">${contracts}</dd><dd class="xt__s">one per <span class="num--rule">${usd(P.contractPerUsd)}</span> of equity</dd></div>
  <div class="xt__i"><dt class="xt__k">Days left</dt><dd class="xt__v ${cls}">${daysLeft}</dd><dd class="xt__s">of <span class="num--rule">${C.days}</span></dd></div>
</dl>`;

  const status = !live ? 'Pre-launch' : R.floorBreached ? 'Stopped at the floor' : R.ended ? 'Ended' : 'Live';
  const rail = `<dl class="xr">
  <div class="xr__i"><dt>Status</dt><dd>${status}</dd></div>
  <div class="xr__i"><dt>Day</dt><dd><span class="${cls}">${live ? R.day : 0}</span> of <span class="num--rule">${C.days}</span></dd></div>
  <div class="xr__i"><dt>Equity</dt><dd><span class="${cls}">${usd(bal)}</span></dd></div>
  <div class="xr__i"><dt>Multiple</dt><dd><span class="${cls}">${f2(mult(bal))}&times;</span></dd></div>
  <div class="xr__i"><dt>Contracts</dt><dd><span class="${cls}">${contracts}</span></dd></div>
  <div class="xr__i"><dt>Trades</dt><dd><span class="${cls}">${live ? R.trades : 0}</span></dd></div>
</dl>`;
  const railStamp = live
    ? `As of ${day(R.asOf)}. A dated snapshot, rebuilt by hand &mdash; not a live feed.`
    : `The first trade is on ${dayLong(C.startDate)}. These are the opening values.`;

  /* ===================== X5 · contracts by equity ===================== */
  const steps = Array.from({ length: C.multiple }, (_, i) => ({ n: i + 1, at: (i + 1) * P.contractPerUsd }));
  const marks = [steps[0], steps[Math.floor(steps.length / 3)], steps[Math.floor(steps.length * 2 / 3)], steps[steps.length - 1]];
  const strip = `<figure class="xk" role="group" aria-labelledby="xk-cap">
  <ol class="xk__bars" role="list">
${steps.map(s => `    <li class="xk__c" style="--h:${pc(s.n / steps.length * 100)}"><span class="xk__bar" aria-hidden="true"></span><span class="xk__n num--rule">${s.n}<span class="sr-only"> contract${s.n > 1 ? 's' : ''} from ${usd(s.at)} of equity</span></span></li>`).join('\n')}
  </ol>
  <div class="xk__ax" aria-hidden="true">
${marks.map(s => `    <span class="xk__al num--rule" style="--x:${pc((s.n - 0.5) / steps.length * 100)}">${usd(s.at)}</span>`).join('\n')}
  </div>
  <figcaption class="xs xk__cap" id="xk-cap">Contracts per trade, by account equity. The rule is arithmetic, not a projection: the account only reaches a step if the trades take it there.</figcaption>
</figure>`;

  /* How many maximum-size losses in a row take the starting capital to the floor. */
  const lossesToFloor = Math.ceil(Math.log(P.floorUsd / C.startUsd) / Math.log(1 - P.riskPerTradePct / 100));

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

  /* ===================== X7b · the demo data ===================== */
  const D = H.defects;
  const ledger = `<dl class="xh">
  <div class="xh__i"><dt class="xh__k">Demo &middot; closed alerts</dt><dd class="xh__v mono">${H.trades}</dd><dd class="xh__s">logged through ${day(H.asOf)}</dd></div>
  <div class="xh__i"><dt class="xh__k">Demo &middot; winners</dt><dd class="xh__v mono">${f1(H.winRatePct)}%</dd><dd class="xh__s"><span class="mono">${H.wins}</span> of <span class="mono">${H.trades}</span></dd></div>
  <div class="xh__i"><dt class="xh__k">Demo &middot; profit factor</dt><dd class="xh__v mono">${f2(H.profitFactor)}</dd><dd class="xh__s">dollars collected per dollar lost, before commissions and fees</dd></div>
  <div class="xh__i"><dt class="xh__k">Demo &middot; average result</dt><dd class="xh__v mono">${signedR(H.avgR)}</dd><dd class="xh__s">per alert, where R is the risk logged</dd></div>
</dl>`;

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
    <span>Demo alert <span class="mono">1</span></span>
    <span>Demo alert <span class="mono">${H.trades}</span> &middot; <span class="mono">${signed(H.netUsd)}</span></span>
  </div>
  <figcaption class="xs xs-plot__cap" id="xs-cap">Demo account. Cumulative result across the <span class="mono">${H.trades}</span> closed alerts, in the order journalled, at the size alerted and before commissions and fees. The deepest fall from a peak was <span class="mono">${usd(H.maxDrawdownUsd)}</span>.</figcaption>
</figure>`;

  /* Sentences that exist only while the source journal has the defect they describe. */
  const dc = H.dashboardCounts;
  const reconcile = [];
  if (D.duplicated.length)
    reconcile.push(`The dashboard currently lists <span class="mono">${dc.trades}</span> fills and <span class="mono">${signed(dc.netUsd)}</span> because ${word(D.duplicated.length)} demo alerts appear twice in its journal; this page counts each alert once, which gives <span class="mono">${H.trades}</span> and <span class="mono">${signed(H.netUsd)}</span>.`);
  if (D.undated.length || D.importDated.length) {
    const bits = [];
    if (D.importDated.length) bits.push(`${word(D.importDated.length)} early demo alerts carry the date they were imported, not the date they were traded`);
    if (D.undated.length) bits.push(`${word(D.undated.length)} carry no date`);
    reconcile.push(`${bits.join(', and ').replace(/^./, c => c.toUpperCase())}, so the calendar span of the demo data is approximate; the count and the results are not affected.`);
  }
  if (!X.dashboardBase.aligned)
    reconcile.push(`The dashboard plots the same demo alerts against a <span class="num--ext">${usd(X.dashboardBase.startUsd)}</span> base. The live account is scored from <span class="num--rule">${usd(C.startUsd)}</span>.`);

  const OL = H.overLimit;
  const blocks = {
    scoreboard, tiles, rail, strip, payoff, ledger, spark,
    'rail-stamp': railStamp,
    reconcile: reconcile.map(s => `<p class="xs xd__note">${s}</p>`).join('\n        '),
    'ci-sentence': `Read that demo average with its error bars: on <span class="mono">${H.rSample}</span> alerts with a logged risk it sits somewhere between <span class="mono">${signedR(H.avgRCi95[0])}</span> and <span class="mono">${signedR(H.avgRCi95[1])}</span> at <span class="num--ext">95%</span> confidence.`,
    'fit-sentence': `These demo alerts were not sized under the experiment&rsquo;s rules. <span class="mono">${OL.count}</span> of the <span class="mono">${OL.of}</span> with a logged risk put more than <span class="num--rule">${usd(OL.limitUsd)}</span> at risk &mdash; above the <span class="num--rule">${P.riskPerTradePct}%</span> limit on a <span class="num--rule">${usd(C.startUsd)}</span> account. The live account cannot take those trades at that size.`,
    'floor-sentence': `From <span class="num--rule">${usd(C.startUsd)}</span>, ${word(lossesToFloor)} maximum-size losses in a row reach the floor.`,
    witness: X.witness.countersigned
      ? `<strong>${X.witness.name}</strong>, independent witness, has countersigned this charter.`
      : `<strong>${X.witness.name}</strong> is the independent witness. <strong>His countersignature of this charter is still pending</strong>, and it is stated here because a rulebook that hides its own gaps is not one.`,
  };
  const values = {
    'history.trades': String(H.trades),
    'history.asOf': day(H.asOf),
    'history.index': String(H.index),
    'history.singleStock': String(H.singleStock),
    'history.Trades': Word(H.trades),
    'status.badge': live ? `${status} &middot; day ${R.day} of ${C.days}` : `Pre-launch &middot; starts ${dayLong(C.startDate)}`,
    'signup.action': X.signup.endpoint || '',
    'dashboard.url': X.dashboard,
    'start.date': dayLong(C.startDate),
    'end.date': dayLong(C.endDate),
    'start.usd': usd(C.startUsd),
    'multiple': String(C.multiple),
    'charter.date': dayLong(X.charter.dated),
    'rule.risk': String(P.riskPerTradePct),
    'rule.riskUsd': usd(C.startUsd * P.riskPerTradePct / 100),
    'rule.open': String(P.openRiskPct),
    'rule.per': usd(P.contractPerUsd),
    'rule.second': usd(P.contractPerUsd * 2),
    'rule.floor': usd(P.floorUsd),
    'rule.floorDays': String(P.floorReportDays),
    'rule.edge': String(P.edgeWindowTrades),
    'rule.posting': P.posting,
  };
  return { blocks, values };
}
