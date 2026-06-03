/* =============================================================================
   10x Account — shared engine
   Two-object source of truth (spec §3, §8.8):
     RULES — the DEFINED, fixed risk architecture. Never edited at runtime.
     EDGE  — the TBD, mutable, *illustrative* edge stats. Always labeled.
   Loaded by both the page (app.js) and the Monte Carlo Web Worker
   (worker.js, via importScripts). No DOM access in this file.
   ============================================================================= */

/* ---------------------------------------------------------------------------
   RULES — DEFINED (spec §3.1). Fixed core of the product. Treat as constant.
   --------------------------------------------------------------------------- */
const RULES = Object.freeze({
  startingCapital: 10000,        // $10k account (§3.1c, locked)

  // (a) Two loss thresholds — DO NOT conflate (§3.1a)
  DLL: 1000,                     // Hard daily floor (dollars). Inviolable.
  DLL_pct: 0.10,                 // ... = 10% of starting capital.
  redDayThreshold: 500,          // a "red day" = daily net loss WORSE than -$500.

  // (c) Setups, stops & sizing — DEFINED (§3.1c). Universe = C and D only.
  // Sizes are ranges (C-Val 1–2 ES, C-guess 1–5 MES, D 1 ES); the sim models the
  // RANGE UPPER BOUND (worst-case risk). pointValue: ES = $50/pt, MES = $5/pt.
  setups: {
    C_validated: { label: 'Setup C — Validated', contracts: 2, pointValue: 50, stopPoints: 10, maxLoss: 1000 },
    C_guess:     { label: 'Setup C — guess',      contracts: 5, pointValue: 5,  stopPoints: 10, maxLoss: 250  },
    D:           { label: 'Setup D',              contracts: 1, pointValue: 50, stopPoints: 3,  maxLoss: 150  },
  },

  // (d) Scale-up rules — DEFINED (§3.1d)
  scaleUp: {
    profitDoubleTrigger: 2000,           // +$2,000 running profit => optionality to ×2
    doubleMultiplier: 2,
    confluenceMultiplier: 4,             // A∧B∧C all Validated => ×4 of setup's normal size
    confluenceCompoundsWithDouble: false // working default: no ×8 (§3.1d open confirm)
  },

  // (b) Sit-out ladder — DEFINED (§3.1b). Open behaviours wired as flags (§9).
  sitOut: {
    consecutiveRedForWeekOut: 3,   // 3 consecutive red days => sit out rest of week
    fourthRedRestricts: true,      // 4th consecutive red => {C-Validated, D} only
    weekOutResetsCounter: false,   // §9 open: does the forced week-out reset the streak?
    recoveryBaseline: 'lastReset', // §9 open: 'start' | 'peak' | 'lastReset'
    tradingDaysPerWeek: 5
  },

  // (e) Falsifiability — DEFINED (§3.1e)
  edgeFalsification: { consecutiveLosingDays: 10 }, // edge stand-down => research-only

  // (f) Target — structural ceiling, NEVER a daily threshold (§3.1f)
  target: { multiple: 10 },

  // simulation bounds
  sim: {
    ruinFloor: 0,                  // ruin = full loss of starting capital
    timeCapDays: 1260,             // ~5 trading years
    snapshotEvery: 5               // sample equity every N days for the fan chart
  }
});

/* ---------------------------------------------------------------------------
   EDGE — TO BE DEFINED (spec §3.2). MUTABLE. ILLUSTRATIVE ONLY.
   Loss side is fixed by the stops in RULES; the *win* (target, in points) is
   the open lever that sets the R-multiple. Expectancy is ALWAYS derived from
   (p, avgWin, avgLoss) — never entered, never hard-coded (§3.2 build rule 1).
   The single seed below is a blended stand-in (deck's ~64.7% / +0.83R / -0.79R),
   spread across C/D as a plausible illustration — NOT this account's record.
   --------------------------------------------------------------------------- */
const EDGE_ILLUSTRATIVE = Object.freeze({
  _label: 'illustrative — not this account’s verified record',
  C: {
    frequencyPerDay: 1.0,   // occurrences/day (TBD)
    validationRate: 0.50,   // share of C that is Validated (2 ES) vs guess (1 ES) (TBD)
    winRate: 0.56,          // p (TBD)
    avgWinPoints: 9         // target size in points (loss fixed = 10 pts stop) -> 0.9R
  },
  D: {
    frequencyPerDay: 1.0,
    winRate: 0.53,
    avgWinPoints: 3.2       // loss fixed = 3 pts stop -> ~1.07R
  },
  confluenceRate: 0.05      // P(A∧B∧C all validate) on a Validated-C bar -> ×4 fires (rare)
});

