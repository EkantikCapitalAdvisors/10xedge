# Deploy checklist — THE EKANTIK STRUCTURAL EDGE landing page

Page: `index.html` → served at the **root** of `10xedge.ekantikcapital.com`.

> **2026-08-11 — PUBLISHED TO ROOT AT THE OPERATOR'S EXPLICIT INSTRUCTION.**
> The page was moved from `edge/` to the repository root and merged to `main`, replacing the
> holding page. This was done **with both hard blockers below still open**. The operator was told
> so before the move and instructed it anyway; that is their call to make, and it is recorded here
> rather than left implicit.
> - `noindex,nofollow` is retained, so the page is reachable but not indexable.
> - The previous holding page is preserved at `_archive/holding-page.html`. Rolling back is a
>   one-file copy: `cp _archive/holding-page.html index.html`.
> - The design fixer round was mid-flight at publish time (2 of 11 sections verified complete).

---

## 🔴 HARD BLOCKERS — the page is UNSHIPPABLE until both clear

These are not "nice to have before launch". Neither is waivable by the build, by design review, or by
schedule pressure. Both must be cleared, in writing, before this page is served to any address.

### BLOCKER 1 — Manish Dharod countersignature
The page names Manish Dharod as the Independent Witness and states publicly that he *"holds binding
authority over modifications and breach calls."* That is a claim about a third party's obligations,
published to the world.

- [ ] Manish has read the live page (not the deck) at the URL it will be served from.
- [ ] Manish has countersigned, in writing, the specific sentence naming him and the authority it
      describes.
- [ ] The countersignature covers the operative commitments the page makes on his behalf: binding
      authority over rule modifications, binding authority over breach calls, and the
      announced-within-24-hours disclosure of a tripped gate.
- [ ] A dated copy of the countersignature is filed with the compliance record.

> Per the Fidelity Gate published on this page, *every rule change is countersigned and disclosed before
> it runs*. Publishing an unsigned description of the countersignature mechanism would breach the very
> gate the page uses to earn trust. This blocker is self-enforcing.

### BLOCKER 2 — Counsel review of the pre-licensing status language
The page states that CTA registration (NFA / Series 3) is *in progress* and that no capital is managed
and no investment is offered or solicited. Every one of those is a regulatory representation.

- [ ] Securities/commodities counsel has reviewed the full page, not an excerpt.
- [ ] Counsel has specifically signed off on:
      - the soft-launch status block (hero) and its verbatim repetition at the CTA;
      - the "not currently registered as a Commodity Trading Advisor / registration in progress"
        paragraph in the footer;
      - the roadmap section's characterisation of the STRUCTURE and LICENSE stages, including the
        indicative 60–90 / 90–180 day ranges;
      - whether publishing a live signal log during the pre-registration period constitutes CTA
        activity or general-solicitation exposure in the intended jurisdictions;
      - whether the capacity section's $3M / $20,000 language reads as an offer;
      - the adapted Slide-18 disclosure block in full.
- [ ] Counsel has ruled on the **noindex decision** (see below).
- [ ] Written sign-off is filed and dated.

---

## Deferred decision — `noindex`

`edge/index.html` currently ships with `<meta name="robots" content="noindex,nofollow">`.

**Recommendation: keep noindex until BOTH blockers clear.** A publicly indexed page describing a live
futures track record from an entity whose CTA registration is still in progress is exactly the surface
that creates general-solicitation exposure. Indexing is a one-way door in practice — it is trivially
reversible in the HTML and effectively irreversible in caches, archives and screenshots.

- [ ] Counsel has ruled explicitly on whether the page may be indexed pre-registration.
- [ ] If indexing is approved: remove the robots meta, add `edge/` to a sitemap, and re-run the
      compliance gate against the indexed copy.
- [ ] If indexing is refused: confirm `noindex,nofollow` is present, confirm no sitemap entry, and
      confirm the root `/` holding page still does not link to `/edge/`.

---

## Content and compliance gates (all must be green)

