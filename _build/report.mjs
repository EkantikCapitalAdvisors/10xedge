#!/usr/bin/env node
/* Appends one round of critic findings to docs/COMPARISON-REPORT.md.
   Usage: node report.mjs <round-json-file> */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(repo, 'docs', 'COMPARISON-REPORT.md');
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));

const sev = { BLOCKER: 0, MAJOR: 1, MINOR: 2 };
const findings = (data.findings || []).slice().sort((a, b) => sev[a.severity] - sev[b.severity]);
const count = s => findings.filter(f => f.severity === s).length;

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();

let md = `\n## Round ${data.round}\n\n`;
md += `**Result:** ${data.ship ? '✅ ALL CRITICS SHIP' : '❌ KEEP GOING'} — `;
md += `${count('BLOCKER')} blocker · ${count('MAJOR')} major · ${count('MINOR')} minor\n\n`;

md += `### Verdicts\n\n| Critic | Verdict | Summary |\n|---|---|---|\n`;
for (const v of data.verdicts || []) {
  md += `| ${esc(v.critic)} | ${v.verdict === 'SHIP' ? '**PASS**' : '**FAIL**'} | ${esc(v.summary)} |\n`;
}

if (findings.length) {
  md += `\n### Deficiency list\n\n| Sev | Section | Dim | Defect | Fix |\n|---|---|---|---|---|\n`;
  for (const f of findings) {
    md += `| ${f.severity} | \`${esc(f.section)}\` | ${esc(f.dimension)} | ${esc(f.defect)} | ${esc(f.fix)} |\n`;
  }
}

const header = `# Side-by-side comparison report — THE EKANTIK STRUCTURAL EDGE

Reference standard: stripe.com / linear.app, encoded as the D1–D10 rubric in
\`_build/../docs/CRITIC-RUBRIC.md\`. Every round runs one global design critic, five per-section design
critics, a CEG compliance critic and a direct-response (control-standard) editor. A round PASSES only
when every critic returns SHIP.

> **Limitation, stated plainly:** live screenshots of stripe.com and linear.app could not be captured in
> the build environment — the headless browser cannot traverse the agent proxy (CONNECT is reset), while
> curl can. The design critics therefore judged the build against the written D1–D10 rubric rather than
> against freshly-captured reference screenshots. The rubric encodes the specific behaviours of those
> pages, and critics were instructed to resolve any doubt against the build.
`;

const prev = existsSync(out) ? readFileSync(out, 'utf8') : header;
writeFileSync(out, (prev.startsWith('#') ? prev : header) + md);
console.log(`round ${data.round} appended → docs/COMPARISON-REPORT.md (${count('BLOCKER')}B/${count('MAJOR')}M/${count('MINOR')}m)`);
