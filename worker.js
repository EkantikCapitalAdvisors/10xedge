/* =============================================================================
   Monte Carlo Web Worker (spec §4.2 / §7).
   Runs N paths off the main thread, aggregates the honest distribution, and
   posts back percentile fan + downside + telemetry. No data leaves the browser.
   ============================================================================= */
importScripts('engine.js');

function percentile(sortedArr, q) {
  if (!sortedArr.length) return 0;
  const idx = (sortedArr.length - 1) * q;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
}

self.onmessage = function (e) {
  const { edge, policy, paths } = e.data;
  const N = paths || 10000;

  const target = RULES.startingCapital * RULES.target.multiple;
  const maxSnaps = Math.ceil(RULES.sim.timeCapDays / RULES.sim.snapshotEvery) + 1;

  // per-snapshot arrays of capital across paths (carry terminal value forward)
  const snapCols = Array.from({ length: maxSnaps }, () => new Float64Array(N));

  const timesTo10x = [];
  const maxDDs = new Float64Array(N);
  let nRuin = 0, n10x = 0, nFalsified = 0, nTimecap = 0;
  const tel = { floorHits: 0, weekOuts: 0, restrictions: 0, confluenceFires: 0, redDays: 0, totalDays: 0 };

  for (let i = 0; i < N; i++) {
    const r = simulatePath(edge, policy, (i * 2654435761) ^ 0x9e3779b9);

    // fill snapshot columns, carrying the terminal capital forward to the cap
    const term = (r.outcome === '10x') ? target : (r.outcome === 'ruin') ? 0 : r.finalCapital;
    for (let s = 0; s < maxSnaps; s++) {
      snapCols[s][i] = (s < r.snapshots.length) ? r.snapshots[s] : term;
    }

    maxDDs[i] = r.maxDrawdownPct;
    if (r.outcome === '10x') { n10x++; timesTo10x.push(r.days); }
    else if (r.outcome === 'ruin') nRuin++;
    else if (r.outcome === 'falsified') nFalsified++;
    else nTimecap++;

    tel.floorHits += r.telemetry.floorHits;
    tel.weekOuts += r.telemetry.weekOuts;
    tel.restrictions += r.telemetry.restrictions;
    tel.confluenceFires += r.telemetry.confluenceFires;
    tel.redDays += r.telemetry.redDays;
    tel.totalDays += r.telemetry.days;

    if ((i & 511) === 0) self.postMessage({ type: 'progress', done: i, total: N });
  }

  // build P10 / P50 / P90 equity fan over time
  const fan = { days: [], p10: [], p50: [], p90: [] };
  for (let s = 0; s < maxSnaps; s++) {
    const col = Array.from(snapCols[s]).sort((a, b) => a - b);
    fan.days.push(s * RULES.sim.snapshotEvery);
    fan.p10.push(percentile(col, 0.10));
    fan.p50.push(percentile(col, 0.50));
    fan.p90.push(percentile(col, 0.90));
  }

  timesTo10x.sort((a, b) => a - b);
  const ddSorted = Array.from(maxDDs).sort((a, b) => a - b);

  self.postMessage({
    type: 'done',
    result: {
      paths: N,
      p10x: n10x / N,
      pRuin: nRuin / N,
      pFalsified: nFalsified / N,
      pTimecap: nTimecap / N,
      medianDaysTo10x: timesTo10x.length ? percentile(timesTo10x, 0.5) : null,
      p10DaysTo10x: timesTo10x.length ? percentile(timesTo10x, 0.10) : null,
      p90DaysTo10x: timesTo10x.length ? percentile(timesTo10x, 0.90) : null,
      modeledMaxDDpct: percentile(ddSorted, 0.95),  // worst-case (95th pct) total DD
      medianMaxDDpct: percentile(ddSorted, 0.50),
      fan,
      telemetry: tel
    }
  });
};
