#!/usr/bin/env node
/* Deterministic compliance + design-system linter. Runs against the BUILT output of
   every page in pages.mjs; exits 1 if any page has a blocking issue.
     node _build/lint.mjs [--page=name]
   Each page is checked by the SHARED rules (forbidden strings, structure, design
   system, contrast, external requests) and then by its own PROFILE, because each
   page is a different engine with its own locked figures and mandatory statements.
   This is a floor, not a ceiling — a human still gates every sentence. */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from './pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function makeCtx(page) {
  const htmlRaw = readFileSync(join(root, page.outHtml), 'utf8');
  const sectionCss = existsSync(join(root, page.outCss)) ? readFileSync(join(root, page.outCss), 'utf8') : '';
  const css = sectionCss + readFileSync(join(root, 'styles.css'), 'utf8');
  const fails = [], warns = [], gates = [];
  const F = (rule, detail) => fails.push(`${rule}: ${detail}`);
  /* A gate is not a defect in the page: it is an operator input that has not arrived.
     It blocks publication exactly as a failure does, but is reported apart so the two
     are never confused. `--preview` lets a private preview build through its gates. */
  const G = (rule, detail) => gates.push(`${rule}: ${detail}`);
  const W = (rule, detail) => warns.push(`${rule}: ${detail}`);

  /* Visible text only: strip comments, script, style; svg <title>/<desc> kept. */
  const stripped = htmlRaw
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const text = stripped
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&').replace(/&rarr;/g, '→').replace(/&uarr;/g, '↑')
    .replace(/&times;/g, '×').replace(/&asymp;/g, '≈').replace(/&nbsp;/g, ' ')
    .replace(/&lsquo;/g, '\u2018').replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201C').replace(/&rdquo;/g, '\u201D')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  /* Also lint attribute-borne copy (alt, aria-label, title, content=) */
  const attrText = [...stripped.matchAll(/(?:alt|aria-label|title|content|placeholder)="([^"]*)"/gi)]
    .map(m => m[1]).join(' | ');
  const allCopy = text + ' | ' + attrText;
  return { page, htmlRaw, css, sectionCss, stripped, text, allCopy, fails, warns, gates, F, W, G };
}

