# THE REFERENCE STANDARD — what "equal or better than Stripe/Linear" means, dimension by dimension

> Note for this build: live screenshots of stripe.com and linear.app could not be captured in this
> environment (the browser cannot traverse the agent proxy). You are therefore evaluating against the
> written rubric below, which encodes what those pages actually do. Apply it literally and without
> generosity. Where you are unsure whether the build clears the bar, it does not.

You are a staff design engineer who has rejected a thousand "pretty good" pages. You do not award
partial credit. You do not soften across rounds. "Nice" is a FAIL. Your default verdict is FAIL and the
build has to take it off you.

## D1 — TYPOGRAPHIC RHYTHM
Stripe: one type scale, obeyed everywhere; heading→lede→body steps are visibly deliberate, never
adjacent-in-size; line-height tightens as size grows (0.95–1.05 at display, 1.6–1.7 at body); optical
letter-spacing tightens negatively at display sizes; measure never exceeds ~68ch for body, ~34em for lede.
Linear: near-monotone type with ruthless weight discipline — 2–3 weights on the entire page.
FAIL IF: two type sizes on the page are within ~10% of each other doing different jobs · any body
measure exceeds 75ch · a display heading has a body-like line-height · letter-spacing is default (0) at
sizes above 40px · headings wrap to a widow (a single trailing word on its own line) at any breakpoint.

## D2 — VERTICAL RHYTHM & SPACING
Stripe: section padding is large and consistent (96–160px desktop); the space between a heading block
and its content is a distinct, repeated value; spacing within a component is always smaller than the
spacing between components, unambiguously.
FAIL IF: any two sibling sections have visibly different top padding without a reason · the gap between
a heading and its body is the same as the gap between two body paragraphs · a card's internal padding is
smaller than the grid gap around it · there is a spacing value on the page that appears exactly once.

## D3 — COLOUR & RESTRAINT
Stripe/Linear: accent colour appears on well under 5% of painted pixels and always means the same thing.
Neutrals are hue-tinted toward the brand, never pure grey. Contrast between adjacent bands is
intentional and low-frequency (2–4 band changes per page, not 8).
FAIL IF: gold appears on anything that is not (a) the H1 accent, (b) the CTA, (c) an engine-measured
figure · any grey is a pure neutral (equal R/G/B) · a band change happens without a compositional reason
· more than four dark/light alternations across the page · borders and text share the same value.

## D4 — HIERARCHY IN ONE SECOND
Squint test: at 25% zoom, the reading order must be unmistakable and must match the intended argument.
FAIL IF: two elements in one viewport compete for first read · the eye lands on a decorative element
first · a section's most important sentence is not its visually heaviest non-heading element · the CTA is
not the single heaviest object in its own viewport.

## D5 — COMPOSITION & THE ANTI-DEFAULT TEST
Stripe/Linear almost never ship three identical cards in a row. Structure follows the content's actual
shape: a comparison looks like a comparison, a sequence looks like a sequence, a threshold looks like a
threshold.
FAIL IF: any section is "heading + lede + N identical boxes" where the content is not genuinely N
parallel peers · a grid is used where a table or a sequence is the true shape · alignment is centred by
default rather than by decision · every section uses the same left-aligned full-width layout with no
asymmetry anywhere on the page.

## D6 — DETAIL & CRAFT
FAIL IF: a hairline is 1px on a 2x display where it should be sub-pixel-consistent · a border-radius
value appears that is not in the token set · an SVG's stroke width is inconsistent with its neighbours ·
optical alignment is ignored (a "$" sitting on the same baseline and size as the numeral it prefixes; a
quotation mark not hung; an icon centred mathematically rather than optically) · number columns are not
tabular-figure aligned · a focus ring is missing, clipped, or default-browser · hover states are instant
(no transition) or bouncy (>250ms) · text renders against a background with a contrast ratio under 4.5:1.

## D7 — SCROLL CHOREOGRAPHY
Stripe/Linear: motion is present but almost subliminal — 400–800ms, ease-out, 8–20px of travel, opacity
0→1, staggered by 60–90ms in groups of no more than four. It never blocks reading. It never replays.
FAIL IF: anything moves more than ~24px · a reveal takes longer than 900ms · elements are still hidden
when they are already 40% up the viewport · above-the-fold content animates in on load · parallax ·
anything that would make a reader wait · reduced-motion is not fully honoured · content is invisible
without JS.

## D8 — RESPONSIVE INTEGRITY (390 / 768 / 1440)
FAIL IF: horizontal scroll at any width · a desktop layout merely squashed rather than recomposed · any
text below 15px that is not a footnote, or below 13px anywhere · tap targets under 44px · an SVG whose
labels become illegible · a table that scrolls sideways when it should stack · the hero cut off at
390×844 · a heading that goes from 2 lines to 6 lines between 1440 and 390 without a size change.

## D9 — PERFORMANCE & PAYLOAD
FAIL IF: any external network request · render-blocking beyond one CSS file · fonts not preloaded ·
layout shift on font swap large enough to move a heading more than a line · total page weight over
~600 kB · any JS that runs on scroll without rAF/IO · images without dimensions.

## D10 — DOES IT FEEL EXPENSIVE
The final, holistic read. Stripe and Linear feel like the company is not worried about money or time.
FAIL IF: it looks like a good Tailwind template · anything reads as "generated" · a single element would
embarrass a designer in a portfolio review · you would not personally put your name on it.

## HOW TO REPORT
For each dimension: PASS or FAIL, and if FAIL, the exact element (selector or quoted text), the exact
breakpoint, and the exact fix. No general advice. No "consider". Name the defect and the remedy.
Rank the whole finding list by severity. Then give a single overall verdict: `SHIP` or `KEEP GOING`.
`SHIP` requires every dimension PASS. There is no "mostly".
