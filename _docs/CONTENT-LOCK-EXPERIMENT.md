# Content lock — Ekantik Ascent, the 10× Experiment (`/`)

**Source of truth:** the *Ekantik Ascent — 10x Experiment Charter*, dated 9 November 2026,
plus the operator's answers of 11 November 2026 to its SET items. Both are recorded in
`_build/figures.json → experiment`. Where this page and the charter disagree, the
charter wins and the page is wrong.

It is a different engine from the ES-futures record on `/program/`. No figure crosses
between the two pages, and the root page carries no reference to the futures edge
(operator, 10 November 2026). `/program/` is still built and old deep links such as
`/#capacity` still forward to it.

## The charter, as the page states it

| Charter | On the page |
|---|---|
| One live account, $3,000 of the founder's own money, 12 months | Hero, rules table |
| "Can the Ascent design compound an account toward 10x its starting capital without breaking its own risk rules? The result is published in full, whatever it is." | Hero lede |
| "The target is a multiple, not a dollar figure." | Headline leads with 10×; scoreboard axis is in multiples; rules section says it in words |
| "10x is the design ceiling, not the expectation. We consider reaching it unlikely." | Hero status line, Honest odds, disclosures |
| Three outcomes; "The only failed experiment is one where a rule is broken." | Honest odds |
| Rules table | Rules, row for row |
| Three kill criteria; ends 30 November 2027 otherwise | Kill criteria |
| Public log: each trade, running record, weekly, monthly broker statement | Public log |
| What this is not (six items) | Its own section, and the disclosures |

### SET items (operator, 11 November 2026)

| Item | Value |
|---|---|
| Instruments | Long options: SPX same-day expiry; single-stock options 7–10 days from expiry |
| Maximum risk per trade | 10% of the account ($300 at the start) |
| Maximum total open risk | 10% of the account |
| Floor | $2,000 |
| Edge check | Expectancy over the last 30 trades turns negative |
| Posting | In real time |

## Decisions that differ from the charter's wording

- **Sign-up.** The charter says every post links to "the free Alpha portal signup". The
  operator chose to keep the on-page form (name + email → Google Sheet → Discord). The
  Alpha portal is not mentioned on the page; the linter fails the page if it appears.
- **"$30,000".** The dollar value of 10× appears only where it is read off a scale: the
  scoreboard and the contracts-by-equity strip. It is never stated as the goal. The
  linter fails the page if it appears in the headline, the title or any other section.

## Three things flagged to the operator, not decided

1. **Sizing below $6,000.** "One contract per $3,000 of account equity", read literally,
   is zero contracts after the first loss. The page says *one contract until equity
   reaches $6,000*. This is a launch gate until confirmed
   (`protocol.sizingBelowStart.verified`).
2. **The demo alerts were not sized to these rules.** 17 of the 37 demo alerts with a
   logged risk put more than $300 at risk. The demo section says so; the count is
   generated from the journal.
3. **The dashboard** calls the same data a "model portfolio", counts four alerts twice
   (43 fills, +$6,629, against a true 39 and +$5,489), and is denominated
   $10,000 → $100,000. The page says "demo" and keeps reconciliation notes beside the
   reference card until the dashboard is fixed at source.

Also for the operator: from $3,000, four maximum-size losses in a row reach the $2,000
floor. The page states this under Honest odds.

## What is generated, and never typed by hand

Everything about the run, the rules' numbers and the demo data comes from
`figures.json → experiment` through `_build/chart.mjs`: the hero rail, the scoreboard
and its tiles, the contracts strip, every number in the rules and kill criteria, the
demo tiles and plot, and the reconciliation notes. To move any of them:

```
node _build/refresh-experiment.mjs            # dry run: what changed at source
node _build/refresh-experiment.mjs --apply    # accept it
node _build/build.mjs && node _build/lint.mjs
```

Until 1 December 2026 the page renders its pre-launch state, whatever the journal
holds. From that date the scoreboard counts only alerts **dated on or after the start**;
an undated journal row can never appear on it.

## Demo data is labelled demo everywhere

A charter launch gate, enforced by the linter rather than by a checklist: each of the
four tiles begins "Demo ·", the plot's caption begins "Demo account", a badge sits above
the tiles, the section opens by saying the data is from a demo account, and the demo
figures may not appear in any other section.

## Superseded and removed

The earlier version of this page used the Convexity protocol: the earned-doubling
ladder, the six-trade buffer and revert rules, the daily one-loss rule, the weekly cap,
eight stop conditions, the Expression and Fidelity gates, and a four-scenario table.
None of it is in the charter and none of it is on the page; the linter fails the page
if those terms return. The "$3,000 to $30,000 in one year" headline and every "model
portfolio" description of the experiment are gone for the same reason.

## Known defects in the demo journal (found 10 November 2026)

- `options_trades.json` repeats O19, O20, O21, O22.
- O34–O38 have no date; O33 and O34 have no logged risk (average R uses n = 37).
- O2–O10 are dated 3 April 2026 but expire in February and March: an import date.
- Later rows log risk as less than the premium, so the page says "where R is the risk logged".
- `dollar_pl` equals (exit − entry) × 100 on all 18 rows that log an exit price: the
  data is before commissions and fees, and the page says so.
- The accelerator site still describes this Discord channel's experiment as
  "$10K → $100K, as fast as possible, live since June 30, 2026". The charter says one
  live $3,000 account from 1 December 2026. Two public pages should not disagree.
