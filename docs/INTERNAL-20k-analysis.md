# INTERNAL — what the record implies for a $20,000 account

> **🔴 NOT FOR THE PAGE. NOT FOR ANY CLIENT-FACING SURFACE.**
> Every figure in this file is barred from the landing page by the project's own locked
> constraints: no new figures, no monthly-check dollar tables, no blended or floating claims, no
> appendix hypotheticals. This is internal analysis to inform *your* judgement, not copy, and not
> anything to be shown to a prospect. Under the current pre-licensing status, presenting projected
> dollar outcomes to a prospect is also the exact activity the page says is not happening yet.

Computed 2026-08-11 from `accelerator.ekantikcapital.com/data/tenx_trades.json` — 248 closed
trades, 4 Feb → 6 Aug 2026 (183 days).

---

## 1. The record reproduces the deck exactly

This is the most reassuring finding in the file. Recomputing from the raw journal:

| Measure | Computed from journal | Deck states | Match |
|---|---|---|---|
| Mean R per trade | **+0.2406R** | +0.24R | ✅ |
| Annualised trade count | **493** | ~491 | ✅ |
| Annualised R | **118.6R** | ~119R | ✅ |
| Win rate | **58.87%** | 58.9% | ✅ |
| Gross profit factor | **1.507** | — | — |
| Net profit factor @ $1.50/trade | **1.49** (on the first 246) | 1.49 | ✅ |

The deck's numbers are not rounded, massaged, or cherry-picked. They fall straight out of the data.

**One inference worth recording:** the feed has no commission field, so the net profit factor cannot
be derived from it. Working backwards, a **~$1.50/trade round-turn** is what reconciles the gross
1.507 to the deck's net 1.49 — consistent with a blended ES/MES commission. That assumption now
lives in `edge/_build/figures.json` and is flagged `verified: false`. **Someone needs to confirm the
real number.** The page's `$1.49` rests entirely on it.

---

## 2. What a $20,000 account implies — and why the naive answer is wrong

The record's own median risk per trade is **$200** (mean $233). On a $20,000 account that is
**~1.0–1.2% per trade** — so a $20k account sized at ~1.2% is close to a like-for-like replication
of what was actually traded, rather than an extrapolation to a size never tested.

The naive calculation is: 119R/year × (1.2% × $20,000) = 119 × $240 = **+$28,560/year, +143%**.

**Do not use that number.** Here is what it hides.

### Simulation results (20,000 trials, 493 trades ≈ one year, net of $1.50/trade)

| Scenario | p5 | Median | p95 | Median profit | Worst DD (median / 1-in-20) | P(down year) |
|---|---|---|---|---|---|---|
| A · edge held constant, fixed sizing | $37.7k | $47.6k | $58.2k | **+$27.6k (+138%)** | 7% / 13% | 0% |
| B · edge uncertain, fixed sizing | $30.6k | $47.4k | $65.8k | **+$27.4k (+137%)** | 7% / 15% | 0% |
| C · edge uncertain, compounding | $33.6k | $76.6k | $190.5k | **+$56.6k (+283%)** | 10% / 19% | 0% |
| D · 50% haircut to the edge | $21.6k | $33.2k | $46.4k | **+$13.2k (+66%)** | 12% / 27% | 3% |
| E · 75% haircut to the edge | $15.8k | $26.1k | $37.4k | **+$6.1k (+31%)** | 18% / 40% | 16% |
| F · edge was never real (zero) | $9.2k | $19.1k | $29.4k | **−$0.9k (−4%)** | 30% / 64% | 56% |

Scenario B resamples the *record itself* on every trial, so the uncertainty in the edge propagates
rather than being assumed away.

### Why even scenario B is too optimistic

**A 0% probability of a down year is not a finding, it is a bug in the model.** No real strategy has
one. It tells you the simulation is missing:

1. **Regime correlation.** Trades are drawn independently. Real losing streaks cluster, because the
   conditions that cause them persist. The deck says this itself: *246 trades is six months of one
   kind of market.*
2. **Gap risk.** The model caps every loss at the stop. Futures gap through stops — overnight, on
   data, on a limit move. The left tail is fatter than modelled.
3. **Execution decay.** Fills in the record were the operator's own. Slippage, latency and partial
   fills all subtract, and none is in the data.
4. **Sample size.** 247 trades with risk data gives a **95% confidence interval on annualised R of
   50R to 192R** — nearly a 4× spread. The point estimate of 119R is the middle of a very wide band,
   not a property of the system.
5. **The edge is assumed to persist.** Scenarios A–C bake in that it is real out-of-sample. That is
   the single largest unproven assumption on the page, and the tripwires exist precisely because it
   might not be.

### The honest reading

**Scenario E is the one I would plan against — roughly +30% on $20,000 (about +$6,000), with a
1-in-5 chance of ending the year down and a realistic path through a 40% drawdown.**

That is not pessimism for its own sake. A 75% haircut is approximately what the deck already applies
to itself: its own overlay math models *"a deliberately conservative fraction of the measured edge"*
and lands near ~30%/year. The deck's internal posture and this simulation agree. That agreement is
the most defensible number in this document.

And scenario F is the one that matters most for risk: if the edge was never real, a $20k account
does **not** get quietly ruined — it drifts to roughly break-even minus costs, with a brutal but
survivable drawdown. That is the bounded-loss structure working. **It is also exactly why the
tripwires must fire on schedule** — scenario F only stays survivable if someone actually stops.

---

## 3. Why none of this can go on the page

| Constraint | How a $20k projection breaks it |
|---|---|
| "No new figures" | Every number above is new — none appears in the deck. |
| "No monthly-check dollar tables" | A $20k-denominated profit projection is that table in another costume. |
| "No blended or floating claims" | A projection is definitionally floating: it moves with assumptions. |
| Every figure needs its conditionality attached | The conditionality here (50 R to 192 R; 0% vs 56% chance of a down year) is larger than the claim. |
| CEG · Binary? Observable? | A forecast is neither. It cannot be checked against the Discord log. |
| Pre-licensing status | The page states no investment is offered or solicited. Projected returns on a stated minimum is solicitation behaviour, whatever the disclaimer says. |

The page's existing treatment is the correct one: state the measured edge, attach its conditionality,
show the tripwires, and let the reader do their own arithmetic against a live log they can check.

---

## 4. What to do with this

- **Verify the $1.50/trade cost assumption.** It is the only unverified input behind a published figure.
- If a prospect asks "what does this mean for my $20k," the defensible answer is the *structure*, not
  a number: risk per trade, the bounded loss, the tripwire that stops it, and an invitation to watch
  the log. Not +138%, and not +31% either.
- Revisit once the sample is materially larger and spans more than one regime. The confidence
  interval is the binding constraint here, not the edge.
