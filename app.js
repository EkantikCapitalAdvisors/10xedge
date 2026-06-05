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
  let mcChart = null, yrChart = null;

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

  /* -------------------- deterministic year projection -------------------- */
  function drawYear() {
    const rows = yearProjection(monthly, 12);
    const last = rows[rows.length - 1];
    $('year-sub').textContent = '— assuming +' + money(monthly) + ' / month';
    $('y-end').textContent = money(last.capital);
    $('y-es').textContent = last.es + ' ES';
    const m10 = monthsTo10x(monthly);
    $('y-to10x').innerHTML = isFinite(m10)
      ? 'At +' + money(monthly) + '/month, <b>10× ($100,000) is reached around month ' + m10 +
        '</b> (~' + (m10 / 12).toFixed(1) + ' yr) on this flat-rate path.'
      : 'At $0/month the target is never reached.';

    const data = {
      labels: rows.map(r => 'm' + r.month),
      datasets: [
        { label: 'Capital', data: rows.map(r => r.capital), borderColor: '#C8A951', backgroundColor: 'rgba(200,169,81,.14)', borderWidth: 2.6, fill: true, tension: .2, yAxisID: 'y', pointRadius: 0 },
        { label: 'Position size (ES)', data: rows.map(r => r.es), borderColor: '#6FAE8E', borderWidth: 1.8, stepped: true, fill: false, yAxisID: 'yes', pointRadius: 0 }
      ]
    };
    const opts = {
      responsive: true, maintainAspectRatio: false, animation: false,
      scales: {
        x: { ticks: { color: '#B9C0CF' }, grid: { color: 'rgba(46,67,115,.5)' } },
        y: { position: 'left', title: { display: true, text: 'capital ($)', color: '#B9C0CF' }, ticks: { color: '#B9C0CF', callback: v => '$' + (v / 1000) + 'k' }, grid: { color: 'rgba(46,67,115,.5)' } },
        yes: { position: 'right', title: { display: true, text: 'ES contracts', color: '#6FAE8E' }, ticks: { color: '#6FAE8E', precision: 0 }, grid: { drawOnChartArea: false } }
      },
      plugins: { legend: { labels: { color: '#F3EFE6', font: { family: 'JetBrains Mono' }, boxWidth: 12 } } }
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
    w.postMessage({ edge: cloneEdge(edge), policy: 'n/a', paths: 10000 });
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
        x: { title: { display: true, text: 'years', color: '#B9C0CF' }, ticks: { color: '#B9C0CF', maxTicksLimit: 8 }, grid: { color: 'rgba(46,67,115,.5)' } },
        y: { title: { display: true, text: 'equity ($)', color: '#B9C0CF' }, ticks: { color: '#B9C0CF', callback: v => '$' + (v / 1000) + 'k' }, grid: { color: 'rgba(46,67,115,.5)' } }
      },
      plugins: { legend: { labels: { color: '#F3EFE6', font: { family: 'JetBrains Mono' } } } }
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
