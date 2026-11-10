/* The pages this repo builds. One entry per page: where its shell and section
   partials live, what it writes, and which lint profile gates it.
   Each page is a different ENGINE — no figure crosses from one to the other. */
import { charts as experimentCharts } from './chart.mjs';

const HOSTS = 'calendly\\.com|discord\\.(gg|com)|(?:10xedge|accelerator)\\.ekantikcapital\\.com';

export const PAGES = [
  {
    /* The public experiment: $3,000 → $30,000 in one year, in long options. */
    name: 'experiment', profile: 'experiment',
    shell: '_build/shell-experiment.html',
    sections: '_sections/experiment',
    outHtml: 'index.html', outCss: 'experiment.css',
    base: '',
    charts: experimentCharts,
    requiredIds: ['top', 'scoreboard', 'takes', 'why', 'rules', 'kill', 'record', 'follow', 'operator', 'disclosures'],
    allowHosts: new RegExp(`${HOSTS}|script\\.google\\.com`),
  },
  {
    /* The Structural Edge: the ES-futures record and the managed-program story. */
    name: 'program', profile: 'program',
    shell: '_build/shell-program.html',
    sections: '_sections/program',
    outHtml: 'program/index.html', outCss: 'program/sections.css',
    base: '../',
    requiredIds: ['top', 'proof', 'house', 'shape', 'ruin', 'tripwires', 'capacity', 'expressions', 'road', 'watch', 'disclosures'],
    allowHosts: new RegExp(HOSTS),
  },
];
export const pageByName = name => PAGES.find(p => p.name === name);
