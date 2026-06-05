/* =============================================================================
   10x Account — engine (simplified paradigm, v2).
   Two-object source of truth:
     RULES — the DEFINED, fixed risk architecture. Never edited at runtime.
     EDGE  — the TBD, mutable, *illustrative* edge stats. Always labeled.
   Loaded by the page (app.js) and the Monte Carlo worker (worker.js).
   No DOM access here.

   The simple 10x paradigm (operator-defined):
     • Margin to run the engine: 1 ES per $10k of capital.
     • Scale-up: +1 ES for every +$3,000 of accumulated profit (no cap).
     • Daily loss limit: $500 per ES contract  →  floor = $500 × current ES.
       (One full-stop loss = $500 × ES = the whole day's floor → the day ends.)
     • Sit-out: 2 losing days in a week → sit out the rest of the week.
                3 consecutive losing days → high-probability trades only,
                until the next winning day.
     • Target: 10× starting capital.
   ============================================================================= */

const RULES = Object.freeze({
  startingCapital: 10000,        // $10k account
  marginPerES: 10000,            // 1 ES per $10k (entry margin to run the engine)
  esPointValue: 50,              // ES = $50 / point (reference)
  maxLossPerES: 500,             // daily max loss per ES; daily floor = $500 × ES
  scaleUpProfitStep: 3000,       // +1 ES for every +$3,000 of accumulated profit

  sitOut: {
    weeklyLossesForWeekOut: 2,        // 2 losing days in a week → sit out the week
    consecutiveLossesForHighProb: 3,  // 3 consecutive losing days → high-prob only
    tradingDaysPerWeek: 5
  },

  edgeFalsification: { consecutiveLosingDays: 10 }, // edge stand-down → research-only
  target: { multiple: 10 },

  sim: {
    ruinFloor: 0,                  // ruin = full loss of starting capital
    timeCapDays: 1260,             // ~5 trading years
    snapshotEvery: 5               // sample equity every N days for the fan chart
  }
});

/* Position size (ES contracts) at a given capital level.
   1 ES base + one more ES per $3k of accumulated profit. Size tracks capital:
   it de-scales as capital falls, but stays at 1 ES while solvent ($10k/ES is the
   allocation/scaling rule, not a hard margin gate that ruins you below $10k). */
function esCount(capital) {
  if (capital <= 0) return 0;
  const profit = capital - RULES.startingCapital;
  return 1 + Math.max(0, Math.floor(profit / RULES.scaleUpProfitStep));
}

/* ---------------------------------------------------------------------------
   EDGE — TO BE DEFINED. MUTABLE. ILLUSTRATIVE ONLY.
   Loss per trade is fixed by the stop: 1R = $500 per ES. The win size (in R)
   is the open lever. Expectancy is always derived, never entered.
   --------------------------------------------------------------------------- */
const EDGE_ILLUSTRATIVE = Object.freeze({
  _label: 'illustrative — not this account’s verified record',
  tradesPerDay: 2,         // entries attempted per session
  winRate: 0.50,           // normal-mode win probability
  highProbWinRate: 0.62,   // win probability in high-probability-only mode
  avgWinR: 1.4             // average win in R (1R = $500 per ES)
});

function cloneEdge(src) {
  return {
    tradesPerDay: src.tradesPerDay,
    winRate: src.winRate,
    highProbWinRate: src.highProbWinRate,
    avgWinR: src.avgWinR
  };
}

/* ---------------------------------------------------------------------------
   Closed-form sanity layer. ARITHMETIC expectation only (per ES, then scaled).
   --------------------------------------------------------------------------- */
function expectedDollarsPerDayAt(edge, esCountNow) {
  // a losing trade ends the day at -1R; wins pay avgWinR. With one stop/day,
  // expected day ≈ trades attempted weighted by survival, but a clean first-order
  // estimate is: per attempted trade, p·avgWinR − (1−p)·1, in R, × $500 × ES,
  // capped by the one-loss-ends-day structure (so ≈ tradesPerDay only while winning).
  const p = edge.winRate;
  const perTradeR = p * edge.avgWinR - (1 - p) * 1;
  // expected number of trades before the day ends (geometric in losses), bounded by tradesPerDay
  let expTrades = 0, surv = 1;
  for (let t = 0; t < edge.tradesPerDay; t++) { expTrades += surv; surv *= p; }
  return perTradeR * expTrades * RULES.maxLossPerES * esCountNow;
}

/* Deterministic year projection at a fixed monthly profit (the §"Year 1" chart).
   Honors the assumption literally: +monthlyProfit each month, ES steps with capital. */
