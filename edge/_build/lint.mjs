#!/usr/bin/env node
/* Deterministic compliance + design-system linter for the Structural Edge page.
   Runs against the BUILT edge/index.html. Exit code 1 on any FAIL.
   This is a floor, not a ceiling — the human/agent compliance critic still gates every sentence. */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlRaw = readFileSync(join(root, 'index.html'), 'utf8');
const css = existsSync(join(root, 'sections.css'))
  ? readFileSync(join(root, 'sections.css'), 'utf8') + readFileSync(join(root, 'styles.css'), 'utf8')
  : readFileSync(join(root, 'styles.css'), 'utf8');

const fails = [];
const warns = [];
const F = (rule, detail) => fails.push(`${rule}: ${detail}`);
const W = (rule, detail) => warns.push(`${rule}: ${detail}`);

/* Visible text only: strip comments, script, style, svg <title>/<desc> kept, tags. */
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
  [/246 trades is six months of one kind of market\s*[—-]\s*promising, not yet proven/i, 'the sample caveat, verbatim'],
  [/58\.9\s?%/, '58.9% exact win rate'],
  [/\$1\.49/, '$1.49 profit factor'],
  [/\b246\b/, '246 live trades'],
  [/computed, not promised/i, '"computed, not promised"'],
  [/1 in 200,000/i, '< 1 in 200,000 ruin figure'],
  [/1\.4\s*[–-]\s*1\.7/, 'Sharpe ~1.4–1.7'],
  [/\$3\s?M|\$3,000,000/i, '$3M capacity'],
  [/\$5\s?M|\$5,000,000/i, '~$5M ceiling'],
  [/\$20,000/, '$20,000 minimum'],
  [/no per[- ]account limit/i, 'no per-account limit'],
  [/150 fit/i, 'the 150-vs-1 line'],
  [/one allocation could close the door on everyone/i, '"One allocation could close the door on everyone"'],
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
if (/\b59\.0\s?%|\b60\s?%\s*of trades/i.test(allCopy)) F('FIGURE-DRIFT', 'win rate rounded beyond 58.9%');
if (/\$1\.50 (collected|per)/i.test(allCopy)) F('FIGURE-DRIFT', 'profit factor rounded to $1.50');
if (/\b250\+? (live )?trades|\b246\+/i.test(allCopy)) F('FIGURE-DRIFT', 'trade count inflated beyond 246');
if (/sharpe[^.]{0,24}~?1\.5\b/i.test(allCopy) && !/1\.4\s*[–-]\s*1\.7/.test(allCopy))
  F('FIGURE-DRIFT', 'Sharpe stated as ~1.5 without the 1.4–1.7 range');
/* 59% headline requires the 58.9% exact subline */
if (/\b59\s?%/.test(allCopy) && !/58\.9\s?%\s*exactly/i.test(allCopy))
  F('FIGURE-DRIFT', '"59%" headline used without the "58.9% exactly" subline');

/* ---------- 5. Section 08 must contain zero digits ----------------------- */
const s8 = stripped.match(/<section[^>]*id="expressions"[\s\S]*?<\/section>/i);
if (!s8) F('STRUCTURE', 'section #expressions not found');
else {
  const t8 = s8[0].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
  const digits = t8.match(/\d/g);
  if (digits) F('SECTION-08', `"One Edge, Many Expressions" must contain zero digits — found: ${[...new Set(digits)].join('')} in "${t8.replace(/\s+/g,' ').trim().slice(0,160)}"`);
}

/* ---------- 6. Structure / a11y ----------------------------------------- */
const h1 = [...htmlRaw.matchAll(/<h1[\s>]/gi)].length;
if (h1 !== 1) F('A11Y', `expected exactly 1 <h1>, found ${h1}`);

const REQUIRED_IDS = ['top', 'proof', 'house', 'shape', 'ruin', 'tripwires', 'capacity', 'expressions', 'road', 'watch', 'disclosures'];
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

const secCss = existsSync(join(root, 'sections.css')) ? readFileSync(join(root, 'sections.css'), 'utf8') : '';
if (/^\s*:root\s*\{/m.test(secCss)) F('DESIGN-SYSTEM', 'a section CSS file declares :root — tokens live in styles.css only');

/* Fonts: no font-family outside the three brand families */
for (const m of cssCode.matchAll(/font-family:\s*([^;}]+)/gi)) {
  const v = m[1];
  if (!/Cormorant Garamond|DM Sans|JetBrains Mono|inherit|var\(/.test(v))
    F('DESIGN-SYSTEM', `non-brand font-family: ${v.trim().slice(0, 70)}`);
}

/* Inline styles limited to the reveal delay */
for (const m of stripped.matchAll(/\sstyle="([^"]*)"/gi)) {
  if (!/^--d:\s*\d+ms;?$/.test(m[1].trim())) W('DESIGN-SYSTEM', `inline style beyond --d: ${m[1].slice(0, 60)}`);
}

/* No external network requests */
for (const m of stripped.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/gi)) {
  if (!/calendly\.com|discord\.(gg|com)|(?:10xedge|accelerator)\.ekantikcapital\.com/.test(m[1]))
    F('PERF', `external request to ${m[1]} — the page must be fully self-contained`);
}
/* Outbound links must be navigations, never fetched assets.
   rel=canonical/preconnect/dns-prefetch declare metadata, they load nothing. */
for (const m of stripped.matchAll(/<(?:script|link|img|iframe)\b[^>]*(?:src|href)="https?:\/\/[^"]+"[^>]*>/gi)) {
  if (/rel="(canonical|preconnect|dns-prefetch|alternate)"/i.test(m[0])) continue;
  F('PERF', `embedded external asset: ${m[0].slice(0, 90)}`);
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
if (goldTargets.size > 1) F('CTA', `gold CTAs point at ${goldTargets.size} different destinations — the page converts to ONE action: ${[...goldTargets].join(' , ')}`);

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

/* ---------- report ------------------------------------------------------ */
const bar = '─'.repeat(72);
console.log(bar);
if (fails.length) {
  console.log(`FAIL — ${fails.length} blocking issue${fails.length > 1 ? 's' : ''}`);
  fails.forEach(f => console.log('  ✗ ' + f));
} else {
  console.log('PASS — 0 blocking issues');
}
if (warns.length) {
  console.log(`\n${warns.length} warning${warns.length > 1 ? 's' : ''}`);
  warns.forEach(w => console.log('  ! ' + w));
}
console.log(bar);
console.log(`page copy: ${text.split(/\s+/).length} words · html ${(htmlRaw.length / 1024).toFixed(1)} kB · css ${(css.length / 1024).toFixed(1)} kB`);
process.exit(fails.length ? 1 : 0);
