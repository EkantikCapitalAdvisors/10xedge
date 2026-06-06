/* =============================================================================
   10x Account — Trade Dashboard.
   Parses a Tradovate "Orders" CSV export, reconstructs round-trip trades
   (fill-time FIFO per contract), computes KPIs, and scores the week against the
   10x rule set. Client-side only; nothing is uploaded or stored.
   RULES comes from engine.js (single source of truth).
   ============================================================================= */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const MULT = { ES: 50, MES: 5 };                  // $ per point
  const riskPerContract = (prod) => prod === 'MES' ? RULES.maxLossPerES / 10 : RULES.maxLossPerES; // $50 / $500
  let lastTrades = null, lastFills = null;
  let pnlChart = null, eqChart = null;

  /* -------------------- CSV parsing -------------------- */
  function parseCSV(text) {
    const rows = []; let i = 0, field = '', row = [], inQ = false;
    while (i < text.length) {
      const c = text[i];
      if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
      else { if (c === '"') inQ = true; else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') {} else field += c; }
      i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  const fillTimeMs = (s) => {
    const m = s.match(/(\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d):(\d\d)/);
    return m ? new Date(+m[3], +m[1] - 1, +m[2], +m[4], +m[5], +m[6]).getTime() : 0;
  };
  const dayKey = (s) => { const m = s.match(/(\d\d)\/(\d\d)\/(\d{4})/); return m ? m[3] + '-' + m[1] + '-' + m[2] : s.slice(0, 10); };

  function parseTradovate(text) {
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('Empty file');
    const hdr = rows[0].map(h => h.trim());
    const idx = (n) => hdr.indexOf(n);
    const cFill = idx('Fill Time'), cBS = idx('B/S'), cProd = idx('Product'), cContract = idx('Contract'),
      cStatus = idx('Status'), cQty = idx('Filled Qty'), cPx = idx('decimalFillAvg'), cText = idx('Text'), cType = idx('Type');
    if (cFill < 0 || cBS < 0 || cContract < 0) throw new Error('This does not look like a Tradovate Orders export (missing expected columns).');

    const fills = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]; if (!row || row.length < 5) continue;
      if ((row[cStatus] || '').trim() !== 'Filled') continue;
      const qty = parseFloat(row[cQty]); const px = parseFloat(row[cPx]);
      if (!qty || !isFinite(px)) continue;
      const side = (row[cBS] || '').trim();
      fills.push({
        time: (row[cFill] || '').trim(), sym: (row[cContract] || '').trim(), prod: (row[cProd] || '').trim(),
        side, qty, px, text: (row[cText] || '').trim(), type: (row[cType] || '').trim(),
        signed: (side === 'Buy' ? 1 : -1) * qty
      });
    }
    fills.sort((a, b) => fillTimeMs(a.time) - fillTimeMs(b.time));
    return fills;
  }

  /* -------------------- reconstruct round-trip trades (FIFO per contract) -------------------- */
  function buildTrades(fills) {
    const lots = {}, trades = [];
    for (const f of fills) {
      const sym = f.sym; lots[sym] = lots[sym] || [];
      let q = f.signed; const mult = MULT[f.prod] || 50;
      while (q !== 0 && lots[sym].length && Math.sign(lots[sym][0].q) !== Math.sign(q)) {
        const lot = lots[sym][0]; const m = Math.min(Math.abs(q), Math.abs(lot.q)); const dir = Math.sign(lot.q);
        const pnl = (dir > 0 ? (f.px - lot.px) : (lot.px - f.px)) * m * mult;
        const points = (dir > 0 ? (f.px - lot.px) : (lot.px - f.px));
        trades.push({ sym: sym, prod: f.prod, side: dir > 0 ? 'Long' : 'Short', qty: m, entry: lot.px, exit: f.px,
          entryTime: lot.time, exitTime: f.time, day: dayKey(f.time), pnl, points,
          r: pnl / (riskPerContract(f.prod) * m) });
        lot.q -= dir * m; q += dir * m; if (lot.q === 0) lots[sym].shift();
      }
      if (q !== 0) lots[sym].push({ q, px: f.px, time: f.time });
    }
    const openLots = [];
    for (const s in lots) lots[s].forEach(l => openLots.push({ sym: s, qty: l.q, px: l.px, time: l.time }));
    return { trades, openLots };
  }

  /* -------------------- analysis + rule scoring -------------------- */
  function analyze(trades, openLots) {
    const days = {};
    for (const t of trades) {
      const d = days[t.day] || (days[t.day] = { day: t.day, pnl: 0, trades: 0, losses: 0, maxContracts: 0, maxESrisk: 0 });
      d.pnl += t.pnl; d.trades++; if (t.pnl < 0) d.losses++;
      const esEq = t.prod === 'MES' ? t.qty / 10 : t.qty;        // ES-equivalent contracts
      d.maxContracts = Math.max(d.maxContracts, esEq);
      d.maxESrisk = Math.max(d.maxESrisk, riskPerContract(t.prod) * t.qty);
    }
    const dayList = Object.values(days).sort((a, b) => a.day.localeCompare(b.day));

    // KPIs
    const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl < 0);
    const gw = wins.reduce((s, t) => s + t.pnl, 0), gl = -losses.reduce((s, t) => s + t.pnl, 0);
    const net = trades.reduce((s, t) => s + t.pnl, 0);
    const kpi = {
      net, n: trades.length, wins: wins.length, losses: losses.length,
      winRate: trades.length ? wins.length / trades.length : 0,
      pf: gl ? gw / gl : (gw > 0 ? Infinity : 0),
      avgWin: wins.length ? gw / wins.length : 0,
      avgLoss: losses.length ? -gl / losses.length : 0,
      avgR: trades.length ? trades.reduce((s, t) => s + t.r, 0) / trades.length : 0,
      bestDay: dayList.length ? Math.max(...dayList.map(d => d.pnl)) : 0,
      worstDay: dayList.length ? Math.min(...dayList.map(d => d.pnl)) : 0,
      daysTraded: dayList.length,
      losingDays: dayList.filter(d => d.pnl < 0).length
    };

    // consecutive losing days
    let maxConsec = 0, cur = 0;
    for (const d of dayList) { if (d.pnl < 0) { cur++; maxConsec = Math.max(maxConsec, cur); } else cur = 0; }

    // rule checks
    const dailyMax = RULES.dailyMaxLoss;
    const bigStops = trades.filter(t => t.pnl < -riskPerContract(t.prod) * t.qty * 1.001);
    const dailyBreaches = dayList.filter(d => d.pnl < -dailyMax * 1.001);
    // weekly sit-out: 2 daily-max-loss days in a calendar week → sit out the week
    const sitout = weeklyMaxLossDays(dayList, dailyMax);

    const rules = [
      { ok: dailyBreaches.length === 0, label: 'Daily max loss ≤ $' + dailyMax, detail: dailyBreaches.length ? 'Exceeded $' + dailyMax + ' on ' + dailyBreaches.map(d => d.day + ' (' + money(d.pnl) + ')').join(', ') : 'No day lost more than $' + dailyMax },
      { ok: bigStops.length === 0, label: 'Per-trade stop ≤ $500 / ES', detail: bigStops.length ? bigStops.length + ' trade(s) exceeded the $500/contract stop' : 'No trade exceeded the stop' },
      { ok: !sitout.flagged, label: '2 daily-max-loss days / week → sit out the week', detail: sitout.flagged ? 'Hit a 2nd $' + dailyMax + '-loss day on ' + sitout.triggerDay + '; ' + sitout.tradedAfter + ' more trade(s) taken that week' : (sitout.reached ? 'Reached 2 max-loss days but stopped' : 'No week reached 2 daily-max-loss days') },
      { ok: maxConsec < 3, label: '3 consecutive losing days → high-prob only', detail: maxConsec >= 3 ? maxConsec + ' consecutive losing days — restriction should be active' : 'Max ' + maxConsec + ' consecutive losing day(s)' },
      { ok: maxConsec < 10, label: '10 consecutive losing days → stand-down', detail: maxConsec >= 10 ? 'Edge falsification triggered' : 'Not triggered' }
    ];

    return { kpi, dayList, rules, maxConsec, openLots };
  }

  function weeklyMaxLossDays(dayList, dailyMax) {
    // group by ISO week; a "max-loss day" = day net loss at/over the $dailyMax cap.
    // flag if a 2nd max-loss day occurs and trading continues that week.
    const weeks = {};
    for (const d of dayList) { const wk = isoWeek(d.day); (weeks[wk] = weeks[wk] || []).push(d); }
    for (const wk in weeks) {
      const ds = weeks[wk].sort((a, b) => a.day.localeCompare(b.day));
      let cnt = 0, triggerDay = null, tradedAfter = 0;
      for (const d of ds) {
        if (triggerDay) tradedAfter += d.trades;
        if (d.pnl <= -dailyMax) { cnt++; if (cnt === 2 && !triggerDay) triggerDay = d.day; }
      }
      if (triggerDay) return { flagged: tradedAfter > 0, reached: true, triggerDay, tradedAfter };
    }
    return { flagged: false, reached: false };
  }
  function isoWeek(ymd) {
    const [y, m, d] = ymd.split('-').map(Number); const dt = new Date(y, m - 1, d);
    const oneJan = new Date(dt.getFullYear(), 0, 1);
    return dt.getFullYear() + '-W' + Math.ceil(((dt - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
  }

  /* -------------------- rendering -------------------- */
  const money = (x) => (x < 0 ? '−$' : '$') + Math.abs(x).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (x) => (x * 100).toFixed(0) + '%';

  function render(res, trades, openLots) {
    $('empty').style.display = 'none';
    $('dash').style.display = 'block';
    const k = res.kpi;
    setKPI('k-net', money(k.net), k.net >= 0 ? 'good' : 'bad');
    setKPI('k-trades', k.n + '');
    setKPI('k-win', pct(k.winRate));
    setKPI('k-pf', isFinite(k.pf) ? k.pf.toFixed(2) : '∞');
    setKPI('k-avgr', (k.avgR >= 0 ? '+' : '') + k.avgR.toFixed(2) + 'R', k.avgR >= 0 ? 'good' : 'bad');
    setKPI('k-days', k.daysTraded + '');
    setKPI('k-avgwin', money(k.avgWin), 'good');
    setKPI('k-avgloss', money(k.avgLoss), 'bad');
    setKPI('k-best', money(k.bestDay), 'good');
    setKPI('k-worst', money(k.worstDay), 'bad');
    setKPI('k-losingdays', k.losingDays + '');
    setKPI('k-consec', res.maxConsec + '');

    // rule checklist
    let rh = '';
    for (const r of res.rules) {
      rh += '<div class="rule-row ' + (r.ok ? 'pass' : 'flag') + '"><span class="rule-ic">' + (r.ok ? '✓' : '!') +
        '</span><div><div class="rule-lbl">' + r.label + '</div><div class="rule-det">' + r.detail + '</div></div></div>';
    }
    $('rules').innerHTML = rh;
    const flags = res.rules.filter(r => !r.ok).length;
    $('rule-summary').innerHTML = flags === 0
      ? '<span class="pass-tag">All rules clean</span>'
      : '<span class="flag-tag">' + flags + ' rule flag' + (flags > 1 ? 's' : '') + '</span>';

    // daily table
    let dh = '<table class="rules"><thead><tr><th>Day</th><th>Trades</th><th>Losses</th><th>Max ES</th><th>Daily cap</th><th>Net P&L</th></tr></thead><tbody>';
    for (const d of res.dayList) {
      const over = d.pnl < -RULES.dailyMaxLoss;
      dh += '<tr><td class="mono">' + d.day + '</td><td class="mono">' + d.trades + '</td><td class="mono">' + d.losses +
        '</td><td class="mono">' + d.maxContracts + '</td><td class="mono">' + money(-RULES.dailyMaxLoss) +
        '</td><td class="mono" style="color:' + (d.pnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + money(d.pnl) +
        (over ? ' ⚠' : '') + '</td></tr>';
    }
    $('daily-table').innerHTML = dh + '</tbody></table>';

    // trade table
    let th = '<table class="rules"><thead><tr><th>Exit time</th><th>Sym</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>Pts</th><th>R</th><th>P&L</th></tr></thead><tbody>';
    for (const t of trades) {
      th += '<tr><td class="mono">' + t.exitTime + '</td><td class="mono">' + t.prod + '</td><td>' + t.side +
        '</td><td class="mono">' + t.qty + '</td><td class="mono">' + t.entry + '</td><td class="mono">' + t.exit +
        '</td><td class="mono">' + t.points.toFixed(2) + '</td><td class="mono">' + (t.r >= 0 ? '+' : '') + t.r.toFixed(2) +
        '</td><td class="mono" style="color:' + (t.pnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + money(t.pnl) + '</td></tr>';
    }
    $('trade-table').innerHTML = th + '</tbody></table>';

    $('openpos').innerHTML = openLots.length
      ? '<b class="warn">Open at end of file:</b> ' + openLots.map(l => l.sym + ' ' + (l.qty > 0 ? 'long ' : 'short ') + Math.abs(l.qty) + ' @ ' + l.px).join(' · ')
      : 'Flat at end of file — all positions closed.';

    drawCharts(res.dayList, trades);
    renderTargets(trades);
  }
  function setKPI(id, v, cls) { const el = $(id); el.textContent = v; el.className = 'v' + (cls ? ' ' + cls : ''); }

  /* -------------------- target tracking ($X/month per ES) -------------------- */
  const esEquiv = (t) => t.prod === 'MES' ? t.qty / 10 : t.qty;

  function buildWeeks(trades) {
    const wk = {};
    for (const t of trades) {
      const w = isoWeek(t.day);
      const o = wk[w] || (wk[w] = { week: w, days: new Set(), pnl: 0, trades: 0, esSum: 0, first: t.day, last: t.day });
      o.days.add(t.day); o.pnl += t.pnl; o.trades++; o.esSum += esEquiv(t);
      if (t.day < o.first) o.first = t.day; if (t.day > o.last) o.last = t.day;
    }
    return Object.values(wk).map(o => ({ ...o, tradingDays: o.days.size, avgES: o.esSum / o.trades }))
      .sort((a, b) => a.first.localeCompare(b.first));
  }

  function renderTargets(trades) {
    const quarterlyPerES = parseFloat($('tgt-quarterly').value) || 10000;
    const tradingMonths = parseFloat($('tgt-months').value) || 10;
    const weeklyPerES = quarterlyPerES / 13;                 // 13 weeks per quarter
    const annualPerES = quarterlyPerES * (tradingMonths / 3);
    $('tgt-rates').innerHTML = 'Weekly / ES: <b class="mono">' + money(weeklyPerES) + '</b><br>Quarterly / ES: <b class="mono">' + money(quarterlyPerES) + '</b><br>Annual / ES: <b class="mono">' + money(annualPerES) + '</b>';

    const weeks = buildWeeks(trades);
    let totPnl = 0, totTarget = 0;
    let rows = '<table class="rules"><thead><tr><th>Week</th><th>Days</th><th>Avg ES</th><th>P&L</th><th>Target</th><th>% of target</th><th></th></tr></thead><tbody>';
    for (const w of weeks) {
      const target = weeklyPerES * w.avgES;
      const pctv = target ? (w.pnl / target * 100) : 0;
      const ok = w.pnl >= target;
      totPnl += w.pnl; totTarget += target;
      rows += '<tr><td class="mono">' + w.first + '–' + w.last.slice(5) + '</td><td class="mono">' + w.tradingDays +
        '</td><td class="mono">' + w.avgES.toFixed(2) + '</td><td class="mono" style="color:' + (w.pnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + money(w.pnl) +
        '</td><td class="mono">' + money(target) + '</td><td class="mono">' + pctv.toFixed(0) + '%</td><td>' +
        '<span class="' + (ok ? 'pass-tag' : 'flag-tag') + '">' + (ok ? 'on pace' : 'behind') + '</span></td></tr>';
    }
    $('tgt-table').innerHTML = rows + '</tbody></table>';

    const gap = totPnl - totTarget;
    $('tgt-headline').innerHTML = weeks.length
      ? 'Across ' + weeks.length + ' week' + (weeks.length > 1 ? 's' : '') + ': <b class="mono" style="color:' + (totPnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + money(totPnl) +
        '</b> vs target <b class="mono">' + money(totTarget) + '</b> — ' +
        '<b style="color:' + (gap >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (gap >= 0 ? 'ahead by ' : 'behind by ') + money(Math.abs(gap)) + '</b>.'
      : 'No trades to measure.';
    const sumOk = totPnl >= totTarget;
    $('tgt-summary').innerHTML = weeks.length ? '<span class="' + (sumOk ? 'pass-tag' : 'flag-tag') + '">' + (sumOk ? 'on pace' : 'behind target') + '</span>' : '';

    // 3-month qualification: scaling unlocks only after N months hitting $3k at 1 ES
    const months = {};
    for (const t of trades) { const mk = t.day.slice(0, 7); const o = months[mk] || (months[mk] = { key: mk, pnl: 0 }); o.pnl += t.pnl; }
    const monthList = Object.values(months).sort((a, b) => a.key.localeCompare(b.key));
    const need = RULES.scaleQualifyMonths;
    const qualMonthly = RULES.perESPerMonthDefault;          // $3,000 / 1 ES qualification threshold
    const qualified = monthList.filter(mo => mo.pnl >= qualMonthly);
    const unlocked = qualified.length >= need;
    $('tgt-qual').innerHTML = '<b>Scaling status:</b> <span class="' + (unlocked ? 'pass-tag' : 'flag-tag') + '">' +
      (unlocked ? 'UNLOCKED' : 'LOCKED') + '</span> — ' + qualified.length + ' of ' + need +
      ' qualifying months (a month ≥ ' + money(qualMonthly) + ' at 1 ES). ' +
      (unlocked ? 'You may scale +1 ES per margin unit.' : 'Trade 1 ES until ' + need + ' qualifying months are banked.');
  }

  function drawCharts(dayList, trades) {
    const dpnl = $('chart-daily').getContext('2d');
    if (pnlChart) pnlChart.destroy();
    pnlChart = new Chart(dpnl, {
      type: 'bar',
      data: { labels: dayList.map(d => d.day), datasets: [{ label: 'Daily P&L', data: dayList.map(d => d.pnl),
        backgroundColor: dayList.map(d => d.pnl >= 0 ? 'rgba(111,174,142,.8)' : 'rgba(201,96,90,.8)') }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        scales: { x: { ticks: { color: '#B9C0CF' }, grid: { color: 'rgba(46,67,115,.5)' } },
          y: { ticks: { color: '#B9C0CF', callback: v => '$' + v }, grid: { color: 'rgba(46,67,115,.5)' } } },
        plugins: { legend: { display: false } } }
    });

    let cum = 0; const eq = trades.map(t => (cum += t.pnl));
    const eqx = $('chart-equity').getContext('2d');
    if (eqChart) eqChart.destroy();
    eqChart = new Chart(eqx, {
      type: 'line',
      data: { labels: trades.map((t, i) => i + 1), datasets: [{ label: 'Cumulative P&L', data: eq, borderColor: '#C8A951',
        backgroundColor: 'rgba(200,169,81,.12)', borderWidth: 2, fill: true, pointRadius: 0, tension: .15 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        scales: { x: { title: { display: true, text: 'trade #', color: '#B9C0CF' }, ticks: { color: '#B9C0CF' }, grid: { color: 'rgba(46,67,115,.5)' } },
          y: { ticks: { color: '#B9C0CF', callback: v => '$' + v }, grid: { color: 'rgba(46,67,115,.5)' } } },
        plugins: { legend: { display: false } } }
    });
  }

  /* -------------------- config + file handling -------------------- */
  function reanalyze() {
    if (!lastTrades) return;
    render(analyze(lastTrades.trades, lastTrades.openLots), lastTrades.trades, lastTrades.openLots);
  }

  function handleText(text) {
    try {
      const fills = parseTradovate(text);
      if (!fills.length) { alert('No filled orders found in this file.'); return; }
      const built = buildTrades(fills);
      lastTrades = built; lastFills = fills;
      reanalyze();
    } catch (e) { alert('Could not parse: ' + e.message); }
  }

  $('file').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    $('fname').textContent = f.name;
    const reader = new FileReader();
    reader.onload = () => handleText(reader.result);
    reader.readAsText(f);
  });
  $('tgt-quarterly').addEventListener('input', reanalyze);
  $('tgt-months').addEventListener('input', reanalyze);

  // drag & drop
  const zone = $('drop');
  ['dragover', 'dragenter'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('over'); }));
  zone.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) { $('fname').textContent = f.name; const r = new FileReader(); r.onload = () => handleText(r.result); r.readAsText(f); } });
})();
