/* =============================================================================
   10x Account — UI wiring (simplified paradigm). No persistence; in-memory only.
   engine.js is loaded first → RULES, EDGE_ILLUSTRATIVE, esCount, yearProjection,
   monthsTo10x, expectedDollarsPerDayAt, simulatePath, cloneEdge are in scope.
   ============================================================================= */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let edge = cloneEdge(EDGE_ILLUSTRATIVE);
  let monthly = 3000;
  let mcMargin = RULES.brokers.tradovate.marginPerES;
  let mcChart = null, yrChart = null;
  const TRAD = RULES.brokers.tradovate.marginPerES;   // 10000
  const IBKR = RULES.brokers.ibkr.marginPerES;        // 30000

  /* -------------------- mode toggle -------------------- */
  function setMode(mode) {
    document.body.dataset.mode = mode;
    document.documentElement.dataset.mode = mode;
    $('mode-operator').classList.toggle('active', mode === 'operator');
    $('mode-investor').classList.toggle('active', mode === 'investor');
  }
  $('mode-operator').addEventListener('click', () => setMode('operator'));
  $('mode-investor').addEventListener('click', () => setMode('investor'));

  /* -------------------- edge panel <-> state -------------------- */
  function writeEdgeInputs() {
    $('e-tpd').value = edge.tradesPerDay;
    $('e-awr').value = edge.avgWinR;
    $('e-wr').value  = edge.winRate;
    $('e-hp').value  = edge.highProbWinRate;
  }
  function readEdgeInputs() {
    const num = (id, d) => { const v = parseFloat($(id).value); return isFinite(v) ? v : d; };
    edge.tradesPerDay     = Math.max(1, Math.round(num('e-tpd', 2)));
    edge.avgWinR          = num('e-awr', 1.4);
    edge.winRate          = num('e-wr', 0.5);
    edge.highProbWinRate  = num('e-hp', 0.62);
    refreshClosedForm();
  }
  ['e-tpd', 'e-awr', 'e-wr', 'e-hp'].forEach((id) => $(id).addEventListener('input', readEdgeInputs));
  $('reset-edge').addEventListener('click', () => { edge = cloneEdge(EDGE_ILLUSTRATIVE); writeEdgeInputs(); refreshClosedForm(); });
  $('clear-edge').addEventListener('click', () => { edge = { tradesPerDay: 1, avgWinR: 0, winRate: 0, highProbWinRate: 0 }; writeEdgeInputs(); refreshClosedForm(); });

  /* -------------------- monthly profit (year projection) -------------------- */
  $('e-monthly').addEventListener('input', () => {
    const v = parseFloat($('e-monthly').value);
    monthly = isFinite(v) && v >= 0 ? v : 0;
    drawYear();
  });

  /* -------------------- MC broker margin toggle -------------------- */
  $('mc-broker').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    mcMargin = parseFloat(b.dataset.margin);
    [...$('mc-broker').children].forEach((x) => x.classList.toggle('active', x === b));
  });

  /* -------------------- helpers -------------------- */
  const money = (x) => '$' + Math.round(x).toLocaleString();
  const fmtDays = (d) => d == null ? '—' : (d / 252).toFixed(1) + ' yr';
  const pct = (x) => (x * 100).toFixed(1) + '%';

  function refreshClosedForm() {
    const perDay1 = expectedDollarsPerDayAt(edge, 1);
    $('closedform').innerHTML = 'Arithmetic expectation ≈ <b class="mono">' + money(perDay1) +
      '/day at 1 ES</b>, scaling up with each added contract. The Monte Carlo gives the (lower, drawdown-dragged) ' +
      'geometric reality.';
  }

  /* -------------------- two broker year projections -------------------- */
  const TRADING = RULES.tradingMonthsPerYear, BREAK = RULES.breakMonthsPerYear;

  function yearTableHTML(rows) {
    let html = '<table class="rules"><thead><tr><th>Mo</th><th>ES</th><th>Profit</th>' +
      '<th>Account</th></tr></thead><tbody>';
    for (const r of rows) {
      const hit = r.capital >= RULES.startingCapital * RULES.target.multiple;
      html += '<tr' + (hit ? ' style="color:var(--gold)"' : '') + '><td class="mono">' + r.month +
        '</td><td class="mono">' + r.es + '</td><td class="mono">' + money(r.monthlyProfit) +
        '</td><td class="mono">' + money(r.capital) + '</td></tr>';
    }
    return html + '</tbody></table>';
  }

  // equity series over the full calendar (trading months active, break months flat)
  function calendarSeries(rows) {
    const s = [RULES.startingCapital];
    rows.forEach(r => s.push(r.capital));
    for (let i = 0; i < BREAK; i++) s.push(rows[rows.length - 1].capital);  // flat break months
    return s;
  }

  function drawYear() {
    const trad = yearProjection(monthly, TRAD, TRADING);
    const ibkr = yearProjection(monthly, IBKR, TRADING);
    $('year-rate').textContent = money(monthly);
    $('y-trad-end').textContent = money(trad[trad.length - 1].capital) + ' · ' + trad[trad.length - 1].es + ' ES';
    $('y-ibkr-end').textContent = money(ibkr[ibkr.length - 1].capital) + ' · ' + ibkr[ibkr.length - 1].es + ' ES';

    const mT = monthsTo10x(monthly, TRAD), mI = monthsTo10x(monthly, IBKR);
    const m10 = (label, m) => !isFinite(m) ? label + ': never at this rate'
      : label + ': month ' + m + ' (' + (m / TRADING).toFixed(1) + ' yr of trading)';
    $('y-to10x').innerHTML = '<b>Months of trading to reach 10× ($100k):</b> ' +
      m10('Tradovate', mT) + ' · ' + m10('Interactive Brokers', mI) + '.';

    $('year-table-trad').innerHTML = yearTableHTML(trad);
    $('year-table-ibkr').innerHTML = yearTableHTML(ibkr);

    const labels = [];
    for (let m = 0; m <= TRADING; m++) labels.push('m' + m);
    for (let b = 1; b <= BREAK; b++) labels.push('break ' + b);

    const data = {
      labels,
      datasets: [
        { label: 'Tradovate (1 ES / $10k)', data: calendarSeries(trad), borderColor: '#C8A951', backgroundColor: 'rgba(200,169,81,.12)', borderWidth: 2.6, fill: true, tension: .2, pointRadius: 0 },
        { label: 'Interactive Brokers (1 ES / $30k)', data: calendarSeries(ibkr), borderColor: '#27406b', borderWidth: 2.2, fill: false, tension: .2, pointRadius: 0 }
      ]
    };
    const opts = {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { color: '#5a6478' }, grid: { color: 'rgba(27,42,74,.10)' } },
        y: { title: { display: true, text: 'account value ($)', color: '#5a6478' }, ticks: { color: '#5a6478', callback: v => '$' + (v / 1000) + 'k' }, grid: { color: 'rgba(27,42,74,.10)' } }
      },
      plugins: { legend: { labels: { color: '#1B2A4A', font: { family: 'JetBrains Mono' }, boxWidth: 12 } } }
    };
    if (yrChart) yrChart.destroy();
    yrChart = new Chart($('yearchart'), { type: 'line', data, options: opts });
  }

  /* -------------------- Monte Carlo -------------------- */
  function runBatch(onDone, onProgress) {
    const w = new Worker('worker.js');
    w.onmessage = (e) => {
      if (e.data.type === 'progress') onProgress && onProgress(e.data.done, e.data.total);
      else if (e.data.type === 'done') { onDone(e.data.result); w.terminate(); }
    };
    w.postMessage({ edge: cloneEdge(edge), marginPerES: mcMargin, paths: 10000 });
  }

  function renderMC(res) {
    $('r-median').textContent = fmtDays(res.medianDaysTo10x);
    $('r-p10x').textContent   = pct(res.p10x);
    $('r-pruin').textContent  = pct(res.pRuin);
    $('r-pfals').textContent  = pct(res.pFalsified);
    $('r-maxdd').textContent  = pct(res.modeledMaxDDpct);
    $('r-meddd').textContent  = pct(res.medianMaxDDpct);

    const days = res.telemetry.totalDays || 1;
    const per1k = (n) => (n / days * 1000).toFixed(1);
    $('t-floor').textContent = per1k(res.telemetry.floorHits);
    $('t-week').textContent  = per1k(res.telemetry.weekOuts);
    $('t-rest').textContent  = per1k(res.telemetry.restrictions);
    $('t-red').textContent   = per1k(res.telemetry.redDays);

    drawFan(res.fan);
  }

  function drawFan(fan) {
    const gold = '#C8A951', goldFill = 'rgba(200,169,81,.14)';
    const data = {
      labels: fan.days.map(d => (d / 252).toFixed(1)),
      datasets: [
        { label: 'P90', data: fan.p90, borderColor: 'rgba(200,169,81,.5)', borderWidth: 1, pointRadius: 0, fill: '+1', backgroundColor: goldFill },
        { label: 'P50 (median)', data: fan.p50, borderColor: gold, borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'P10', data: fan.p10, borderColor: 'rgba(200,169,81,.5)', borderWidth: 1, pointRadius: 0, fill: false }
      ]
    };
    const opts = {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { title: { display: true, text: 'years', color: '#5a6478' }, ticks: { color: '#5a6478', maxTicksLimit: 8 }, grid: { color: 'rgba(27,42,74,.10)' } },
        y: { title: { display: true, text: 'equity ($)', color: '#5a6478' }, ticks: { color: '#5a6478', callback: v => '$' + (v / 1000) + 'k' }, grid: { color: 'rgba(27,42,74,.10)' } }
      },
      plugins: { legend: { labels: { color: '#1B2A4A', font: { family: 'JetBrains Mono' } } } }
    };
    if (mcChart) mcChart.destroy();
    mcChart = new Chart($('fan'), { type: 'line', data, options: opts });
  }

  $('run').addEventListener('click', () => {
    readEdgeInputs();
    const btn = $('run'); btn.disabled = true; $('progress').textContent = 'Simulating…';
    runBatch((res) => {
      renderMC(res);
      btn.disabled = false; $('progress').textContent = 'Done · 10,000 paths.';
    }, (done, total) => { $('progress').textContent = 'Simulating… ' + Math.round(done / total * 100) + '%'; });
  });

  /* -------------------- init -------------------- */
  writeEdgeInputs();
  refreshClosedForm();
  drawYear();
})();
