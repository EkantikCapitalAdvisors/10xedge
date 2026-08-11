# Deploy checklist — THE EKANTIK STRUCTURAL EDGE landing page

Page: `edge/index.html` → intended path `/edge/` on `10xedge.ekantikcapital.com`.

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
- [ ] **Discord invite URL substituted** — the CTA currently ships `href="#"` with a `TODO` comment.
      The page must not go live with a dead primary CTA.
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

## ⚠️ Claim to verify before ship — Discord attribution

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
