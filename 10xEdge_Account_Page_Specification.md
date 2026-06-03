# 10x Account — Build Specification

**Subdomain:** `10xEdge.ekantikcapital.com`
**Parent asset:** *The Edge, in Plain English* (Founding Member Briefing, June 2026)
**Document type:** Build specification (internal architecture — analytical, not marketing copy)
**Version:** Draft v0.5 — sizing fully locked; ready to build
**Owner:** Hiren Patel, CIO, Ekantik Capital Advisors LLC
**v0.5 change:** $10k account; floor $1,000 (10%) = one Setup C Validated full stop. Stops locked (C = 10 pts, D = 3 pts) → max losses $1,000 / $500 / $600. A/B not traded (confluence-only). Only per-setup *edge stats* remain as inputs. The sizing-vs-floor question is resolved by design.
**v0.4 change:** Audience resolved (operator now, investor later); exponential = ×4 of normal setup size; dual-mode build.
**v0.3 change:** Defined rule set encoded (§3.1); engine rewritten as setup-driven Monte Carlo (§4). Edge stats per setup remain TBD inputs (§3.2).
**v0.2 change:** Page specified as an edge-agnostic rules engine with edge stats as a pluggable input.

---

## 0. What this document is

This is the build spec for a sub-page that extends *The Edge* deck. The deck answers **"can a measured edge exist?"** (it shows one, across 102 live trades). This page answers a structurally different question: **"given a hard daily loss limit, what can *any* positive-expectancy edge do above that floor — and how far toward 10x can it compound?"**

The distinction matters and drives the whole v0.2 rewrite: **the rules are defined; the edge stats are not.** The defined, fixed core of the 10x Account is its **risk architecture** — the daily loss limit (`$1,000`, or `10%` of capital), the circuit breaker, fixed-fractional sizing, and the published sit-out ladder. The **edge statistics** (win rate, average win/loss, cadence) that will run *inside* those rules are still to be determined and validated. So the page is built as an **edge-agnostic rules engine**: the prospect (or you) sets the edge parameters, and the engine shows what the *rules* do with them. The deck's verified figures are available as one *illustrative, clearly-labeled* default input — never as a locked claim about this account.

The deck's risk control is *risk-per-trade as a % of capital*. That dial is correct but abstract. This page swaps it for the dial an HNW prospect can feel in their gut: **a hard daily loss limit.** "You cannot lose more than this in a day" is concrete, legible, and visceral in a way "fixed-fractional R sizing" is not. That reframe — plus the rules engine beneath it — *is* the product.

The page copy is specified in the deck's established voice (Ogilvy-plain, evidence-first). The spec prose around it stays analytical, per the internal-architecture convention.

### Audience & modes (resolved)

This is **currently an operator/prop cockpit** — the rules are the literal execution rules of a live prop account (APEX/Tradeify-style), and "$1,000 daily loss" maps to the firm's max-daily-loss rule. It is **designed to flip to investor-facing later.** Architecturally that means **one shared engine, two presentation layers**:

- **Operator mode (now):** shows full detail — setup names, ES contract counts, scale-up state, sit-out streak, falsifiability counters. Internal cockpit; compliance surface is minimal (it's your own dashboard, not a solicitation).
- **Investor mode (future):** abstracts the operator IP (no "Setup C = 2 ES" on the page), foregrounds the floor + path + honest downside, and **activates every §8 compliance guardrail before it goes public.**

Build operator mode first. Keep the presentation layer cleanly separable from the engine so the investor flip is a re-skin, not a rebuild.

---

## 1. The core mechanic (the one idea the whole page sells)

> **A defined daily floor turns an unbounded fear into a single, known number — and the edge does the rest above that floor.**

The daily loss limit (DLL) functions three ways at once, and the page should make all three legible:

1. **A risk budget.** Each session you are willing to risk at most `DLL` dollars. The engine allocates that budget across the day's trades.
2. **A circuit breaker.** If cumulative same-day P&L reaches `−DLL`, the session ends. No revenge trades, no spiral. This is the structural answer to the deck's own line: *"where real edges get killed by their operators."*
3. **A falsifiability floor.** The DLL is a pre-committed, observable, binary kill condition for the day — the daily-granularity analogue of the witness-locked Falsifiability Protocol already published on the accelerator site.

### The honest framing of "maximize returns"

A naïve reading of the request — *maximize returns under a daily loss limit* — points toward "crank per-trade risk until the daily cap is the only thing stopping you." **The page must not sell that.** It is mathematically self-defeating (Kelly overbetting reduces geometric growth while raising ruin probability) and it is exactly the failure mode the deck warns against at the `10%+` row of its risk dial.

The page sells the **maximum *sustainable* return** — the per-trade risk that maximizes *geometric* (compounded) growth while the daily floor bounds the worst session. The calculator must show the optimum **and** the cliff past it, so the prospect sees that the 10x Account runs *at* the optimum, not beyond it.

This is the COM distinction made operational: **10x is the structural ceiling (the Impossible Goal), never the daily threshold.** The daily expectation is *whatever per-trade expectancy the defined edge supports* (the Evidence Gate) — calibrated to the eventual validated stats, not to the 10x dream. The page should never imply "1/10th of the way to 10x today."

---

## 2. Critical honesty constraint (non-negotiable on a public page)

**A daily loss limit caps *daily* downside, not *cumulative* downside.** A prospect can hit `−$1,000` on three separate days in a month and be down `$3,000` — and the deck's own live record already shows a `−23.3%` drawdown. Any phrasing that lets a reader infer "$1,000 max loss → my capital is safe → 10x is near-certain" is materially misleading and a regulatory exposure.

The page must state, in plain language and near the calculator:

- The DLL caps *one day*. Multiple red days compound into a larger drawdown.
- The modeled worst-case *total* drawdown (from the simulator) is displayed alongside the daily floor — never hidden.
- "10x" is an aspirational ceiling reached through time and compounding, **not a forecast, not a guarantee, not a promised multiple.**

See §8 for the full compliance checklist.

---

## 3. The defined rules (fixed) vs. the edge stats (to be defined)

The 10x Account has two layers. One is settled; one is pending. The page and the codebase must keep them cleanly separated.

### 3.1 The rules — DEFINED (the fixed core of the product)

These are the known quantities, as specified by the operator. Store as a single `RULES` constant object. The engine implements them literally; the page exposes whichever subset is appropriate for the audience (see §9 — investor pages likely abstract the setup/contract detail, which is operator IP).

**(a) Two loss thresholds — do not conflate them.**

| Threshold | Value | Role |
|---|---|---|
| Hard daily floor (DLL) | `$1,000`, or `10%` of capital | Inviolable. Session ends; no revenge trades. The circuit breaker. |
| Qualifying "red day" | daily net loss **worse than −$500** | The *counter* used by the sit-out streak logic below. Not a stop — a marker. |

*Assumption made:* I read `>-$500` as "a daily loss exceeding $500," and treat $500 as the streak-counting marker sitting at half the $1,000 hard floor. Confirm. (§9)

**(b) Sit-out ladder — DEFINED.**

| Trigger | Response | Resume |
|---|---|---|
| 3 consecutive red days (loss > $500 each) | Sit out the remainder of the week | Following week |
| 4th consecutive red day | Restrict to **Setup C (Validated) + Setup D only**, until back to profitability | Return to full setup menu once profitable |

*Open:* does the forced week-out **reset** the consecutive counter, or does the streak persist across the rest (so a red day on resumption is the "4th")? And "back to profitability" is measured against *what* baseline (peak / starting capital / net-positive on the week)? Both materially change the model. (§9)

**(c) Setups, stops & position sizing — DEFINED.** ES = $50/point. Tradeable universe is **C and D only** (A/B not traded — see note).

| Setup / state | Contracts | Stop | $/point | **Max single-trade loss** |
|---|---|---|---|---|
| Setup C — Validated | 2 ES | 10 pts | $100 | **$1,000** |
| Setup C — guess | 1 ES | 10 pts | $50 | **$500** |
| Setup D | 4 ES | 3 pts | $200 | **$600** |

**The floor is calibrated, not arbitrary.** The $1,000 / 10% daily max loss = *exactly one Setup C Validated full stop* (2 ES × 10 pts × $50). Structural consequences the engine must honor:
- One C-Validated full-stop loss ends the day (you've hit the floor in a single trade).
- A C-guess ($500) + a D ($600) = $1,100 → two losers can also trip the floor; the circuit breaker caps the day at $1,000.
- "Actual stop $500–600" = the typical C-guess / D case; $1,000 is the highest-possible (C-Validated) case.

**A/B not traded.** Setups A and B are **not taken as standalone entries**. They function only as *confluence conditions*: when A **and** B **and** C all validate together, the C-Validated trade is sized at the ×4 exponential (§3.1d). *Confirm this reading* — it's the only way the "A,B,C validated" exponential rule is reachable given A/B aren't traded. (§9)

**(d) Scale-up rules — DEFINED.**

| Trigger | Action |
|---|---|
| +$2,000 in profit | *Optionality* to double (×2) all position sizing |
| A, B, C all Validated (confluence) | Exponential bet — **4× the setup's normal defined size** (confluence C-Validated = 2 ES × 4 = 8 ES) |

*Working assumption (one open item):* the ×4 exponential is the maximum-conviction expression and is **not** further multiplied by the +$2k ×2 doubling (no ×8). Confirm. (§9)
*Note:* an 8 ES position's nominal 10-pt stop = $4,000, but the $1,000 daily floor binds first (at ~2.5 adverse points). The engine caps any trade's realized loss at the **remaining daily-floor room**, never the nominal point-stop, for oversized positions.

**(e) Falsifiability — DEFINED.**

| Layer | Condition | On trigger |
|---|---|---|
| Operator (fidelity) | Per the deck's Gate 02 + three-tier sit-out architecture | Tiered response, witness-countersigned (Manish Dharod) |
| Edge (expression) | **10 consecutive losing days** | Edge stand-down → research-only; public Discord notice |

**(f) Target.** 10× starting capital — structural ceiling, never a daily threshold.

> The marketing thesis still rests on the *floor + protocol*, which hold regardless of edge. But note the sizing rules introduce real tensions worth resolving before build — see §9 (sizing-vs-floor, ES-vs-MES, leverage-vs-capital).

### 3.2 The edge stats — TO BE DEFINED (parameterized input, not a constant)

The rules above fix *sizing, stops, and governance*. What remains **TBD per setup** (C, D) and must stay calculator inputs:

| Per-setup parameter | Status | Notes |
|---|---|---|
| Frequency (occurrences / day) | **TBD** | How often C and D appear |
| Setup-C validation rate | **TBD** | Share of C that is Validated (2 ES) vs guess (1 ES) |
| Win rate `p` | **TBD** | May differ C vs D |
| Avg **win** (points) | **TBD** | Loss side is fixed by stops (C = 10 pts, D = 3 pts); the *target/win* size is the open variable that sets R-multiple |
| Confluence rate (A∧B∧C all validate) | **TBD** | How often the ×4 exponential actually fires (rare by design) |

A single illustrative default set (e.g., the deck's blended 64.7% / +0.83R / −0.79R) may seed the panel **only if clearly labeled "illustrative — not this account's verified record,"** and only as a blended stand-in until per-setup stats exist.

**Two build rules that follow from edge-being-TBD:**

1. **Expectancy is always *derived* from the dialed `(p, avgWin, avgLoss)` per setup**, never entered or hard-coded. (Also sidesteps the deck's `+0.32R`-vs-`+0.26R` discrepancy — a deck-hygiene task, not a blocker here.)
2. **Every emitted number is a hypothetical illustration of the rules**, not a performance representation, until per-setup stats are defined and validated. Hard compliance requirement (§8).

---

## 4. The interactive calculator — functional spec

Client-side only. No backend, no data leaves the browser. Two computation layers: closed-form (instant, for the dial) and Monte Carlo (for the honest distribution).

### 4.1 Inputs

Sizing is **not** a free dial anymore — the rules fix it per setup (§3.1c). What the user actually controls is capital, the floor, and how aggressively to use the scale-up optionality.

**Primary controls (always visible):**

| Input | Default | Notes |
|---|---|---|
| Starting capital `C` | $10,000 | See §9 leverage flag — 4 ES on $10k is heavy; confirm capital base |
| Daily loss limit `DLL` | `$1,000` (or `10%`) | The hard floor. Display $ and %. |
| Scale-up policy | "Conservative" / "Aggressive" | Conservative = never exercise the +$2k doubling or the 4× exponential; Aggressive = exercise both per rules. The headline tradeoff. |

**Edge panel (TBD — collapsed "Advanced / Edge assumptions"), per setup A/B/C/D:**
frequency, win rate, avg win/loss (points), stop distance (points), and Setup-C validation rate. Seeded with a single, labeled illustrative set until per-setup stats exist (§3.2). Controls: "reset to illustrative" and "clear / enter your own."

### 4.2 The engine (setup-driven daily Monte Carlo)

Per simulated day:

1. **Generate the day's trades** by drawing each setup per its frequency. Each trade carries its setup type, validation state (for C), win/loss draw (per that setup's `p`), and outcome in points.
2. **Size each trade by rule (§3.1c):** Setup C Validated = 2 ES, C guess = 1 ES, Setup D = 4 ES (A/B TBD). Apply **scale-up multipliers**: ×2 if Aggressive *and* running profit ≥ +$2,000; **×4 of the setup's normal size** on any bar where A, B, C are all Validated (Aggressive only). Default: ×4 exponential does not compound with the ×2 doubling (§3.1d).
3. **Dollarize:** trade $ P&L = `outcome_points × $50 × contracts`.
4. **Accumulate intraday; enforce the hard floor:** if same-day cumulative ≤ `−DLL`, stop the day.
5. **Classify the day:** red day if net loss > $500.
6. **Apply the sit-out ladder (§3.1b):** track consecutive red days → 3 ⇒ skip remainder of week; 4th ⇒ restrict to {C-Validated, D} until running P&L back above the recovery baseline. (Streak-reset behavior and baseline are §9 open items — make them config flags so both readings can be tested.)
7. **Roll capital; check terminations:** 10× reached; ruin; **edge falsified = 10 consecutive losing days** (stand-down → run halts in the sim).

**Trade outcomes:** parametric from the *currently dialed per-setup* edge while stats are TBD. Bootstrap-from-ledger becomes the defensible default only once a validated per-setup R-series exists.

**Monte Carlo:** ≥ 10,000 paths; run to 10× / ruin / edge-falsification / time cap (~5 yr). Web Worker.

### 4.3 Outputs

- **Path to 10x:** median time, P10–P90 fan chart (Chart.js).
- **Defined downside:** the `$1,000 / 10%` hard floor shown large; beside it (unhidden) the **modeled worst-case total drawdown**, **P(ruin)**, and **P(edge falsified within horizon)** at the current settings.
- **Policy comparison** (replaces the old risk-`r` dial): Conservative vs. Aggressive scale-up, each showing `{median time-to-10x, modeled max DD, P(ruin), P(edge-falsification trip)}`. This is where the prospect sees that the 4× exponential and the +$2k doubling buy speed at a real cost in drawdown and ruin — the honest version of "maximize returns."
- **Rule-activity telemetry:** % of days the hard floor catches; frequency of the 3-red-day sit-out; frequency of the 4th-day setup restriction; how often the 4× exponential actually fires (A,B,C confluence is rare by construction).

### 4.4 Closed-form sanity layer (instant, before MC resolves)

- Expected $/day ≈ `Σ_setups [ frequency × contracts × $50 × (p·avgWin − (1−p)·|avgLoss|) ]`, summed across A/B/C/D at their dialed stats. Disclaim that this is the *arithmetic* expectation; the simulator gives the *geometric reality* (lower, from drawdown drag and sit-out idle time) and inherits whatever edge was dialed.
- **Sizing-vs-floor check (surface this prominently):** max single-trade loss = `contracts × $50 × stop_points`. For Setup D (4 ES) a 5-point stop = `4 × $50 × 5 = $1,000` = the *entire* hard floor in one trade; the 4× exponential (e.g., 8 ES) breaches it. The page/engine should warn when a setup's worst-case single-trade loss approaches or exceeds the DLL. See §9.

---

## 5. Page structure & copy direction

> The copy below is **investor mode** (future). **Operator mode (build first)** is the same sections stripped of marketing voice — a data-dense cockpit: the floor and current streak up top, the live telemetry from §4.3, the sit-out/falsifiability counters, and the scale-up state. No hero copy, no CTA. The two share the engine and layout skeleton; only the presentation layer differs.

Sandwich structure, dark throughout (premium), mirroring the deck. Each section below: purpose, then copy direction in the deck's voice.

**§A — Hero**
*Purpose:* state the reframe in one line — lead with what's *defined* (the floor), not with an edge claim this account hasn't yet earned.
*Copy:* "One number you set. One number you can never breach in a day." Sub: "The 10x Account is a defined-downside engine: you set the most it can lose in a day, and a positive-expectancy edge compounds above that floor." Stat chips should foreground the **rules**, not unverified returns — e.g., `Daily floor: you set it · Circuit breaker: automatic · Failure: pre-committed & witnessed`. (If/when this account's edge is validated, swap in its real stats; until then, no `64.7% / 1.93 / +105R` chips here — those are the deck's record, not this account's.)

**§B — The reframe**
*Purpose:* daily loss limit vs. per-trade-risk dial; why the daily floor is the more honest, more legible control.
*Copy:* "Most managers tell you their *return*. Almost none tell you their *floor*. We lead with the floor, because the floor is the only thing you actually control before the edge takes over."

**§C — The mechanic (the three jobs of the daily floor)**
*Purpose:* budget / circuit breaker / falsifiability floor (from §1). Three icon-rows.

**§D — The calculator** *(the centerpiece)*
*Purpose:* the interactive dial + edge panel + fan chart + the honest downside block.
*Copy framing:* "Set your floor. Dial in an edge — start with our illustrative figures or enter your own — and watch what the rules do with it, ten thousand times over, so you see the spread, not just the dream. Nothing here is a forecast. It's the compounding math of *whatever edge you assume*, run inside a fixed floor."

**§E — Path to 10x**
*Purpose:* median path + P10–P90 band; explicitly that 10x is reached by *time × compounding at the optimum*, not by cranking risk.
*Copy:* the deck's snowball line, generalized — "A small per-trade edge is the snowball. A few hundred trades a year is the hill. A daily floor is what keeps the snowball from rolling off a cliff. Set the edge; the rules decide how safely it rolls."

**§F — The honest downside** *(required, not optional)*
*Purpose:* daily ≠ cumulative; modeled max DD (from the sim, at the dialed edge); the deck record's −23.3% drawdown as a real-world cautionary reference; the edge-existence and edge-constancy assumptions the Protocol tests.
*Copy:* the deck's boxer/fighter framing — "A skilled boxer still gets hit. The floor decides how hard, per round. It does not promise you never bleed across the fight."

**§G — Governance link-out**
*Purpose:* connect the daily floor to the published, witness-locked Falsifiability Protocol v2.0 + three-tier sit-out ladder (Manish Dharod, witness). Link to `accelerator.ekantikcapital.com`.
*Copy:* "The daily floor is not a mood. It's the daily-granularity edge of a protocol I committed to publicly, in writing, with a witness who countersigns every exception."

**§H — Founding terms + CTA**
*Purpose:* the deck's §13 terms (80/20 capital architecture, lifetime flat-fee, capacity priority) + a single clear next step.
*Copy:* "The floor is defined. The protocol is published. What's left is one decision — the daily floor you want your edge to run above." **CTA:** schedule a founding-member conversation. (See §8 — this CTA is the holding-out surface; gate it per counsel.)

---

## 6. Design system (consistent with deck + brand)

- **Palette:** Ekantik dark cockpit — navy `#1B2A4A` (dominant), gold `#C8A951` (accent, ~10% weight), ivory text. Match the deck exactly so the sub-page reads as the same family.
- **Type:** Playfair Display / Cormorant Garamond headings; DM Sans body; JetBrains Mono for all numerals, R-figures, and the dial (carries the deck's "live record" feel).
- **Motif:** the deck uses large mono stat callouts and ringed/tiered structures. Reuse: big mono numbers for the floor and the multiple; a tier/ring motif for the three jobs of the floor.
- **Charts:** Chart.js via CDN. Equity-curve fan (P10/P50/P90) in gold-on-navy. No decorative bars or accent underlines.

---

## 7. Technical implementation

- **Stack:** static HTML + vanilla JS (his GitHub Pages standard), Chart.js via CDN. If the dial state gets complex, a single React artifact is acceptable, but a static build is preferred for a public marketing sub-page.
- **Compute:** entirely client-side. The Monte Carlo runs in-browser (10k paths in a Web Worker to keep the UI responsive). No data persistence; no PII leaves the page.
- **Trade ledger:** while edge stats are TBD, the sim runs parametric from the dialed edge (§4.2). *Once an edge is defined and a validated R-series exists*, embedding it as a static JSON array and resampling (bootstrap) becomes the more defensible mode — gated on confirming the ledger can be published in size-neutral R form.
- **Email capture:** Formspree, on the CTA only.
- **Hosting:** `10xEdge.ekantikcapital.com` (note: deck/memory also reference `10x.ekantikcapital.com` — confirm which subdomain is canonical to avoid a split).
- **No `localStorage`/`sessionStorage`** if delivered as a Claude artifact; in-memory state only.

---

## 8. Compliance guardrails (operator mode: dormant — investor mode: mandatory before public)

In **operator mode** this is your own internal cockpit, not a solicitation, so the guardrails below are largely dormant. They become **hard build requirements the moment the page flips to investor mode** and goes public — at which point it sits squarely on the open regulatory questions in the practice (CTA/NFA registration; holding-out vs. the 15-person exemption). Wire the guardrails as a mode flag now so the flip is a toggle, not a scramble:

1. **The edge is unproven for this account → all outputs are hypothetical.** Because the edge stats are TBD/illustrative (§3.2), every figure the calculator emits is a *hypothetical illustration of the rules*, not a performance representation. This must be stated prominently, not buried — and the deck's verified figures must never be presented as this account's expected results.
2. **No guarantees, no forecasts.** Every projected number carries a visible "math of an *assumed* edge, not a forecast" qualifier.
3. **Daily ≠ cumulative downside** stated plainly beside the calculator (§2).
4. **Edge-constancy and edge-existence are assumptions the Protocol tests** — state both. The page must not imply the assumed edge is established.
5. **Past/simulated performance disclaimer** on results: simulated/hypothetical results have inherent limitations and do not represent actual trading.
6. **"10x" is aspirational ceiling, not a return promise** — never phrase as expected or likely.
7. **The CTA is the holding-out surface.** A public, indexable page soliciting investors is exactly the conduct flagged against the 15-person exemption. Decide with counsel whether the page is (a) gated/private behind founding-member access, (b) reframed as education with no solicitation, or (c) held until registration posture is resolved. **Do not ship the CTA publicly until this is settled.**
8. **Two-object source of truth (§3):** `RULES` (fixed) and `edge` (mutable, labeled illustrative). The page can never present a dialed edge assumption as a verified statistic.

---

## 9. Open decisions / assumptions made

**Resolved / locked:**

- **Audience:** operator/prop now, investor later — dual-mode build, operator first (§0).
- **Capital & floor:** $10k account; floor = 10% = $1,000 = exactly one Setup C Validated full stop (§3.1c).
- **Stops & sizing:** C = 10 pts (2 ES val / 1 ES guess); D = 3 pts (4 ES). Max losses $1,000 / $500 / $600.
- **A/B:** not traded; confluence-only conditions for the ×4 exponential.
- **Exponential:** ×4 of normal setup size; oversized-position loss capped by the daily floor, not the nominal point-stop.

**Still needed to move illustrative → real (all are calculator inputs; the build proceeds without them):**

- **Per-setup edge stats:** frequency/day for C and D, Setup-C validation rate, win rate, and **avg win in points** (the loss side is fixed by stops; the win/target size is the open lever that sets the R-multiple).
- **Confluence rate** (how often A∧B∧C all validate → ×4 fires).

**Minor confirms:**

- Exponential does *not* compound with the +$2k ×2 doubling (working default).
- Sit-out: does the forced week-out reset the red-day counter? "Back to profitability" / "+$2k" baseline = start / peak / last reset?
- `>-$500` = "daily loss exceeding $500"; edge-falsification "losing day" = any net-negative day vs. a >$500 day.
- ES (not MES) confirmed intentional for this account?
- Canonical subdomain `10xEdge` vs `10x`.

---

## 10. Why the spec stayed analytical

Per the internal-architecture convention, the spec wrapper is written for rigor (your stated preference for honest pushback over persuasive framing on internal work). The *page copy it specifies* uses the persuasive, evidence-first deck voice — and the founding-member CTA lives inside the page spec (§H), gated on the §8 compliance call, rather than being bolted onto this document.