/* ======================= SHARED — every page ======================= */
function shared(ctx) {
  const { page, htmlRaw, css, stripped, text, allCopy, F, W } = ctx;
  /* ---------- 1. Forbidden strings ---------------------------------------- */
  const FORBIDDEN = [
    /guarantee/i, /guaranteed/i, /guarantees/i,
    /\bprotect(s|ed|ion|ing)?\b/i,
    /never lose/i, /principal protected/i, /skip the crashes/i,
  ];
  for (const re of FORBIDDEN) {
    const m = allCopy.match(new RegExp(`.{0,70}${re.source}.{0,70}`, 'i'));
    if (m) F('FORBIDDEN-STRING', `/${re.source}/ → "…${m[0].trim()}…"`);
  }

  /* ---------- 6. Structure / a11y ----------------------------------------- */
  const h1 = [...htmlRaw.matchAll(/<h1[\s>]/gi)].length;
  if (h1 !== 1) F('A11Y', `expected exactly 1 <h1>, found ${h1}`);

  const REQUIRED_IDS = page.requiredIds;
  for (const id of REQUIRED_IDS) if (!new RegExp(`id="${id}"`).test(htmlRaw)) F('STRUCTURE', `missing section id="${id}"`);

  if (/<!-- MISSING SECTION/.test(htmlRaw)) F('STRUCTURE', 'a section failed to inline during build');

  for (const m of stripped.matchAll(/<section\b[^>]*>/gi)) {
    if (!/aria-labelledby=/.test(m[0])) W('A11Y', `<section> without aria-labelledby: ${m[0].slice(0, 90)}`);
  }
  for (const m of stripped.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) {
    if (!/rel="[^"]*noopener/.test(m[0])) F('A11Y', `target="_blank" without rel="noopener": ${m[0].slice(0, 80)}`);
  }
  /* headings never skip a level */
  const levels = [...htmlRaw.matchAll(/<h([1-6])\b/gi)].map(m => +m[1]);
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) W('A11Y', `heading level jump h${levels[i - 1]} → h${levels[i]}`);
  }

  /* ---------- 7. Design-system integrity ---------------------------------- */
  /* Comments legitimately quote measured composite values — scan declarations only. */
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const hexes = [...cssCode.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)].map(m => m[0].toUpperCase());
  const ALLOWED_HEX = new Set(['#1B2A4A', '#C8A951', '#FAF8F5', '#131F38', '#16243F', '#2A3B60',
    '#F3EFE9', '#EAE4DB', '#D8BE73', '#A98B36', '#FFFFFF', '#FFF', '#000', '#000000']);
  const strayHex = [...new Set(hexes)].filter(h => !ALLOWED_HEX.has(h));
  if (strayHex.length) F('DESIGN-SYSTEM', `off-palette hex in CSS: ${strayHex.join(', ')}`);

  const strayColorFns = [...cssCode.matchAll(/\b(rgb|rgba|hsl|hsla)\(([^)]*)\)/gi)]
    .map(m => m[0])
    .filter(s => !/^rgba?\(\s*(27,\s*42,\s*74|250,\s*248,\s*245|200,\s*169,\s*81|19,\s*31,\s*56|255,\s*255,\s*255|0,\s*0,\s*0)/.test(s));
  if (strayColorFns.length) F('DESIGN-SYSTEM', `off-palette color() in CSS: ${[...new Set(strayColorFns)].slice(0, 6).join(' ')}`);

  if (/!important/.test(css.replace(/@media \(prefers-reduced-motion[\s\S]*?\n\}/g, '')))
    W('DESIGN-SYSTEM', '!important used outside the reduced-motion block');

  const secCss = ctx.sectionCss;
  if (/^\s*:root\s*\{/m.test(secCss)) F('DESIGN-SYSTEM', 'a section CSS file declares :root — tokens live in styles.css only');

  /* Fonts: no font-family outside the three brand families */
  for (const m of cssCode.matchAll(/font-family:\s*([^;}]+)/gi)) {
    const v = m[1];
    if (!/Cormorant Garamond|DM Sans|JetBrains Mono|inherit|var\(/.test(v))
      F('DESIGN-SYSTEM', `non-brand font-family: ${v.trim().slice(0, 70)}`);
  }

  /* Inline styles carry custom properties only: the reveal delay (--d) and the
     percentage coordinates of a build-time plot (--x, --y, --h). Never a declaration. */
  for (const m of stripped.matchAll(/\sstyle="([^"]*)"/gi)) {
    if (!/^(?:--[a-z]+:\s*-?[\d.]+(?:ms|%);?\s*)+$/.test(m[1].trim())) W('DESIGN-SYSTEM', `inline style beyond a custom property: ${m[1].slice(0, 60)}`);
  }

  /* No external network requests */
  for (const m of stripped.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/gi)) {
    if (!page.allowHosts.test(m[1]))
      F('PERF', `external request to ${m[1]} — the page must be fully self-contained`);
  }
  /* Outbound links must be navigations, never fetched assets.
     rel=canonical/preconnect/dns-prefetch declare metadata, they load nothing. */
  for (const m of stripped.matchAll(/<(?:script|link|img|iframe)\b[^>]*(?:src|href)="https?:\/\/[^"]+"[^>]*>/gi)) {
    if (/rel="(canonical|preconnect|dns-prefetch|alternate)"/i.test(m[0])) continue;
    F('PERF', `embedded external asset: ${m[0].slice(0, 90)}`);
  }

  /* ---------- 7b. Measured contrast of the semantic token ladder ----------- */
  const srgb = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const parseHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const composite = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
  const contrast = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const NAVY = parseHex('#1B2A4A'), IVORY = parseHex('#FAF8F5'), DEEP = parseHex('#131F38');

  /* Read the live alphas out of styles.css so the check can never drift from the tokens. */
  const alphaOf = (name, scope) => {
    const block = scope === 'dark'
      ? (css.match(/\.band--dark\s*\{[\s\S]*?\n\}/) || [''])[0]
      : (css.match(/^:root\s*\{[\s\S]*?\n\}/m) || [''])[0];
    const m = block.match(new RegExp(`${name}:\\s*rgba\\([^)]*?,\\s*([\\d.]+)\\s*\\)`));
    return m ? parseFloat(m[1]) : null;
  };
  const TEXT_TIERS = [
    ['--ink-2', 'light', NAVY, IVORY], ['--ink-3', 'light', NAVY, IVORY],
    ['--ink-2', 'dark', IVORY, NAVY], ['--ink-3', 'dark', IVORY, NAVY],
    ['--ink-2', 'dark', IVORY, DEEP], ['--ink-3', 'dark', IVORY, DEEP],
  ];
  for (const [tok, scope, fg, bg] of TEXT_TIERS) {
    const a = alphaOf(tok, scope);
    if (a == null) { W('CONTRAST', `could not read ${tok} (${scope})`); continue; }
    const r = contrast(composite(fg, a, bg), bg);
    if (r < 4.5) F('CONTRAST', `${tok} on ${scope === 'light' ? 'ivory' : (bg === DEEP ? 'deep navy' : 'navy')} is ${r.toFixed(2)}:1 — body text needs 4.5:1`);
  }
  /* --ink-4 is decorative (2.00:1): it may paint a separator glyph the screen reader
     never announces, but never text a human is meant to read. Verified against the
     markup — every element carrying the class must be aria-hidden. */
  for (const m of cssCode.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const decl = (m[2].match(/[^;]*--ink-4[^;]*/) || [''])[0];
    if (!/(?:^|[^-])color:\s*var\(--ink-4\)/.test(m[2]) || /border|outline|background|stroke|fill/.test(decl)) continue;
    const sel = m[1].trim();
    const cls = (sel.match(/\.([A-Za-z0-9_-]+)\s*$/) || [])[1];
    if (!cls) { F('CONTRAST', `--ink-4 used as text colour on "${sel.slice(0, 60)}" — decorative only`); continue; }
    const uses = [...stripped.matchAll(new RegExp(`<[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`, 'g'))];
    if (!uses.length) { W('CONTRAST', `--ink-4 rule for ".${cls}" matches no element`); continue; }
    const readable = uses.filter(u => !/aria-hidden="true"/.test(u[0]));
    if (readable.length)
      F('CONTRAST', `--ink-4 (2.00:1) paints readable text on ".${cls}" — either raise it to --ink-3 or mark the element aria-hidden: ${readable[0][0].slice(0, 80)}`);
  }
  /* Gold on ivory is 2.14:1 and gold-deep 3.08:1 — large text only, never small copy.
     .nav is exempt: it floats over the navy hero (gold on navy = 6.26:1) and its
     stuck state repaints as navy-900 on a gold ground (7.22:1). */
  for (const m of cssCode.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!/(?:^|[^-])color:\s*var\(--gold\)/.test(m[2])) continue;
    const sel = m[1].trim();
    if (/\.nav|\.band--dark|\.btn--gold/.test(sel)) continue;
    W('CONTRAST', `--gold as text on a light ground (2.14:1) in "${sel.slice(0, 60)}" — permitted only on large figures`);
  }

  /* ---------- 8. Mono discipline ------------------------------------------ */
  /* .mono/.fig must not wrap the indicative day ranges (they are estimates, not engine output) */
  for (const m of stripped.matchAll(/<[^>]*class="[^"]*\b(?:mono|fig)\b[^"]*"[^>]*>([^<]{0,40})</gi)) {
    if (/\d+\s*[–-]\s*\d+\s*days/i.test(m[1])) F('MONO-DISCIPLINE', `indicative day range set in mono: "${m[1].trim()}"`);
  }

}

