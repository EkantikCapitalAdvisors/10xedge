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
   EDGE — TO BE DEFINED. MUTABLE. ILLUSTRATIVE ONLY.
   1R = $500 per ES (the stop). avgWinR is the open lever.
   --------------------------------------------------------------------------- */
const EDGE_ILLUSTRATIVE = Object.freeze({
  _label: 'illustrative — not this account’s verified record',
  tradesPerDay: 2,
  winRate: 0.50,
  highProbWinRate: 0.62,
  avgWinR: 1.4
});

function cloneEdge(src) {
  return {
    tradesPerDay: src.tradesPerDay,
    winRate: src.winRate,
    highProbWinRate: src.highProbWinRate,
    avgWinR: src.avgWinR
  };
}

function expectedDollarsPerDayAt(edge, esCountNow) {
  const p = edge.winRate;
  const perTradeR = p * edge.avgWinR - (1 - p) * 1;
  let expTrades = 0, surv = 1;
  for (let t = 0; t < edge.tradesPerDay; t++) { expTrades += surv; surv *= p; }
  return perTradeR * expTrades * RULES.maxLossPerES * esCountNow;
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

/* Trading months to cross 10× ($100k account) under a given margin + rate. */
function monthsTo10x(perES, marginPerES) {
  if (perES <= 0) return Infinity;
  const target = RULES.startingCapital * RULES.target.multiple;
  const qualify = RULES.scaleQualifyMonths;
  let capital = RULES.startingCapital;
  for (let m = 1; m <= 600; m++) {
    const es = (m <= qualify) ? 1 : esForCapital(capital, marginPerES);
    capital += perES * es;
    if (capital >= target) return m;
  }
  return Infinity;
}

/* ---------------------------------------------------------------------------
   PRNG — Mulberry32.
   --------------------------------------------------------------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------------------
   Single-path Monte Carlo (margin-gated sizing). Models the 10+2 calendar by
   idling ~2 months/year. simulatePath(edge, marginPerES, seed).
   outcome ∈ '10x' | 'ruin' | 'falsified' | 'timecap'
   --------------------------------------------------------------------------- */
function simulatePath(edge, marginPerES, seed) {
  const rng = mulberry32(seed);
  let capital = RULES.startingCapital;
  const target = RULES.startingCapital * RULES.target.multiple;

  let peak = capital, maxDDpct = 0;
  let consecutiveLosing = 0, highProbOnly = false;
  let weekOutDaysLeft = 0, weeklyLosses = 0, dayInWeek = 0;

  // 10 trading months + 2 break months: idle ~2 of every 12 simulated "months"
  const daysPerMonth = 21;
  const breakStart = RULES.tradingMonthsPerYear * daysPerMonth;   // day-of-year where breaks begin
  const yearLen = (RULES.tradingMonthsPerYear + RULES.breakMonthsPerYear) * daysPerMonth;

  const snapshots = [];
  const tel = { days: 0, floorHits: 0, weekOuts: 0, restrictions: 0, confluenceFires: 0, redDays: 0 };
  let outcome = 'timecap';
  let tradedDays = 0;
  const qualifyDays = RULES.scaleQualifyMonths * daysPerMonth;   // scaling locked at 1 ES until then

  for (let day = 0; day < RULES.sim.timeCapDays; day++) {
    const onBreak = (day % yearLen) >= breakStart;   // 2-month annual break
    const baseES = esForCapital(capital, marginPerES);
    if (baseES === 0) { outcome = 'ruin'; capital = 0; break; }
    const es = tradedDays < qualifyDays ? 1 : baseES;   // first 3 trading months locked at 1 ES

    const dailyFloor = es * RULES.maxLossPerES;
    let dayPnL = 0, lossDay = false;

    if (weekOutDaysLeft > 0) {
      weekOutDaysLeft--;
    } else if (!onBreak) {
      const p = highProbOnly ? edge.highProbWinRate : edge.winRate;
      for (let t = 0; t < edge.tradesPerDay; t++) {
        if (rng() < p) {
          dayPnL += edge.avgWinR * RULES.maxLossPerES * es;
        } else {
          dayPnL -= dailyFloor; lossDay = dayPnL < 0; tel.floorHits++; break;
        }
      }
    }

    capital += dayPnL;
    if (capital < 0) capital = 0;
    tel.days++;
    if (!onBreak) { dayInWeek++; tradedDays++; }

    if (capital > peak) peak = capital;
    const dd = (peak - capital) / peak;
    if (dd > maxDDpct) maxDDpct = dd;
    if (day % RULES.sim.snapshotEvery === 0) snapshots.push(capital);

    if (lossDay) {
      tel.redDays++; consecutiveLosing++; weeklyLosses++;
      if (consecutiveLosing >= RULES.sitOut.consecutiveLossesForHighProb && !highProbOnly) { highProbOnly = true; tel.restrictions++; }
      if (weeklyLosses >= RULES.sitOut.weeklyLossesForWeekOut) {
        const left = RULES.sitOut.tradingDaysPerWeek - dayInWeek;
        if (left > 0) { weekOutDaysLeft = left; tel.weekOuts++; }
      }
    } else if (dayPnL > 0) {
      consecutiveLosing = 0; highProbOnly = false;
    }

    if (dayInWeek >= RULES.sitOut.tradingDaysPerWeek) { dayInWeek = 0; weeklyLosses = 0; }

    if (capital >= target) { outcome = '10x'; break; }
    if (capital <= RULES.sim.ruinFloor) { outcome = 'ruin'; capital = 0; break; }
    if (consecutiveLosing >= RULES.edgeFalsification.consecutiveLosingDays) { outcome = 'falsified'; break; }
  }

  return { outcome, days: tel.days, maxDrawdownPct: maxDDpct, finalCapital: capital, snapshots, telemetry: tel };
}

/* exports */
if (typeof self !== 'undefined') {
  self.RULES = RULES;
  self.EDGE_ILLUSTRATIVE = EDGE_ILLUSTRATIVE;
  self.cloneEdge = cloneEdge;
  self.esForCapital = esForCapital;
  self.expectedDollarsPerDayAt = expectedDollarsPerDayAt;
  self.yearProjection = yearProjection;
  self.monthsTo10x = monthsTo10x;
  self.simulatePath = simulatePath;
}
