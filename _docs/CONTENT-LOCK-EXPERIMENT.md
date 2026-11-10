# Content lock — the experiment page (`/`)

The root page is a public experiment: **take $3,000 to $30,000 in one year**, in long
options (SPX same-day expiry; single-stock options 7–10 days out). It is a different
engine from the ES-futures record on `/program/`. **No figure crosses between the two
pages**, and the linter fails either page if one does.

## What is locked

| Statement | Where | Source |
|---|---|---|
| "The experiment: take $3,000 to $30,000 in one year." | H1 | operator, 2026-11-10 |
| 3.32 doublings | hero, scoreboard | log₂(10) |
| "It is not a forecast, and nothing on this page is a promise that it happens." | X3 | compliance |
| Scenario table: cooperative ≤ 4 doublings · mixed 1–3 · hostile 0–0.5 · falsified | X3 | operator's published options protocol |
| Six-uncorrelated-trade buffer; daily one-loss; weekly cap 12% of unit; two losing weeks; rolling-100 expectancy; revert; two reverts in 14 days | X5, X6 | same |
| Eight stop conditions | X6 | same |
| "No capital is managed, and no investment is offered or solicited." | hero **and** sign-up | compliance |
| The historical record (count, win rate, profit factor, average R, net, drawdown) | X7 | computed by `refresh-experiment.mjs` |

## What is generated, and never typed by hand

Everything about the record and the run comes from `_build/figures.json → experiment`
through `_build/chart.mjs`: the state rail, the scoreboard and its tiles, the record
ledger and its plot, the confidence-interval sentence, and the reconciliation notes
beside the reference card. To move any of them:

```
node _build/refresh-experiment.mjs            # dry run: what changed at source
node _build/refresh-experiment.mjs --apply    # accept it
node _build/build.mjs && node _build/lint.mjs
```

The reconciliation notes exist only while the defect they describe exists. Remove the
duplicate rows from the journal and the "dashboard lists 43 fills" sentence disappears
on the next refresh.

## The two records are kept apart

- **X7 + the dashboard = history.** What the alerts did before the clock started.
- **X2 = the experiment.** From $3,000, from the start date, and nothing before it.

The page never adds them together. In particular the history's dollars are not
restated as a return on $3,000: those alerts were not sized for a $3,000 account.

## Wording that depends on an operator input

Each of these is a gate in the linter. The page currently uses the conservative wording.

| Input | Now | When supplied |
|---|---|---|
| Start date | "Pre-launch · start date to be set"; pace line only | set `challenge.startDate`, refresh, rebuild — the scoreboard, rail and tiles go live |
| Account | "A model portfolio, tracked in public from a $3,000 starting balance" (hero rail), "scored as a model portfolio" (disclosures), "The record is a model portfolio" (reference card, disclosures) | if it is a funded account: name the broker, replace "model portfolio" in those four places, and remove the brokerage ban from the lint profile |
| Protocol at $3,000 | "Status: draft"; $300 unit; 12% weekly cap = $360 | confirm or change `protocol.*`; resolve the cap-versus-unit tension below |
| Witness | "countersignature is still pending" (X5, X6) | set `protocol.countersigned`; the linter then requires both phrases to be removed |
| Sign-up endpoint | form not connected | `_docs/SIGNUP-SETUP.md` |
| Dashboard base | "the dashboard plots the same fills against a $10,000 base" | set `dashboardBase.aligned` once the dashboard reads 3,000 / 30,000 |

### The tension in the rules at this scale

The published protocol caps weekly loss at 12% of the unit. On $3,000 that is **$360**.
The premium unit is **$300** (the median in the record). So one full-premium loss at the
first step uses 83% of the week, and at the second step ($600) a single loss is larger
than the cap. Either the cap scales with size, or premium per trade is capped below the
unit. The page states the published rule and is gated until this is decided.

## Not carried over from the reference page

`accelerator…/convexity.html` supplied the layout. Its "Never Lose Money" label, its
sentence that the stand-downs are "guaranteed to fire", its "as fast as possible"
framing and its 16× aspirational arc are not on this page. The forbidden-string rules
apply here exactly as on `/program/`.

## Known defects at source (found 2026-11-10)

- `options_trades.json` repeats O19, O20, O21, O22. The dashboard counts all 43 rows
  (+$6,629); the unique record is 39 alerts (+$5,489). The page states 39.
- O34–O38 have no date. They cannot be placed on the experiment's timeline, so a run
  that starts before them will not include them.
- O33 and O34 have no logged risk and are left out of the average-R figure (n = 37).
- O2–O10 are dated 3 April 2026 but expire in February and March: that is the date
  they were imported. The calendar span of the record is therefore approximate.
- Later rows log risk as less than the premium (a stop-defined risk). "1R = premium
  paid" is not true of every row, so the page says "where R is the risk logged".
- `dollar_pl` equals (exit − entry) × 100 on all 18 rows that log an exit price: the
  record is before commissions and fees, and the page says so.
- The accelerator site describes the same Discord experiment as "$10K → $100K, as fast
  as possible, live since June 30, 2026". Two public pages should not describe one
  experiment two ways.