function yearProjection(monthlyProfit, months) {
  const rows = [];
  for (let m = 0; m <= months; m++) {
    const capital = RULES.startingCapital + monthlyProfit * m;
    const es = esCount(capital);
    rows.push({ month: m, capital, es, dailyFloor: es * RULES.maxLossPerES });
  }
  return rows;
}
function monthsTo10x(monthlyProfit) {
  if (monthlyProfit <= 0) return Infinity;
  const target = RULES.startingCapital * RULES.target.multiple;
  return Math.ceil((target - RULES.startingCapital) / monthlyProfit);
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
   Single-path Monte Carlo simulation (simple paradigm).
   Returns: { outcome, days, maxDrawdownPct, finalCapital, snapshots[], telemetry{} }
   outcome ∈ '10x' | 'ruin' | 'falsified' | 'timecap'
   --------------------------------------------------------------------------- */
function simulatePath(edge, policy, seed) {
  const rng = mulberry32(seed);
  let capital = RULES.startingCapital;
  const target = RULES.startingCapital * RULES.target.multiple;

  let peak = capital, maxDDpct = 0;
  let consecutiveLosing = 0;      // for high-prob-only + falsification
  let highProbOnly = false;       // restricted mode after 3 consecutive losing days
  let weekOutDaysLeft = 0;
  let weeklyLosses = 0;
  let dayInWeek = 0;

  const snapshots = [];
  const tel = { days: 0, floorHits: 0, weekOuts: 0, restrictions: 0, confluenceFires: 0, redDays: 0 };
  let outcome = 'timecap';

  for (let day = 0; day < RULES.sim.timeCapDays; day++) {
    const es = esCount(capital);
    if (es === 0) { outcome = 'ruin'; capital = 0; break; }

    const dailyFloor = es * RULES.maxLossPerES;
    let dayPnL = 0;
    let lossDay = false;

    if (weekOutDaysLeft > 0) {
      weekOutDaysLeft--;                       // idle, flat day
    } else {
      const p = highProbOnly ? edge.highProbWinRate : edge.winRate;
      for (let t = 0; t < edge.tradesPerDay; t++) {
        if (rng() < p) {
          dayPnL += edge.avgWinR * RULES.maxLossPerES * es;   // win, in R dollars
        } else {
          dayPnL -= dailyFloor;                                // one full stop = the floor
          lossDay = dayPnL < 0;                                // net negative → losing day
          tel.floorHits++;
          break;                                               // one loss ends the day
        }
      }
    }

    capital += dayPnL;
    if (capital < 0) capital = 0;
    tel.days++;
    dayInWeek++;

    if (capital > peak) peak = capital;
    const dd = (peak - capital) / peak;
    if (dd > maxDDpct) maxDDpct = dd;
    if (day % RULES.sim.snapshotEvery === 0) snapshots.push(capital);

    // classify the day
    if (lossDay) {
      tel.redDays++;
      consecutiveLosing++;
      weeklyLosses++;
      if (consecutiveLosing >= RULES.sitOut.consecutiveLossesForHighProb && !highProbOnly) {
        highProbOnly = true; tel.restrictions++;
      }
      if (weeklyLosses >= RULES.sitOut.weeklyLossesForWeekOut) {
        const left = RULES.sitOut.tradingDaysPerWeek - dayInWeek;
        if (left > 0) { weekOutDaysLeft = left; tel.weekOuts++; }
      }
    } else if (dayPnL > 0) {
      consecutiveLosing = 0;
      highProbOnly = false;                   // a winning day lifts the restriction
    }

    // week rollover
    if (dayInWeek >= RULES.sitOut.tradingDaysPerWeek) { dayInWeek = 0; weeklyLosses = 0; }

    // terminations
    if (capital >= target) { outcome = '10x'; break; }
    if (capital <= RULES.sim.ruinFloor) { outcome = 'ruin'; capital = 0; break; }
    if (consecutiveLosing >= RULES.edgeFalsification.consecutiveLosingDays) { outcome = 'falsified'; break; }
  }

  return { outcome, days: tel.days, maxDrawdownPct: maxDDpct, finalCapital: capital, snapshots, telemetry: tel };
}

/* exports for worker (importScripts) and module-style usage */
if (typeof self !== 'undefined') {
  self.RULES = RULES;
  self.EDGE_ILLUSTRATIVE = EDGE_ILLUSTRATIVE;
  self.cloneEdge = cloneEdge;
  self.esCount = esCount;
  self.expectedDollarsPerDayAt = expectedDollarsPerDayAt;
  self.yearProjection = yearProjection;
  self.monthsTo10x = monthsTo10x;
  self.simulatePath = simulatePath;
}
