/* =============================================================================
   10x Account — landing UI (deterministic projections only). In-memory only.
   engine.js is loaded first → RULES, esForCapital, yearProjection, monthsToReach
   are in scope. No Monte Carlo.
   ============================================================================= */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let monthly = 3000;
  let yrChart = null;
  const TRAD = RULES.brokers.tradovate.marginPerES;   // 10000
  const IBKR = RULES.brokers.ibkr.marginPerES;        // 30000
  const TRADING = RULES.tradingMonthsPerYear, BREAK = RULES.breakMonthsPerYear;
  const money = (x) => '$' + Math.round(x).toLocaleString();

  /* -------------------- mode toggle -------------------- */
  function setMode(mode) {
    document.body.dataset.mode = mode;
    document.documentElement.dataset.mode = mode;
    $('mode-operator').classList.toggle('active', mode === 'operator');
    $('mode-investor').classList.toggle('active', mode === 'investor');
  }
  $('mode-operator').addEventListener('click', () => setMode('operator'));
  $('mode-investor').addEventListener('click', () => setMode('investor'));

  /* -------------------- profit-per-ES-per-month rate -------------------- */
  $('e-monthly').addEventListener('input', () => {
    const v = parseFloat($('e-monthly').value);
    monthly = isFinite(v) && v >= 0 ? v : 0;
    drawYear();
  });

  /* -------------------- projections + doubling milestones -------------------- */
  function yearTableHTML(rows) {
    let html = '<table class="rules"><thead><tr><th>Mo</th><th>ES</th><th>Profit</th><th>Account</th></tr></thead><tbody>';
    for (const r of rows) {
      const hit = r.capital >= RULES.startingCapital * RULES.target.multiple;
      html += '<tr' + (hit ? ' style="color:var(--gold-deep)"' : '') + '><td class="mono">' + r.month +
        '</td><td class="mono">' + r.es + '</td><td class="mono">' + money(r.monthlyProfit) +
        '</td><td class="mono">' + money(r.capital) + '</td></tr>';
    }
    return html + '</tbody></table>';
  }

  function calendarSeries(rows) {
    const s = [RULES.startingCapital];
    rows.forEach(r => s.push(r.capital));
    for (let i = 0; i < BREAK; i++) s.push(rows[rows.length - 1].capital);  // flat reserve months
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

    // doubling milestones — strategic goals
    const MS = [
      { mult: '2×', cap: 20000 }, { mult: '4×', cap: 40000 },
      { mult: '8×', cap: 80000 }, { mult: '10× · target', cap: 100000, target: true }
    ];
    const fmtMo = (mo) => !isFinite(mo) ? '—' : 'mo ' + mo + (mo > TRADING ? ' · yr ' + Math.ceil(mo / TRADING) : '');
    $('milestones').innerHTML = MS.map(x => {
      const t = monthsToReach(monthly, TRAD, x.cap), i = monthsToReach(monthly, IBKR, x.cap);
      return '<div class="ms-card' + (x.target ? ' ms-target' : '') + '">' +
        '<div class="ms-mult">' + x.mult + '</div><div class="ms-cap mono">' + money(x.cap) + '</div>' +
        '<div class="ms-row"><span class="badge-asp">Trad</span> <span class="mono">' + fmtMo(t) + '</span></div>' +
        '<div class="ms-row"><span class="badge-real">IBKR</span> <span class="mono">' + fmtMo(i) + '</span></div></div>';
    }).join('');

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

  /* -------------------- init -------------------- */
  drawYear();
})();
