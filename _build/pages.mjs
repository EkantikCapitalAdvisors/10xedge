/* The pages this repository builds. Each page is one engine with one attribution:
   nothing in one page's sections, CSS or figures is shared with another's.
   Paths are relative to the repository root. */
export const PAGES = [
  {
    name: 'program',
    profile: 'program',
    shell: '_build/shell-program.html',
    sections: '_sections/program',
    outHtml: 'index.html',
    outCss: 'sections.css',
    requiredIds: ['top', 'proof', 'house', 'shape', 'ruin', 'tripwires', 'capacity', 'expressions', 'road', 'watch', 'disclosures'],
    allowHosts: /calendly\.com|discord\.(gg|com)|(?:10xedge|accelerator)\.ekantikcapital\.com/,
  },
];

export const pageByName = name => PAGES.find(p => p.name === name);