/* deep, mutable working copy the UI edits */
function cloneEdge(src) {
  return {
    C: { ...src.C },
    D: { ...src.D },
    confluenceRate: src.confluenceRate
  };
}

/* ---------------------------------------------------------------------------
   Closed-form sanity layer (spec §4.4). ARITHMETIC expectation only.
   The simulator gives the (lower) geometric reality.
   --------------------------------------------------------------------------- */
function expectedDollarsPerDay(edge) {
  // Setup C splits into Validated (2 ES) and guess (5 MES) by validationRate.
  // $/pt differs per setup (ES vs MES), so each leg carries its own pointValue.
  const cV = RULES.setups.C_validated, cG = RULES.setups.C_guess;
  const cLoss = cV.stopPoints;                               // 10 pts (same for guess)
  const cPerOccPoints = edge.C.winRate * edge.C.avgWinPoints - (1 - edge.C.winRate) * cLoss;

  const valOcc = edge.C.frequencyPerDay * edge.C.validationRate;
  const gsOcc  = edge.C.frequencyPerDay * (1 - edge.C.validationRate);
  const cDollars =
      valOcc * cV.contracts * cV.pointValue * cPerOccPoints +
      gsOcc  * cG.contracts * cG.pointValue * cPerOccPoints;

  const d = RULES.setups.D;
  const dPerOccPoints = edge.D.winRate * edge.D.avgWinPoints - (1 - edge.D.winRate) * d.stopPoints;
  const dDollars = edge.D.frequencyPerDay * d.contracts * d.pointValue * dPerOccPoints;

  return cDollars + dDollars;
}

/* Max single-trade loss for a given setup state at a sizing multiplier (§4.4 check). */
function maxSingleTradeLoss(setupKey, multiplier) {
  const s = RULES.setups[setupKey];
  return s.contracts * multiplier * s.pointValue * s.stopPoints;
}

/* ---------------------------------------------------------------------------
   PRNG — Mulberry32 (seedable, fast, good enough for MC).
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

/* Poisson draw (Knuth) for occurrence counts from a mean frequency. */
function poisson(lambda, rng) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

/* ---------------------------------------------------------------------------
   Single-path simulation (setup-driven daily Monte Carlo, spec §4.2).
   Returns: { outcome, days, maxDrawdownPct, snapshots[], telemetry{} }
   outcome ∈ '10x' | 'ruin' | 'falsified' | 'timecap'
   --------------------------------------------------------------------------- */
