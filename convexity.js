/* =============================================================================
   Convexity Experiment — chart rebuilds + light interactivity.
   The original page drove these from external data/render scripts that weren't
   provided; here the three figures are rebuilt in Chart.js with STATIC,
   ILLUSTRATIVE data (matching the source SVGs' intent), themed to the cockpit.
   Live-data panels are pre-launch placeholders. No data leaves the browser.
   ============================================================================= */
(function () {
  'use strict';

  const NAVY = '#1B2A4A', GOLD = '#C8A951', IVORY = '#F3EFE6', DIM = '#B9C0CF',
        RED = '#C9605A', GREEN = '#1F8C4F', BLUE = '#185FA5', ORANGE = '#E89B3D',
        GRID = 'rgba(46,67,115,.5)';

  const baseScaleColor = { ticks: { color: DIM }, grid: { color: GRID } };

  /* ---- 1) Gamma explosion / asymmetric risk-reward (dual axis) ----------- */
  function gammaDeltaChart() {
    const el = document.getElementById('cx-gamma'); if (!el) return;
    const xs = [], gamma = [], delta = [];
    const sigma = 0.13, k = 7;
    for (let x = -1; x <= 1.0001; x += 0.02) {
      xs.push(x.toFixed(2));
      gamma.push(Math.exp(-(x * x) / (2 * sigma * sigma)));        // sharp ATM spike
      delta.push(1 / (1 + Math.exp(-k * x)));                       // S-curve 0→1
    }

    // custom plugin: RISK / REWARD annotations + green reward arrow
    const annot = {
      id: 'cxAnnot',
      afterDraw(c) {
        const { ctx, chartArea: a } = c;
        ctx.save();
        ctx.font = '700 20px "DM Sans", sans-serif';
        ctx.fillStyle = BLUE;
        ctx.fillText('RISK', a.left + a.width * 0.16, a.top + a.height * 0.52);
        ctx.font = '13px "DM Sans", sans-serif'; ctx.fillStyle = DIM;
        ctx.fillText('Limited premium at entry', a.left + a.width * 0.16, a.top + a.height * 0.52 + 20);

        ctx.font = '700 20px "DM Sans", sans-serif'; ctx.fillStyle = GREEN;
        ctx.fillText('REWARD', a.left + a.width * 0.62, a.top + a.height * 0.30);
        ctx.font = '13px "DM Sans", sans-serif'; ctx.fillStyle = DIM;
        ctx.fillText('Small move in underlying →', a.left + a.width * 0.62, a.top + a.height * 0.30 + 20);
        ctx.fillText('delta jumps from −0.2 to 0.8', a.left + a.width * 0.62, a.top + a.height * 0.30 + 38);

        // green up-arrow on the right
        const ax = a.left + a.width * 0.88, ay0 = a.bottom - 6, ay1 = a.top + a.height * 0.34;
        ctx.strokeStyle = GREEN; ctx.fillStyle = GREEN; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(ax, ay0); ctx.lineTo(ax, ay1 + 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax - 10, ay1 + 12); ctx.lineTo(ax, ay1); ctx.lineTo(ax + 10, ay1 + 12); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    };

    new Chart(el, {
      type: 'line',
      data: {
        labels: xs,
        datasets: [
          { label: 'Gamma (intraday spike, short-dated)', data: gamma, borderColor: BLUE, borderWidth: 3, pointRadius: 0, yAxisID: 'yG', tension: .35 },
          { label: 'Delta (directional exposure)', data: delta, borderColor: ORANGE, borderWidth: 3, pointRadius: 0, yAxisID: 'yD', tension: .4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: { ...baseScaleColor, title: { display: true, text: 'Underlying price / moneyness', color: DIM }, ticks: { color: DIM, maxTicksLimit: 5, callback: () => '' } },
          yG: { ...baseScaleColor, position: 'left', title: { display: true, text: 'Gamma', color: DIM }, ticks: { display: false } },
          yD: { position: 'right', title: { display: true, text: 'Delta', color: DIM }, ticks: { display: false }, grid: { drawOnChartArea: false } }
        },
        plugins: { legend: { labels: { color: IVORY, font: { family: 'JetBrains Mono' }, boxWidth: 12 } } }
      },
      plugins: [annot]
    });
  }

  /* ---- 2) Earned-doubling mechanism (size as fn of won buffer) ------------ */
  function mechanismChart() {
    const el = document.getElementById('cx-mechanism'); if (!el) return;
    // cumulative R rising through 1×/2×/4× then reverting one step
    const pts = [0,1,2,4,6,9,8,12,15,18,22,26,30,24,19,18];
    const labels = pts.map((_, i) => i + 1);
    new Chart(el, {
      type: 'line',
      data: { labels, datasets: [{
        label: 'Cumulative R (illustrative)', data: pts, borderColor: ORANGE, borderWidth: 2.5,
        pointBackgroundColor: (ctx) => [5, 9, 12].includes(ctx.dataIndex) ? GOLD : ORANGE,
        pointRadius: (ctx) => [5, 9, 12].includes(ctx.dataIndex) ? 5 : 0, tension: .25
      }]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: { ...baseScaleColor, title: { display: true, text: 'Trade sequence →', color: DIM } },
          y: { ...baseScaleColor, title: { display: true, text: 'Won buffer (R)', color: DIM } }
        },
        plugins: { legend: { labels: { color: IVORY, font: { family: 'JetBrains Mono' }, boxWidth: 12 } } }
      }
    });
  }

  /* ---- 3) Aspirational equity arc (log scale, 1×→16×, trailing floor) ----- */
  function equityArcChart() {
    const el = document.getElementById('cx-equity'); if (!el) return;
    const months = [0,1,2,3,4,5,6,7,8,9,10,11,12];
    // engine: geometric 1→16 across 12 months (illustrative cooperative arc)
    const engine = months.map(m => Math.pow(2, (m / 12) * 4));     // 1 → 16
    // trailing floor: step up at each doubling, held at peak − 12%
    const floor  = [0.95,0.95,0.95,1.76,1.76,1.76,3.52,3.52,3.52,7.04,7.04,7.04,14.08];
    new Chart(el, {
      type: 'line',
      data: { labels: months.map(m => m + ' mo'), datasets: [
        { label: 'Engine balance (× working unit)', data: engine, borderColor: GOLD, backgroundColor: 'rgba(200,169,81,.14)', borderWidth: 2.6, fill: true, tension: .3,
          pointBackgroundColor: GOLD, pointBorderColor: NAVY, pointBorderWidth: 2,
          pointRadius: (ctx) => [3,6,9,12].includes(ctx.dataIndex) ? 6 : 0 },
        { label: 'Trailing floor (peak − 12%)', data: floor, borderColor: RED, borderWidth: 1.8, borderDash: [6,4], pointRadius: 0, fill: false, stepped: true }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
          x: { ...baseScaleColor, title: { display: true, text: 'months (visual proxy for regime-window time)', color: DIM } },
          y: { type: 'logarithmic', position: 'left', grid: { color: GRID },
               title: { display: true, text: '× working unit ($5K base) · log scale', color: DIM },
               min: 0.9, max: 18,
               ticks: { color: DIM, callback: (v) => [1,2,4,8,16].includes(v) ? v + '×' : '' } }
        },
        plugins: { legend: { labels: { color: IVORY, font: { family: 'JetBrains Mono' }, boxWidth: 12 } } }
      }
    });
  }

  /* ---- reach-out form: enable submit when valid (no real endpoint yet) ---- */
  function reachForm() {
    const form = document.getElementById('reach-form'); if (!form) return;
    const btn = document.getElementById('reach-submit');
    const fields = ['reach-name', 'reach-email', 'reach-msg'].map(id => document.getElementById(id));
    const check = () => { btn.disabled = !form.checkValidity(); };
    fields.forEach(f => f && f.addEventListener('input', check));
    check();
  }

  function init() {
    if (typeof Chart !== 'undefined') {
      Chart.defaults.color = DIM;
      Chart.defaults.font.family = 'DM Sans, sans-serif';
      gammaDeltaChart(); mechanismChart(); equityArcChart();
    }
    reachForm();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