/* ================ PROFILE — program (ES-futures page) ================ */
function program(ctx) {
  const { page, htmlRaw, css, stripped, text, allCopy, F, W } = ctx;
  /* ---------- 2. Forbidden content (appendix hypotheticals / out of scope) - */
  const FORBIDDEN_CONTENT = [
    [/\bEPIG\b/i, 'EPIG reference'],
    [/\bCAGR\b/i, 'CAGR'],
    [/\$1\.41\s?M|1,410,000/i, 'the $1.41M appendix stack'],
    [/\b30\s?%\s*(cash[- ]flow\s*)?yield/i, 'the 30% appendix yield'],
    [/\$600\s*(\/|per\s*)?\s*month|\$1,800|\$10,200|\$12,000\b/i, 'monthly-check dollar table figure'],
    [/119\s?R/i, '~119R per year (annualised composite — out of scope)'],
    [/29\.8\s?%|15\.0\s?%\/yr/i, 'tapering overlay schedule'],
    [/\$259\s?K|\$259,000/i, 'SPY comparison stack'],
    [/\bSPY\b/i, 'SPY overlay reference'],
    [/only\s+\d+\s+(spots?|seats?|places?|left)/i, 'manufactured scarcity ("only N left")'],
    [/\bcountdown\b|\bacts? now\b|\bhurry\b|\bdon.t miss out\b/i, 'manufactured urgency'],
    [/\bpriority access\b|\breserve (your |a )?(seat|spot|allocation)\b|\bfirst access\b|\bearly access\b/i,
      'allocation-priority promise'],
    [/0\.44|0\.50 |0\.61|~2\.1/i, 'third-party Sharpe ladder figure'],
    [/revolutionary|unprecedented|game[- ]?chang|supercharge|unlock the|secret sauce|explosive/i, 'hype adjective'],
  ];
  for (const [re, why] of FORBIDDEN_CONTENT) {
    const m = allCopy.match(new RegExp(`.{0,60}(?:${re.source}).{0,60}`, 'i'));
    if (m) F('FORBIDDEN-CONTENT', `${why} → "…${m[0].trim()}…"`);
  }
  /* waitlist is allowed exactly once, in "There is no waitlist." */
  const wl = [...allCopy.matchAll(/waitlist/gi)];
  if (wl.length && !/no waitlist/i.test(allCopy)) F('FORBIDDEN-CONTENT', '"waitlist" appears without the negating "no waitlist"');
  if (wl.length > 1) W('CHECK', `"waitlist" appears ${wl.length}×  — only the negating use is permitted`);

  /* ---------- 3. Required strings (mandatory statements) ------------------- */
  const REQUIRED = [
    [/149 trades is six months of one kind of market\s*[—-]\s*promising, not yet proven/i, 'the sample caveat, verbatim'],
    [/62\.4\s?%/, '62.4% exact win rate'],
    [/\$\s?1\.69/, '$1.69 profit factor (net of Tradovate Free-plan costs, Discord-only basis)'],
    [/\b149\b/, '149 live trades'],
    [/computed, not promised/i, '"computed, not promised"'],
    [/1 in 200,000/i, '< 1 in 200,000 ruin figure'],
    [/1\.4\s*[–-]\s*1\.7/, 'Sharpe ~1.4–1.7'],
    [/\$5\s?M|\$5,000,000/i, 'the $5M capacity ceiling'],
    [/\$30,000/, 'the $30,000 minimum allocation'],
    [/166\s*(<[^>]*>)?\s*fit\./i, 'the capacity count: 166 fit at the minimum'],
    [/far fewer\s*(<[^>]*>)?\s*do\./i, 'the second half: far fewer do'],
    [/a handful of large allocations could close the door on everyone else/i, 'the scarcity punch line'],
    [/a low ceiling is exactly what a real edge looks like/i, 'the low-ceiling line'],
    [/observation is the only open position/i, 'the equalizer'],
    [/no one can allocate/i, 'the equalizer, first clause'],
    [/Feb\s*[–-]\s*Aug 2026/i, 'the measurement window'],
    [/net of all costs/i, '"net of all costs"'],
    [/is not indicative of future results/i, 'the corrected past-performance line'],
    [/Series 3/i, 'Series 3 / NFA registration status'],
    [/Manish Dharod/i, 'the independent witness'],
    [/three orders of magnitude earlier/i, 'the Medallion category line'],
    [/Expression Gate/i, 'the Expression Gate'],
    [/Fidelity Gate/i, 'the Fidelity Gate'],
    [/Interactive Brokers/i, 'the execution venue named where the page describes the forward vehicle'],
  ];
  for (const [re, why] of REQUIRED) if (!re.test(allCopy)) F('MISSING-REQUIRED', why);

  /* Soft-launch status must appear TWICE (hero + CTA) */
  const softLaunch = (allCopy.match(/no capital is managed/gi) || []).length;
  if (softLaunch < 2) F('MISSING-REQUIRED', `soft-launch "no capital is managed" statement appears ${softLaunch}× — must appear above the fold AND at the CTA`);

  /* Single-engine attribution must appear in full at least once */
  if (!/measured from one live futures engine/i.test(allCopy))
    F('MISSING-REQUIRED', 'the full single-engine attribution sentence');

  /* ---------- 4. Figure integrity ----------------------------------------- */
  /* No rounding up: 58.9 must never be written as 59.0/60; 1.49 never 1.5 as the profit factor */
  if (/\b62\.5\s?%|\b63\s?%\s*of trades/i.test(allCopy)) F('FIGURE-DRIFT', 'win rate rounded beyond 62.4%');
  if (/\$\s?1\.(49|44)\b/.test(allCopy)) F('FIGURE-DRIFT', 'superseded profit factor on the page — the current figure is $1.69 on the 149-trade Discord-only record, net of confirmed Tradovate Free-plan costs');
  /* Match only genuine inflation ("over 160 trades", "150+ trades"), never mere
     adjacency — the §02b stats grid puts "187" (days live) next to "Trades logged". */
  if (/(?:over|more than|nearly|almost)\s+1[5-9]\d\s+(?:live\s+)?trades|\b1[5-9]\d\+\s*(?:live\s+)?trades|\b149\+/i.test(allCopy))
    F('FIGURE-DRIFT', 'trade count inflated beyond 149');
  if (/sharpe[^.]{0,24}~?1\.5\b/i.test(allCopy) && !/1\.4\s*[–-]\s*1\.7/.test(allCopy))
    F('FIGURE-DRIFT', 'Sharpe stated as ~1.5 without the 1.4–1.7 range');
  /* 59% headline requires the 58.9% exact subline */
  if (/\b62\s?%/.test(allCopy) && !/62\.4\s?%\s*exactly/i.test(allCopy))
    F('FIGURE-DRIFT', '"62%" headline used without the "62.4% exactly" subline');

  /* The per-account cap superseded the no-limit claim on 2026-08-11. Both the old
     wording and the old arithmetic are now false and must never reappear. */
  if (/no per[- ]account limit/i.test(allCopy))
    F('FIGURE-DRIFT', '"no per-account limit" is superseded — a $300,000 per-account maximum now applies');
  if (/\$300,000/.test(allCopy))
    F('FIGURE-DRIFT', 'the $300,000 per-account maximum was retired — the page states a minimum only and names no maximum');
  if (/\$3\s?M\b|\$3,000,000/.test(allCopy))
    F('FIGURE-DRIFT', 'the $3M launch cap is superseded — capacity is a single $5M ceiling');
  if (/\$20,000\s*(<[^>]*>)?\s*minimum|minimum[^.]{0,24}\$20,000/i.test(allCopy))
    F('FIGURE-DRIFT', 'the minimum allocation is $30,000, not $20,000 — note $20,000 remains correct as the traded equity in the record');

  /* The operator's own broker must not appear in page copy. The record was traded
     at Tradovate and the net figures are net of that schedule — which is recorded
     in figures.json — but a member opens an Interactive Brokers account, and
     naming the operator's venue on the page would only mislead. */
  if (/tradovate/i.test(allCopy))
    F('BROKER', '"Tradovate" appears in page copy — it is the operator\'s own broker and the historical cost basis, not the member-facing venue. Members open Interactive Brokers accounts.');

  /* ---------- 5. Section 08 must contain zero digits ----------------------- */
  const s8 = stripped.match(/<section[^>]*id="expressions"[\s\S]*?<\/section>/i);
  if (!s8) F('STRUCTURE', 'section #expressions not found');
  else {
    const t8 = s8[0].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
    const digits = t8.match(/\d/g);
    if (digits) F('SECTION-08', `"One Edge, Many Expressions" must contain zero digits — found: ${[...new Set(digits)].join('')} in "${t8.replace(/\s+/g,' ').trim().slice(0,160)}"`);
  }

  /* ---------- 9. Dashboard link policy ------------------------------------ */
  const DASH = 'accelerator.ekantikcapital.com/experiment.html';
  const dashLinks = [...stripped.matchAll(new RegExp(`<a\\b[^>]*href="[^"]*${DASH.replace(/[.]/g, '\\.')}[^"]*"[^>]*>`, 'gi'))];
  if (!dashLinks.length) F('DASHBOARD', 'the live instrumentation dashboard is not linked anywhere');
  for (const a of dashLinks) {
    if (/class="[^"]*\bbtn\b/.test(a[0])) F('DASHBOARD', `dashboard linked as a button — it must never compete with the Discord CTA: ${a[0].slice(0, 90)}`);
    if (/class="[^"]*\bfig--gold|\baccent\b/.test(a[0])) F('DASHBOARD', 'dashboard link uses the gold ration reserved for the CTA');
    if (!/rel="[^"]*noopener/.test(a[0])) F('DASHBOARD', `dashboard link missing rel="noopener": ${a[0].slice(0, 80)}`);
  }
  if (/Cash[- ]Flow Engine/i.test(allCopy))
    F('DASHBOARD', '"Cash-Flow Engine" names the appendix configuration — call it the live instrumentation / dashboard');
  /* Snapshot framing must accompany the dashboard */
  if (dashLinks.length && !/(fixed )?snapshot|keeps counting|has (since )?moved past|will have moved past/i.test(allCopy))
    F('DASHBOARD', 'dashboard linked without the mandatory snapshot framing (page = fixed 246-trade snapshot, dashboard = live and ahead of it)');

  /* The page converts to ONE action. The gold button may repeat (hero + CTA block),
     but every instance must be that same one action — the Discord invite. */
  const goldBtns = [...stripped.matchAll(/<a\b[^>]*class="[^"]*btn--gold[^"]*"[^>]*>/gi)];
  if (!goldBtns.length) F('CTA', 'no gold CTA button on the page');
  if (goldBtns.length > 2) W('CTA', `${goldBtns.length} gold CTA buttons — the gold ration is thinning`);
  const goldTargets = new Set();
  for (const b of goldBtns) {
    const href = (b[0].match(/href="([^"]*)"/) || [, ''])[1];
    goldTargets.add(href);
    if (href === '#' || href === '') F('CTA', 'gold CTA still points at a placeholder href — substitute the Discord invite');
    else if (!/discord\.gg/.test(href)) F('CTA', `the gold CTA must point at the Discord invite, found "${href}"`);
  }
  /* The CTA's exact wording is reserved for links that actually open Discord, so the
     phrase never means two different behaviours. */
  for (const a of stripped.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const label = a[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/watch the edge live in discord/i.test(label)) continue;
    const href = (a[1].match(/href="([^"]*)"/) || [, ''])[1];
    if (!/discord\.gg/.test(href))
      F('CTA', `"Watch the edge live in Discord" labels a link to "${href}" — that exact phrase is reserved for links that open Discord`);
  }

  if (goldTargets.size > 1) F('CTA', `gold CTAs point at ${goldTargets.size} different destinations — the page converts to ONE action: ${[...goldTargets].join(' , ')}`);

  /* ---------- 7c. Unverified denominators may not be published ------------- */
  /* A percentage return is only a fact if its denominator is a fact. The trade feed
     carries no equity field, so the balance cannot be derived — it must be supplied
     and verified by the operator. Until it is, the page cannot ship. */
  const figPath = join(root, '_build', 'figures.json');
  if (existsSync(figPath)) {
    const fig = JSON.parse(readFileSync(figPath, 'utf8'));
    const publishesPct = /data-fig="returnPct"/.test(htmlRaw);
    if (publishesPct) {
      const eq = fig.tradedEquity || {};
      if (!eq.verified)
        F('UNVERIFIED-CLAIM', `the page publishes a percentage return but tradedEquity.verified is false — ${eq.display || '?'} is a placeholder, not a measured balance. ${eq._conflict ? 'CONFLICT: ' + eq._conflict : ''}`);
      /* Risk-rule changes are themselves claims. The page publishes a Fidelity Gate
         promising every rule change is countersigned and disclosed before it runs. */
      const rc = fig.riskControls || {};
      if (/data-risk-controls/.test(htmlRaw)) {
        if (!rc.countersigned)
          F('UNVERIFIED-CLAIM', 'the page describes tightened risk rules but riskControls.countersigned is false — the page\'s own Fidelity Gate requires every rule change to be countersigned and disclosed before it runs');
        if (rc.brokerEnforced === null || rc.brokerEnforced === undefined)
          F('UNVERIFIED-CLAIM', 'riskControls.brokerEnforced is unknown — a broker-enforced cap is a mechanism, a self-imposed cap is a rule the operator must honour. The page must state whichever is true and imply no enforcement that does not exist');
      }
      if (!(fig.costModel || {}).verified)
        F('UNVERIFIED-CLAIM', 'the page publishes a net-of-costs percentage but costModel.verified is false — the round-turn cost is inferred, not confirmed');
      /* The stated balance and the stated per-trade ceiling must be mutually consistent. */
      if (!new RegExp(String(eq.usd || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')).test(allCopy))
        W('UNVERIFIED-CLAIM', 'the traded balance is not stated in the visible copy next to the percentage');
    }
  }

}

/* ====== PROFILE — experiment (Ekantik Ascent, the 10× Experiment) ====== */
/* Source of truth: the charter dated 2026-11-09 and the operator's answers of
   2026-11-11, recorded in figures.json → experiment. */
function experiment(ctx) {
  const { htmlRaw, stripped, text, allCopy, F, W, G } = ctx;
  const fig = JSON.parse(readFileSync(join(root, '_build', 'figures.json'), 'utf8'));
  const X = fig.experiment || {};
  const section = id => {
    const m = stripped.match(new RegExp(`<(section|footer)[^>]*id="${id}"[\\s\\S]*?</\\1>`, 'i'));
    return m ? m[0].replace(/<[^>]+>/g, ' ').replace(/&times;/g, '×').replace(/&middot;/g, '·')
      .replace(/&rsquo;/g, '’').replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/\s+/g, ' ') : '';
  };
  const body = stripped.replace(/<head[\s\S]*?<\/head>/i, '');

  /* ---------- 1. Forbidden content ---------------------------------------- */
  const FORBIDDEN_CONTENT = [
    [/\bEPIG\b/i, 'EPIG reference'],
    [/\bCAGR\b/i, 'CAGR'],
    [/only\s+\d+\s+(spots?|seats?|places?|left)/i, 'manufactured scarcity ("only N left")'],
    [/\bcountdown\b|\bacts? now\b|\bhurry\b|\bdon.t miss out\b/i, 'manufactured urgency'],
    [/\bpriority access\b|\breserve (your |a )?(seat|spot|allocation)\b|\bfirst access\b|\bearly access\b/i, 'allocation-priority promise'],
    [/revolutionary|unprecedented|game[- ]?chang|supercharge|unlock the|secret sauce|explosive/i, 'hype adjective'],
    /* 10× is the ceiling of a design under test, never an expected return. */
    [/\bwill (reach|hit|make|turn|grow|deliver|return)\b/i, 'a statement that the result WILL happen'],
    [/\bexpected return\b|\bon track to\b|\brisk[- ]free\b|\bcan(no|')t lose\b|\bsure thing\b|\bproven (edge|system|strategy)\b/i, 'outcome language the experiment cannot support'],
    /* "The target is a multiple, not a dollar figure." */
    [/take \$3,000 to|\$3,000 (to|→|into) \$30,000|\$3,?000\s*(-|–|→)\s*\$30,?000/i, 'the target stated as a dollar figure — the charter says it is a multiple'],
    /* The charter: one LIVE account. "Model portfolio" described the old page. */
    [/model portfolio/i, '"model portfolio" — the experiment is a live account; the earlier data is demo data'],
    /* The other page's engine. None of its figures or venues belong here. */
    [/62\.4\s?%|\$\s?1\.69\b|\b149\s+(live\s+)?trades|\$5\s?M\b|\$5,000,000|\b166\s+fit/i, 'a figure from the ES-futures record'],
    [/Interactive Brokers|Tradovate/i, 'a brokerage named — the charter names none'],
    [/Cash[- ]Flow Engine|Compounding Engine|Never Lose Money|Convexity/i, 'a label from the superseded protocol'],
    /* Superseded by the charter's rules. */
    [/earned[- ]doubling|six uncorrelated|weekly (loss )?cap|Expression Gate|Fidelity Gate/i, 'a rule from the superseded protocol — the charter has three kill criteria and one sizing rule'],
  ];
  for (const [re, why] of FORBIDDEN_CONTENT) {
    const m = allCopy.match(new RegExp(`.{0,60}(?:${re.source}).{0,60}`, 'i'));
    if (m) F('FORBIDDEN-CONTENT', `${why} → "…${m[0].trim()}…"`);
  }
  const wl = [...allCopy.matchAll(/waitlist/gi)];
  if (wl.length && !/no waitlist/i.test(allCopy)) F('FORBIDDEN-CONTENT', '"waitlist" appears without the negating "no waitlist"');
  if (wl.length > 1) W('CHECK', `"waitlist" appears ${wl.length}× — only the negating use is permitted`);

  /* $30,000 is what 10× of $3,000 is. It may be read off the scoreboard and the sizing
     strip; it may never be stated as the goal anywhere else. */
  for (const id of ['top', 'odds', 'why', 'kill', 'log', 'record', 'follow', 'not', 'disclosures'])
    if (/\$30,000/.test(section(id))) F('TARGET', `"$30,000" appears in #${id} — the target is a multiple; the dollar figure belongs only on the scoreboard and the sizing strip`);
  if (/\$30,000/.test((htmlRaw.match(/<head[\s\S]*?<\/head>/i) || [''])[0])) F('TARGET', '"$30,000" appears in the title or meta description');

  /* ---------- 2. The charter's statements --------------------------------- */
  const ch = X.challenge || {}, ac = X.account || {}, pr = X.protocol || {}, wi = X.witness || {};
  const REQUIRED = [
    [/one live account/i, 'the declaration: one live account'],
    [/founder.s own money/i, "the declaration: the founder's own money"],
    [/published before the first trade/i, 'rules published before the first trade'],
    [/The result is published in full, whatever it is/i, 'the declaration: the result is published in full'],
    [/is the design ceiling, not the expectation/i, 'honest odds: the design ceiling, not the expectation'],
    [/We consider reaching it unlikely/i, 'honest odds: "we consider reaching it unlikely"'],
    [/The only failed experiment is one where a rule is broken/i, 'honest odds: the only failed experiment'],
    [/No additions, no withdrawals/i, 'rule: no additions, no withdrawals'],
    [/1 December 2026/, 'rule: the start date'],
    [/30 November 2027/, 'rule: the end date'],
    [/One contract per \$3,000 of account equity/i, 'rule: position sizing'],
    [/Any amendment is published and countersigned before it takes effect/i, 'rule: rule changes'],
    [/the target is a multiple, not a dollar figure/i, 'the target is a multiple, not a dollar figure'],
    [/reported as a breach, not a result/i, 'kill criterion: rule breach'],
    [/Losses are posted the same way as wins/i, 'public log: losses posted the same way as wins'],
    [/A broker statement confirming the balance/i, 'public log: the monthly broker statement'],
    [/a financial publisher, not a registered investment adviser/i, 'what this is not: not advice'],
    [/No result is promised or implied/i, 'what this is not: not a promise'],
    [/holds only the founder.s own capital/i, 'what this is not: not outside money'],
    [/There is no backtest/i, 'what this is not: no backtest'],
    [/Demo results do not predict live results/i, 'what this is not: demo results do not predict live results'],
    [/rated Aggressive/i, 'what this is not: rated Aggressive'],
    [/can lose most or all of its value/i, 'what this is not: can lose most or all of its value'],
    [/sets no goal for any reader.s money/i, 'what this is not: not a personal target'],
    [/is not indicative of future results/i, 'the past-performance line'],
    [/Characteristics and Risks of Standardized Options/i, 'the options disclosure document'],
    [/whole premium paid can be lost/i, 'the options risk of total loss of premium'],
    [/before commissions and fees/i, 'the cost basis of the demo data'],
    [/not an audited or broker-reconciled statement/i, 'the status of the demo data'],
    [/no waitlist/i, 'the negated waitlist'],
    [/dated snapshot/i, 'the snapshot framing'],
  ];
  for (const [re, why] of REQUIRED) if (!re.test(allCopy)) F('MISSING-REQUIRED', why);

  /* The numbers the operator set on 2026-11-11 must be the ones on the page. */
  const rules = section('rules'), kill = section('kill');
  if (!new RegExp(`${pr.riskPerTradePct}% of the account`).test(rules)) F('RULES', `the rules do not state the ${pr.riskPerTradePct}% maximum risk per trade`);
  if ((rules.match(new RegExp(`${pr.openRiskPct}% of the account`, 'g')) || []).length < 2 && pr.riskPerTradePct === pr.openRiskPct)
    F('RULES', `the rules do not state both limits (${pr.riskPerTradePct}% per trade and ${pr.openRiskPct}% total open risk)`);
  if (!new RegExp(`\\$${pr.floorUsd.toLocaleString('en-US')}`).test(kill)) F('RULES', `the kill criteria do not state the $${pr.floorUsd} floor`);
  if (!new RegExp(`last ${pr.edgeWindowTrades} trades`).test(kill)) F('RULES', `the edge check does not state the last-${pr.edgeWindowTrades}-trades window`);
  if (!new RegExp(`in ${pr.posting}`).test(section('log'))) F('RULES', `the public log does not say trades are posted in ${pr.posting}`);

  const kc = (stripped.match(/<ol class="x6__kc"[\s\S]*?<\/ol>/) || [''])[0];
  const kcN = (kc.match(/<li>/g) || []).length;
  if (kcN !== 3) F('STRUCTURE', `the kill-criteria list has ${kcN} items — the charter names three (floor, rule breach, edge check)`);
  const oddsRows = ((stripped.match(/<table class="xtbl x3__tbl"[\s\S]*?<\/table>/) || [''])[0].match(/<tr>/g) || []).length - 1;
  if (oddsRows !== 3) F('STRUCTURE', `the honest-odds table has ${oddsRows} outcomes — the charter names three, and the floor must be one of them`);
  if ((body.match(/<dl class="x9__list"[\s\S]*?<\/dl>/) || [''])[0].split('<dt>').length - 1 !== 6)
    F('STRUCTURE', 'the "what this is not" list does not have the charter\'s six items');

  /* The odds are stated where the odds are discussed, and above the fold — not only in
     the small print. */
  for (const id of ['top', 'odds'])
    if (!/consider reaching it unlikely/i.test(section(id)))
      F('MISSING-REQUIRED', `"we consider reaching it unlikely" is missing from #${id}`);

  /* Status sentence above the fold and at the sign-up. */
  for (const id of ['top', 'follow'])
    if (!/no outside money is managed, and no investment is offered or solicited/i.test(section(id)))
      F('MISSING-REQUIRED', `the status sentence ("No outside money is managed…") is missing from #${id}`);

  /* Every trajectory block says, inside itself, what it is. */
  if (!/not a forecast/i.test(section('scoreboard'))) F('HYPOTHETICAL', 'the scoreboard shows a pace line without "not a forecast"');
  if (!/not a projection/i.test(rules)) F('HYPOTHETICAL', 'the sizing strip is not labelled "not a projection"');
  if (!/not a projection/i.test(section('why'))) F('HYPOTHETICAL', 'the payoff sketch is not labelled "not a projection"');
  if (!/Floor/.test(section('scoreboard'))) F('STRUCTURE', 'the scoreboard does not draw the floor');

  /* ---------- 3. Demo data is labelled demo everywhere it appears --------- */
  /* Charter launch gate, enforced here rather than left to a checklist. */
  const H = X.history || {};
  const rec = (stripped.match(/<section[^>]*id="record"[\s\S]*?<\/section>/i) || [''])[0];
  const tiles = [...rec.matchAll(/<dt class="xh__k">([\s\S]*?)<\/dt>/g)].map(m => m[1]);
  if (tiles.length !== 4) F('DEMO', `expected four demo tiles in the record section, found ${tiles.length}`);
  for (const t of tiles) if (!/^Demo\b/.test(t)) F('DEMO', `a record tile is not labelled demo: "${t.replace(/<[^>]+>/g, '').trim()}"`);
  const cap = (rec.match(/<figcaption class="xs xs-plot__cap"[^>]*>([\s\S]*?)<\/figcaption>/) || [, ''])[1];
  if (!/^Demo account/.test(cap)) F('DEMO', 'the cumulative plot\'s caption does not begin "Demo account"');
  if (!/Demo account/.test(section('record').slice(0, 400))) F('DEMO', 'the record section does not open by saying the data is from a demo account');
  if (!/class="badge x7__demo"/.test(rec)) F('DEMO', 'the demo badge above the tiles is missing');
  if (!/demo trades is not proof/i.test(section('record'))) F('DEMO', 'the sample caveat ("… demo trades is not proof") is missing');
  /* The demo figures may appear only in the record section and the disclosure that describes them. */
  for (const id of ['top', 'scoreboard', 'odds', 'why', 'rules', 'kill', 'log', 'follow', 'not'])
    if (new RegExp(`${String(H.winRatePct).replace('.', '\\.')}\\s?%|\\b${String(H.profitFactor).replace('.', '\\.')}\\b`).test(section(id)))
      F('DEMO', `a demo figure (${H.winRatePct}% or ${H.profitFactor}) appears in #${id}, outside the labelled demo section`);
  if (!new RegExp(`\\b${H.trades}\\b`).test(section('record'))) F('FIGURE-DRIFT', `the record section does not state ${H.trades} closed alerts (figures.json)`);
  if (!new RegExp(`${String(H.winRatePct).replace('.', '\\.')}\\s?%`).test(section('record'))) F('FIGURE-DRIFT', `the record section does not state the ${H.winRatePct}% win rate (figures.json)`);
  if ((H.overLimit || {}).count && !/were not sized under the experiment.s rules/i.test(section('record')))
    F('DEMO', `${H.overLimit.count} demo alerts exceed the per-trade limit, but the record section does not say the demo data was not sized under the rules`);
  if (/\[MISSING VALUE|MISSING CHART/.test(htmlRaw)) F('STRUCTURE', 'a build-time value or chart failed to resolve');

  /* Operator, 2026-11-10: no reference to the futures edge on this page for now. */
  if (/href="program\/|Structural Edge|ES futures|futures (record|edge|engine)|Commodity Trading Advisor|Series 3/i.test(body))
    F('SCOPE', 'the page refers to the futures edge or links to /program/ — removed at the operator\'s instruction');
  /* Operator, 2026-11-11: the on-page form is the sign-up; the Alpha portal is not mentioned. */
  if (/Alpha portal/i.test(allCopy)) F('SCOPE', 'the Alpha portal is mentioned — the operator chose the on-page form');

  /* ---------- 4. The dashboard reference ---------------------------------- */
  const dash = (X.dashboard || '').replace(/^https?:\/\//, '');
  const dashLinks = [...stripped.matchAll(new RegExp(`<a\\b[^>]*href="[^"]*${dash.replace(/[.]/g, '\\.')}"[^>]*>`, 'gi'))];
  if (dashLinks.length < 3) F('DASHBOARD', `the Ascent dashboard is linked ${dashLinks.length}× — it is the page's reference point (hero rail, scoreboard, record card, footer)`);
  for (const a of dashLinks) {
    if (/class="[^"]*\bbtn\b/.test(a[0])) F('DASHBOARD', `dashboard linked as a button — it must never compete with the sign-up: ${a[0].slice(0, 90)}`);
    if (!/rel="[^"]*noopener/.test(a[0])) F('DASHBOARD', `dashboard link missing rel="noopener": ${a[0].slice(0, 80)}`);
  }
  if (!/<aside class="x7__ref"/.test(stripped)) F('DASHBOARD', 'the reference card is missing from the record section');
  if (!/keeps counting/i.test(section('record'))) F('DASHBOARD', 'the reference card lacks the snapshot framing (page = dated snapshot, dashboard = live)');
  if (/accelerator\.ekantikcapital\.com\/experiment\.html/.test(stripped)) F('DASHBOARD', 'the ES-futures dashboard is linked from this page');

  /* ---------- 5. One action: sign up -------------------------------------- */
  /* The Discord invite is returned by the sign-up endpoint after the row is written.
     If it is anywhere in what the browser downloads, the gate is decorative. */
  const served = htmlRaw + readFileSync(join(root, 'signup.js'), 'utf8');
  if (/discord\.gg\/\w+|discord\.com\/invite\/\w+/i.test(served)) F('CTA', 'a Discord invite is written into the page or signup.js — it must come only from the sign-up endpoint');
  const goldLinks = [...stripped.matchAll(/<a\b[^>]*class="[^"]*btn--gold[^"]*"[^>]*>/gi)];
  for (const b of goldLinks) {
    const href = (b[0].match(/href="([^"]*)"/) || [, null])[1];
    if (href === null && /id="signup-open"/.test(b[0])) continue;      // filled in after a recorded sign-up
    if (href !== '#follow') F('CTA', `a gold button points at "${href}" — on this page gold means the sign-up, and only that`);
  }
  if (!goldLinks.some(b => /href="#follow"/.test(b[0]))) F('CTA', 'no gold "Follow the experiment" button points at #follow');

  const form = (stripped.match(/<form\b[^>]*data-signup[^>]*>[\s\S]*?<\/form>/i) || [''])[0];
  if (!form) F('SIGNUP', 'the sign-up form is missing');
  else {
    for (const [re, why] of [
      [/name="name"[^>]*required|required[^>]*name="name"/, 'a required name field'],
      [/type="email"[^>]*required|required[^>]*type="email"/, 'a required email field'],
      [/name="consent"[^>]*type="checkbox"[^>]*required|type="checkbox"[^>]*required/, 'a required consent checkbox'],
      [/name="website"/, 'the honeypot field'],
      [/type="submit"/, 'a submit button'],
    ]) if (!re.test(form)) F('SIGNUP', `the form lacks ${why}`);
    if (!/to be removed, email/i.test(form.replace(/<[^>]+>/g, ' '))) F('SIGNUP', 'the form has no privacy line saying how to be removed');
    if (!/<noscript>/i.test(htmlRaw)) F('SIGNUP', 'no <noscript> fallback for the form');
    if (!/id="signup-status"[^>]*aria-live/.test(stripped)) F('SIGNUP', 'the form status is not an aria-live region');
    const action = (form.match(/action="([^"]*)"/) || [, ''])[1];
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(action))
      G('SIGN-UP LIVE AND TESTED', `the form is not connected — action is "${action}". Deploy _build/signup-apps-script.gs and put the /exec URL in figures.json → experiment.signup.endpoint. Until then nobody's name is collected.`);
  }

  /* ---------- 6. The charter's launch gates ------------------------------- */
  /* "Nothing goes public until every box is ticked." */
  const d = H.defects || {};
  if (!ch.verified || !ac.verified || !pr.verified)
    G('SET ITEMS', 'a rule or date in figures.json → experiment is not verified by the operator');
  if (!(pr.sizingBelowStart || {}).verified)
    G('SET ITEMS', `position sizing below $${(pr.contractPerUsd * 2).toLocaleString('en-US')} — "one contract per $${pr.contractPerUsd.toLocaleString('en-US')}" read literally is zero contracts after the first loss. The page says one contract until equity reaches $${(pr.contractPerUsd * 2).toLocaleString('en-US')}. Confirm that reading.`);
  if (!wi.countersigned) {
    G('WITNESS', `${wi.name ? wi.name.split(' ')[0] : 'the witness'} has not countersigned the charter.`);
    if (!/countersignature of this charter is still pending/i.test(allCopy))
      F('UNVERIFIED-CLAIM', 'the charter is not countersigned, but the page does not say the countersignature is pending');
  } else if (/still pending/i.test(section('kill')))
    F('UNVERIFIED-CLAIM', 'figures.json says the charter is countersigned, but the page still says pending');
  G('ATTORNEY', 'the public wording has not been reviewed by an attorney — especially "10×", the sizing strip, and "financial publisher, not a registered investment adviser".');
  G('PUBLISH', `the charter must be published before the first trade on ${ch.startDate}. This page is that publication; it goes live only on the operator's go-ahead.`);
  if ((d.duplicated || []).length)
    G('JOURNAL', `the demo journal repeats ${d.duplicated.join(', ')}, so the dashboard shows ${H.dashboardCounts.trades} fills where this page states ${H.trades}. The page explains the difference; the fix is to remove the duplicate rows at source.`);
  if ((d.undated || []).length || (d.riskless || []).length)
    G('JOURNAL', `demo journal rows without a date (${(d.undated || []).join(', ') || 'none'}) or without a logged risk (${(d.riskless || []).join(', ') || 'none'}). From ${ch.startDate} an undated row cannot be placed on the live account's timeline and will be left off the scoreboard.`);
  if (!(X.dashboardBase || {}).aligned)
    W('DASHBOARD', `the dashboard is denominated $${X.dashboardBase.startUsd} → $${X.dashboardBase.targetUsd} and calls the record a model portfolio; the page says "demo" and explains the base beside the reference card.`);
}

const PROFILES = { program, experiment };

/* ---------- run --------------------------------------------------------- */
const only = (process.argv.find(a => a.startsWith('--page=')) || '').slice(7);
const PREVIEW = process.argv.includes('--preview');
const bar = '─'.repeat(72);
let failed = 0, gated = 0;
for (const page of PAGES) {
  if (only && page.name !== only) continue;
  const ctx = makeCtx(page);
  shared(ctx);
  PROFILES[page.profile](ctx);
  const { fails, warns, gates, text, htmlRaw, css } = ctx;
  console.log(bar);
  console.log(`[${page.name}] ${page.outHtml}`);
  if (fails.length) {
    console.log(`FAIL — ${fails.length} blocking issue${fails.length > 1 ? 's' : ''}`);
    fails.forEach(f => console.log('  ✗ ' + f));
    failed++;
  } else {
    console.log('PASS — 0 blocking issues');
  }
  if (gates.length) {
    console.log(`\nGATED — ${gates.length} input${gates.length > 1 ? 's' : ''} outstanding${PREVIEW ? ' (preview: reported, not enforced)' : ' — not publishable'}`);
    gates.forEach(g => console.log('  ◇ ' + g));
    gated++;
  }
  if (warns.length) {
    console.log(`\n${warns.length} warning${warns.length > 1 ? 's' : ''}`);
    warns.forEach(w => console.log('  ! ' + w));
  }
  console.log(`page copy: ${text.split(/\s+/).length} words · html ${(htmlRaw.length / 1024).toFixed(1)} kB · css ${(css.length / 1024).toFixed(1)} kB`);
}
console.log(bar);
process.exit(failed || (gated && !PREVIEW) ? 1 : 0);