function simulatePath(edge, policy, seed) {
  const rng = mulberry32(seed);
  const aggressive = policy === 'aggressive';

  let capital = RULES.startingCapital;
  const target = RULES.startingCapital * RULES.target.multiple;
  const recoveryStart = RULES.startingCapital; // baseline tracker for 'lastReset'

  let peak = capital;
  let maxDDpct = 0;

  let consecutiveRed = 0;       // red-day streak (sit-out ladder)
  let consecutiveLosing = 0;    // any net-negative day streak (falsification)
  let restricted = false;       // {C-Validated, D} only, after 4th red
  let recoveryBaseline = recoveryStart;
  let weekOutDaysLeft = 0;      // remainder-of-week sit-out

  const snapshots = [];
  const tel = { days: 0, floorHits: 0, weekOuts: 0, restrictions: 0, confluenceFires: 0, redDays: 0 };

  const maxDays = RULES.sim.timeCapDays;
  let outcome = 'timecap';
  let dayInWeek = 0;

  for (let day = 0; day < maxDays; day++) {
    let dayPnL = 0;
    const onWeekOut = weekOutDaysLeft > 0;

    if (onWeekOut) {
      weekOutDaysLeft--;
      // idle (no trades) — counts as a flat, non-losing day
    } else {
      const runningProfit = capital - RULES.startingCapital;
      const canDouble = aggressive && runningProfit >= RULES.scaleUp.profitDoubleTrigger;

      // --- generate & resolve the day's trades ---
      const nC = poisson(edge.C.frequencyPerDay, rng);
      const nD = poisson(edge.D.frequencyPerDay, rng);

      // interleave C and D occurrences in a simple deterministic order
      const queue = [];
      for (let i = 0; i < nC; i++) queue.push('C');
      for (let i = 0; i < nD; i++) queue.push('D');

      for (const kind of queue) {
        // remaining room before the hard floor (binds before any nominal stop)
        const room = RULES.DLL + dayPnL; // dayPnL is <=0-ish; room shrinks as we lose
        if (RULES.DLL + dayPnL <= 0) break; // floor already hit

        let setupKey, p, winPts, lossPts;

        if (kind === 'C') {
          const validated = rng() < edge.C.validationRate;
          if (restricted && !validated) continue; // guesses not allowed when restricted
          setupKey = validated ? 'C_validated' : 'C_guess';
          p = edge.C.winRate; winPts = edge.C.avgWinPoints;
          lossPts = RULES.setups.C_validated.stopPoints; // 10 pts, same for guess
        } else {
          setupKey = 'D';
          p = edge.D.winRate; winPts = edge.D.avgWinPoints;
          lossPts = RULES.setups.D.stopPoints; // 3 pts
        }

        const base = RULES.setups[setupKey];
        let mult = 1;

        // ×4 exponential: A∧B∧C confluence on a Validated-C bar (Aggressive only)
        let confluence = false;
        if (aggressive && setupKey === 'C_validated' && rng() < edge.confluenceRate) {
          confluence = true;
          mult = RULES.scaleUp.confluenceMultiplier;
          if (RULES.scaleUp.confluenceCompoundsWithDouble && canDouble) {
            mult *= RULES.scaleUp.doubleMultiplier;
          }
          tel.confluenceFires++;
        } else if (canDouble) {
          mult = RULES.scaleUp.doubleMultiplier;
        }

        const contracts = base.contracts * mult;
        const v = base.pointValue;                 // ES = $50/pt, MES = $5/pt
        const win = rng() < p;
        let tradePnL;
        if (win) {
          tradePnL = winPts * v * contracts;
        } else {
          // nominal point-stop loss ...
          let loss = lossPts * v * contracts;
          // ... but the daily floor caps realized loss at remaining room (§3.1d note)
          if (loss > RULES.DLL + dayPnL) loss = RULES.DLL + dayPnL;
          tradePnL = -loss;
        }

        dayPnL += tradePnL;

        // hard floor / circuit breaker
        if (dayPnL <= -RULES.DLL) {
          dayPnL = -RULES.DLL;
          tel.floorHits++;
          break;
        }
      }
    }

    // --- settle the day ---
    capital += dayPnL;
    if (capital < 0) capital = 0;   // can't lose more than the account holds (ruin)
    tel.days++;
    dayInWeek++;

    // drawdown tracking
    if (capital > peak) peak = capital;
    const ddpct = (peak - capital) / peak;
    if (ddpct > maxDDpct) maxDDpct = ddpct;

    // snapshot
    if (day % RULES.sim.snapshotEvery === 0) snapshots.push(capital);

    // classify red day & losing day
    const isLosing = dayPnL < 0;
    const isRed = dayPnL < -RULES.redDayThreshold; // net loss worse than -$500

    if (isLosing) consecutiveLosing++; else consecutiveLosing = 0;

    if (isRed) {
      tel.redDays++;
      consecutiveRed++;
      if (consecutiveRed >= 4 && RULES.sitOut.fourthRedRestricts) {
        if (!restricted) tel.restrictions++;
        restricted = true;
        recoveryBaseline = (RULES.sitOut.recoveryBaseline === 'peak') ? peak
                         : (RULES.sitOut.recoveryBaseline === 'start') ? RULES.startingCapital
                         : capital; // 'lastReset'
      } else if (consecutiveRed === 3) {
        // sit out remainder of week
        const left = RULES.sitOut.tradingDaysPerWeek - dayInWeek;
        if (left > 0) { weekOutDaysLeft = left; tel.weekOuts++; }
        if (RULES.sitOut.weekOutResetsCounter) consecutiveRed = 0;
      }
    } else if (dayPnL > 0) {
      // a green (non-red) day relaxes the streak
      consecutiveRed = 0;
    }

    // lift the {C-Validated, D} restriction once back to profitability vs baseline
    if (restricted && capital > recoveryBaseline) restricted = false;

    // week rollover
    if (dayInWeek >= RULES.sitOut.tradingDaysPerWeek) dayInWeek = 0;

    // --- terminations ---
    if (capital >= target) { outcome = '10x'; break; }
    if (capital <= RULES.sim.ruinFloor) { outcome = 'ruin'; capital = 0; break; }
    if (consecutiveLosing >= RULES.edgeFalsification.consecutiveLosingDays) {
      outcome = 'falsified'; break;
    }
  }

  return { outcome, days: tel.days, maxDrawdownPct: maxDDpct, finalCapital: capital, snapshots, telemetry: tel };
}

/* export for worker (importScripts) and for module-style usage */
if (typeof self !== 'undefined') {
  self.RULES = RULES;
  self.EDGE_ILLUSTRATIVE = EDGE_ILLUSTRATIVE;
  self.cloneEdge = cloneEdge;
  self.expectedDollarsPerDay = expectedDollarsPerDay;
  self.maxSingleTradeLoss = maxSingleTradeLoss;
  self.simulatePath = simulatePath;
}
