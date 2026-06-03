/* =============================================================================
   10x Account — UI wiring (spec §4 / §5). No persistence; in-memory only (§7).
   engine.js is loaded before this file → RULES, EDGE_ILLUSTRATIVE, helpers exist.
   ============================================================================= */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let edge = cloneEdge(EDGE_ILLUSTRATIVE);
  let policy = 'conservative';
  let capital = RULES.startingCapital;
  let chart = null;

  /* -------------------- mode toggle (operator / investor) -------------------- */
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
    $('c-freq').value = edge.C.frequencyPerDay;
    $('c-val').value  = edge.C.validationRate;
    $('c-p').value    = edge.C.winRate;
    $('c-win').value  = edge.C.avgWinPoints;
    $('d-freq').value = edge.D.frequencyPerDay;
    $('d-p').value    = edge.D.winRate;
    $('d-win').value  = edge.D.avgWinPoints;
    $('conf').value   = edge.confluenceRate;
  }
  function readEdgeInputs() {
    const num = (id, d) => { const v = parseFloat($(id).value); return isFinite(v) ? v : d; };
    edge.C.frequencyPerDay = num('c-freq', 0);
    edge.C.validationRate  = num('c-val', 0);
    edge.C.winRate         = num('c-p', 0);
    edge.C.avgWinPoints    = num('c-win', 0);
    edge.D.frequencyPerDay = num('d-freq', 0);
    edge.D.winRate         = num('d-p', 0);
    edge.D.avgWinPoints    = num('d-win', 0);
    edge.confluenceRate    = num('conf', 0);
    refreshClosedForm();
  }
  ['c-freq','c-val','c-p','c-win','d-freq','d-p','d-win','conf']
    .forEach((id) => $(id).addEventListener('input', readEdgeInputs));

  $('reset-edge').addEventListener('click', () => { edge = cloneEdge(EDGE_ILLUSTRATIVE); writeEdgeInputs(); refreshClosedForm(); });
  $('clear-edge').addEventListener('click', () => {
    edge = { C:{frequencyPerDay:0,validationRate:0,winRate:0,avgWinPoints:0}, D:{frequencyPerDay:0,winRate:0,avgWinPoints:0}, confluenceRate:0 };
    writeEdgeInputs(); refreshClosedForm();
  });

  /* capital is locked at $10k for v0.5 (sizing calibrated to the floor); no handler. */

  /* -------------------- policy segmented control -------------------- */
  $('policy').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    policy = b.dataset.policy;
    [...$('policy').children].forEach((x) => x.classList.toggle('active', x === b));
  });

  /* -------------------- closed-form sanity layer (§4.4) -------------------- */
  function fmtMoney(x) { return (x < 0 ? '−$' : '$') + Math.abs(Math.round(x)).toLocaleString(); }
  function refreshClosedForm() {
    const perDay = expectedDollarsPerDay(edge);
    // sizing-vs-floor check: warn if any worst-case single-trade loss nears/exceeds DLL
    const dll = Math.round(capital * RULES.DLL_pct);
    const expoLoss = maxSingleTradeLoss('C_validated', RULES.scaleUp.confluenceMultiplier); // 8 ES nominal
    let msg = 'Arithmetic expectation ≈ <b class="mono">' + fmtMoney(perDay) +
      '/day</b> at the dialed edge. The simulator gives the (lower) <em>geometric</em> reality — drawdown drag and sit-out idle time.';
    if (expoLoss >= dll) {
      msg += ' <span class="warn">Sizing-vs-floor: a ×4 confluence trade’s nominal stop ($' +
        expoLoss.toLocaleString() + ') exceeds the $' + dll.toLocaleString() +
        ' floor — realized loss is capped at the remaining floor room.</span>';
    }
    $('closedform').innerHTML = msg;
  }

  /* -------------------- run a Monte Carlo batch in the worker -------------------- */
  function runBatch(pol, onDone, onProgress) {
    const w = new Worker('worker.js');
    w.onmessage = (e) => {
      if (e.data.type === 'progress') { onProgress && onProgress(e.data.done, e.data.total); }
      else if (e.data.type === 'done') { onDone(e.data.result); w.terminate(); }
    };
    w.postMessage({ edge: cloneEdge(edge), policy: pol, paths: 10000 });
  }

  function fmtDays(d) { return d == null ? '—' : (d / 252).toFixed(1) + ' yr'; }
  function pct(x) { return (x * 100).toFixed(1) + '%'; }

  /* -------------------- render selected-policy results + chart -------------------- */
  function renderMain(res) {
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
    $('t-conf').textContent  = per1k(res.telemetry.confluenceFires);

    drawFan(res.fan);
  }

  function drawFan(fan) {
    const ctx = $('fan').getContext('2d');
    const gold = '#C8A951', goldFill = 'rgba(200,169,81,.14)';
    const data = {
      labels: fan.days.map((d) => (d / 252).toFixed(1)),
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
        y: { title: { display: true, text: 'equity ($)', color: '#B9C0CF' }, ticks: { color: '#B9C0CF', callback: (v) => '$' + (v / 1000) + 'k' }, grid: { color: 'rgba(46,67,115,.5)' } }
      },
      plugins: { legend: { labels: { color: '#F3EFE6', font: { family: 'JetBrains Mono' } } } }
    };
    if (chart) chart.destroy();
    chart = new Chart(ctx, { type: 'line', data, options: opts });
  }

  function renderCmpRow(prefix, res) {
    $(prefix + '-med').textContent  = fmtDays(res.medianDaysTo10x);
    $(prefix + '-dd').textContent   = pct(res.modeledMaxDDpct);
    $(prefix + '-ruin').textContent = pct(res.pRuin);
    $(prefix + '-fals').textContent = pct(res.pFalsified);
  }

  /* -------------------- RUN button: selected policy + both for comparison -------------------- */
  $('run').addEventListener('click', () => {
    readEdgeInputs();
    const btn = $('run'); btn.disabled = true;
    $('progress').textContent = 'Simulating…';

    // run the selected policy for the main panel + chart
    runBatch(policy, (res) => {
      renderMain(res);
      renderCmpRow(policy === 'conservative' ? 'c' : 'a', res);
      // run the *other* policy to fill the comparison table
      const other = policy === 'conservative' ? 'aggressive' : 'conservative';
      runBatch(other, (res2) => {
        renderCmpRow(other === 'conservative' ? 'c' : 'a', res2);
        btn.disabled = false; $('progress').textContent = 'Done · 2 × 10,000 paths.';
      });
    }, (done, total) => { $('progress').textContent = 'Simulating… ' + Math.round(done / total * 100) + '%'; });
  });

  /* -------------------- init -------------------- */
  writeEdgeInputs();
  refreshClosedForm();
})();