- [ ] `cd edge/_build && node lint.mjs` exits 0 — zero blocking issues.
- [ ] CEG compliance critic: zero flags at any severity.
- [ ] Every figure traced to the deck, with its conditionality attached.
- [ ] Forbidden strings absent: `guarantee*`, `protect*`, "never lose", "principal protected",
      "Skip the Crashes". (Note the standard phrase "past performance does not guarantee future
      results" is forbidden by this rule — the page uses "is not indicative of future results".)
- [ ] No appendix hypotheticals on the page: no 30% yield, no $1.41M stack, no monthly-check dollar
      tables, no ~119R, no overlay math, no SPY comparison.
- [ ] No EPIG reference, no CAGR, no blended or floating claims.
- [ ] Soft-launch status appears above the fold AND at the CTA.
- [ ] No allocation-priority promise anywhere; CTA is observation-only; no waitlist.
- [ ] Tripwires and kill-criteria are on the page, not in fine print.

## Build and functional gates

- [ ] `node _build/build.mjs` run; `index.html` and `sections.css` regenerated from `_sections/`.
- [x] **Discord invite URL substituted** — both gold CTAs point at `discord.gg/GprT4S8Vrj`,
      taken from the dashboard's own "Follow the live trades" link. Re-verify the invite has not
      expired immediately before launch.
- [ ] Calendly link verified live: `https://calendly.com/hd-ekantikcapital/30min`.
- [ ] `mailto:` and `tel:` links verified.
- [ ] Zero external network requests (fonts are self-hosted; verify in devtools Network panel).
- [ ] No console errors at any breakpoint.
- [ ] Renders correctly with JavaScript disabled (all content visible, no hidden reveals).
- [ ] `prefers-reduced-motion: reduce` honoured — no motion at all.
- [ ] Keyboard-only pass: skip link works, focus ring visible on every interactive element, tab order
      matches reading order.
- [ ] Screen-reader pass on the conceptual SVG (§04) and the capacity visual (§07) — both have text
      equivalents.

## Design gates

- [ ] Design critic: SHIP at 390 / 768 / 1440.
- [ ] Direct-response critic: SHIP.
- [ ] Verified on real iOS Safari and Android Chrome, not just emulation (`100svh`, tap targets,
      font rendering).
- [ ] Print stylesheet produces a legible document (advisors will print this).

## Hosting

- [ ] Decide the serving path. The repo root currently serves an intentional holding page
      (`/index.html`, committed as "Take landing page offline"). **This build does not overwrite it** —
      it lives at `edge/`. Confirm the intended destination before changing anything at root.
- [ ] Vercel: static, no build step required. `edge/` deploys as-is.
- [ ] GitHub Pages: `edge/` is served at `/edge/` with no configuration.
- [ ] Cache headers: fonts immutable (1yr), HTML no-cache.
- [ ] HTTPS enforced; `CNAME` unchanged.

## Post-deploy

- [ ] Re-run `lint.mjs` against the deployed HTML, not the local file.
- [ ] Confirm the Discord signal log is actually live and timestamped before the page points at it —
      the page's entire credibility rests on a reader finding a real log when they arrive.
- [ ] Diary the date; the "246 trades · Feb–Aug 2026" window will need updating as the record grows,
      and every update re-triggers the CEG gate.

---

## Figure refresh (build-time)

`edge/_build/refresh.mjs` pulls the live trade journal, recomputes the engine figures, and reports
drift against what the page states. It is deliberately **human-initiated and build-time only** — the
page never fetches anything at runtime. A figure that rewrites itself in the browser emits a claim
nobody gated, which is the failure the CEG constraint exists to prevent.

- [ ] `node _build/refresh.mjs` (dry run) before every republish.
- [ ] **Verify the cost model.** `figures.json` carries `costModel.roundTurnUsd: 1.50`, currently
      `verified: false`. The public feed has NO commission field, so the net profit factor cannot be
      derived from it — $1.50/trade is the value that reconciles the record's gross profit factor
      (1.507) to the deck's stated net 1.49. **The page's `$1.49` rests entirely on this
      assumption.** Confirm the real round-turn cost, then set `verified`, `verifiedBy`, `verifiedOn`.
- [ ] After any `--apply`: re-read the sample caveat by hand. *"246 trades is six months of one kind
      of market"* ties a count to a duration and to a regime claim — a new count can falsify the
      sentence around it, and no substitution can detect that.
- [ ] After any `--apply`: `node build.mjs && node lint.mjs`, then re-run the CEG compliance critic
      over the whole page.
- [ ] Material drift (win rate ±0.5pp, profit factor ±0.03, trade count ±10%) requires counsel
      re-review before republishing.

## ⚠️ Open verification items — all block ship

`lint.mjs` fails the build while any of these is unresolved. The gates are structural, not
advisory: the page cannot be built clean until each is answered.

### 1. Traded equity — ✅ RESOLVED
Confirmed by the operator 2026-08-11: the 246-trade record was traded on a **$20,000 portfolio**.
The page states the balance beside the percentage, because the same $9,984 of realised P&L is
+49.9% on $20,000 and +20.0% on $50,000.
- [ ] Residual note, still to settle: **10 of the 246 trades risked more than 2.5% of $20,000**, the
      largest $1,000 = 5.0%. The deck's ruin figure is simulated *at* a 2.5% per-trade ceiling, so
      that simulation is more disciplined than the record it draws from. Average risk was $232
      (1.2%), consistent with the deck. The page must not imply every historical trade sat inside
      2.5% — confirm the current copy does not.

### 2. Cost model — ❌ OPEN
The page says "net of all costs". That rests on an **inferred** $1.50/trade round-turn (the value
reconciling gross PF 1.507 to the deck's net 1.49).
- [ ] Confirm the actual round-turn commission, then set `costModel.verified` in `figures.json`.

### 3. Tightened risk rules — ❌ OPEN
The operator reported new drawdown caps of **$1,000 in any week and $2,000 in any month** on the
$20,000 portfolio (tightened from the deck's appendix figure of $1,000 weekly / $2,500 monthly).
The record already conforms — worst losing week −$938, worst losing month −$132, zero breaches of
either cap — and the page says so.
- [ ] **Countersignature.** This page publishes a Fidelity Gate promising *every rule change is
      countersigned and disclosed before it runs*. Tightening the risk rules is a rule change.
      Manish Dharod must countersign and it must be disclosed before the page describes the caps as
      being in force. Then set `riskControls.countersigned`.
- [ ] **Broker-enforced or self-imposed?** The deck called these "broker-enforced hard caps". A
      broker-enforced cap is a mechanism; a self-imposed cap is a rule the operator must honour.
      These are materially different claims. Set `riskControls.brokerEnforced` to the truth and make
      the copy match — the page must imply no enforcement that does not exist.

### 4. Discord attribution — ❌ OPEN

The page states every figure is *"measured from one live futures engine — 246 trades called in real
time in our Discord channel, Feb–Aug 2026."* In the journal, the `source` field splits:

- **141 trades tagged `discord`** — Feb–Jun, all ES
- **107 trades tagged `tradovate`** — 1 Jul–6 Aug, mostly MES

Those July–August trades may well have been posted live in Discord and later reconciled against the
broker — the dashboard states every fill is posted by hand as the order goes in, and `source` may
only record the ingestion path. But it is not verifiable from the data, and the page's entire
credibility rests on that one sentence.

- [ ] Confirm whether all 246/248 trades were called in Discord **before** the outcome was known.
- [ ] If not, the attribution sentence must be corrected — it is locked verbatim from the deck and
      must not be quietly softened or quietly sharpened.
- [ ] Related: the deck's disclosure says the trades are *"not independently broker-reconciled"*, yet
      107 rows come directly from Tradovate. That line may now understate the actual rigour and
      should be re-checked against reality.
