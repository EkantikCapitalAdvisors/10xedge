/* =============================================================================
   10x Account — engine (margin-driven paradigm, v3).
   Two-object source of truth:
     RULES — the DEFINED, fixed risk architecture. Never edited at runtime.
     EDGE  — the TBD, mutable, *illustrative* edge stats. Always labeled.
   Loaded by the page (app.js) and the Monte Carlo worker (worker.js).

   The simple 10x paradigm (operator-defined):
     • Position size is gated by broker margin: 1 ES per $marginPerES of account.
         - Tradovate (aspirational):       1 ES per $10,000
         - Interactive Brokers (realistic): 1 ES per $30,000
     • Each ES earns ≈ $3,000 / month (the "perES" rate).
     • Daily loss limit: $500 per ES → floor = $500 × current ES count.
     • Calendar: 10 trading months + 2 break months per year.
     • Sit-out: 2 losing days/week → sit out the week.
                3 consecutive losing days → high-probability trades only.
     • Target: 10× starting capital.
   ============================================================================= */

const RULES = Object.freeze({
  startingCapital: 10000,
  esPointValue: 50,
  maxLossPerES: 500,             // per-trade stop: $500 per ES
  dailyMaxLoss: 600,             // hard daily max loss for the strategy ($ flat)
  perESPerMonthDefault: 3000,    // illustrative profit per ES per month

  tradingMonthsPerYear: 10,      // 10 trading months ...
  breakMonthsPerYear: 2,         // ... + 2 break months
  scaleQualifyMonths: 3,         // scaling unlocks only AFTER 3 months of hitting the $3k/1-ES target

  brokers: {
    tradovate: { key: 'tradovate', label: 'Tradovate', tag: 'aspirational', marginPerES: 10000 },
    ibkr:      { key: 'ibkr', label: 'Interactive Brokers', tag: 'realistic', marginPerES: 30000 }
  },

  sitOut: {
    weeklyLossesForWeekOut: 2,
    consecutiveLossesForHighProb: 3,
    tradingDaysPerWeek: 5
  },

  edgeFalsification: { consecutiveLosingDays: 10 },
  target: { multiple: 10 },

  sim: { ruinFloor: 0, timeCapDays: 1260, snapshotEvery: 5 }
});

/* Position size: 1 ES per $marginPerES of account value (min 1 while solvent). */
function esForCapital(capital, marginPerES) {
  if (capital <= 0) return 0;
  return Math.max(1, Math.floor(capital / marginPerES));
}

/* ---------------------------------------------------------------------------
   Deterministic year projection — margin-gated compounding.
   Each trading month: size = 1 ES per $marginPerES of account; profit = perES × ES.
   Profit compounds; break months are flat (no trading, no profit).
   Returns one row per trading month (the break months are appended flat by the UI).
   --------------------------------------------------------------------------- */
function yearProjection(perES, marginPerES, tradingMonths) {
  const rows = [];
  let capital = RULES.startingCapital;
  const qualify = RULES.scaleQualifyMonths;       // first N months locked at 1 ES
  const esAt = (m, cap) => (m <= qualify) ? 1 : esForCapital(cap, marginPerES);
  for (let m = 1; m <= tradingMonths; m++) {
    const es = esAt(m, capital);
    const monthlyProfit = perES * es;
    capital += monthlyProfit;
    rows.push({
      month: m, es, monthlyProfit,
      cumulative: capital - RULES.startingCapital,
      capital,
      nextES: esAt(m + 1, capital),
      dailyFloor: es * RULES.maxLossPerES,
      qualifying: m <= qualify
    });
  }
  return rows;
}

/* Trading months for a given margin + rate to first reach a target account value. */
function monthsToReach(perES, marginPerES, targetCapital) {
  if (perES <= 0) return Infinity;
  const qualify = RULES.scaleQualifyMonths;
  let capital = RULES.startingCapital;
  if (capital >= targetCapital) return 0;
  for (let m = 1; m <= 600; m++) {
    const es = (m <= qualify) ? 1 : esForCapital(capital, marginPerES);
    capital += perES * es;
    if (capital >= targetCapital) return m;
  }
  return Infinity;
}
function monthsTo10x(perES, marginPerES) {
  return monthsToReach(perES, marginPerES, RULES.startingCapital * RULES.target.multiple);
}

/* exports */
if (typeof self !== 'undefined') {
  self.RULES = RULES;
  self.esForCapital = esForCapital;
  self.yearProjection = yearProjection;
  self.monthsToReach = monthsToReach;
  self.monthsTo10x = monthsTo10x;
}
