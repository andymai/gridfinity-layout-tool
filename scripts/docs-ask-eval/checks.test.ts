import { describe, expect, it } from 'vitest';
import type { AskCorpus } from '../../api/lib/docsAsk/corpus.js';
import { DISCUSSIONS_URL } from '../../api/lib/docsAsk/prompt.js';
import { checkAnswer, docsPage } from './checks';
import { GOLDEN } from './golden';

const corpus: AskCorpus = {
  version: 'test',
  map: '',
  pages: {
    '/designer/lids': {
      group: 'Designing bins',
      title: 'Lids',
      url: 'https://gridfinitylayouttool.com/docs/designer/lids',
      markdown: '# Lids {#lids}\n\n## Turn on a lid {#turn-on-a-lid}\n\n[[capture:designer-lid]]',
      labels: ['Lid'],
    },
    '/index': {
      group: 'Introduction',
      title: 'What the Layout Tool does',
      url: 'https://gridfinitylayouttool.com/docs',
      markdown: '# What the Layout Tool does {#what}',
      labels: [],
    },
  },
};

describe('docsPage', () => {
  it('reads the page and anchor of a docs link, and skips other sites', () => {
    expect(docsPage('https://gridfinitylayouttool.com/docs/designer/lids#turn-on-a-lid')).toEqual({
      page: '/designer/lids',
      anchor: 'turn-on-a-lid',
    });
    expect(docsPage('/docs/designer/lids.md')).toEqual({ page: '/designer/lids', anchor: null });
    expect(docsPage('https://gridfinitylayouttool.com/docs')).toEqual({
      page: '/index',
      anchor: null,
    });
    expect(docsPage('https://github.com/andymai/gridfinity-layout-tool')).toBeNull();
    expect(docsPage('https://gridfinitylayouttool.com.example.com/docs/designer/lids')).toBeNull();
  });
});

describe('checkAnswer', () => {
  const english = { 'binDesigner.lid': 'Lid' };
  const german = { 'binDesigner.lid': 'Deckel' };

  it('passes real links, labels and captures', () => {
    const answer =
      'Turn on [[ui:Deckel]] (Lid). See [Turn on a lid](https://gridfinitylayouttool.com/docs/designer/lids#turn-on-a-lid).\n\n[[capture:designer-lid]]';
    expect(checkAnswer(answer, corpus, german, english)).toEqual({
      brokenLinks: [],
      citedPages: ['/designer/lids'],
      unknownLabels: [],
      unknownCaptures: [],
      linksForum: false,
    });
  });

  it('flags a missing anchor, a missing page, an invented label and capture', () => {
    const answer = [
      '[x](https://gridfinitylayouttool.com/docs/designer/lids#no-such-heading)',
      '[y](https://gridfinitylayouttool.com/docs/designer/nothing)',
      '[[ui:Magic button]]',
      '[[capture:made-up]]',
      `Ask in the forum: ${DISCUSSIONS_URL}`,
    ].join('\n');
    const checks = checkAnswer(answer, corpus, english, english);
    expect(checks.brokenLinks).toHaveLength(2);
    expect(checks.citedPages).toEqual([]);
    expect(checks.unknownLabels).toEqual(['Magic button']);
    expect(checks.unknownCaptures).toEqual(['made-up']);
    expect(checks.linksForum).toBe(true);
  });
});

describe('the golden set', () => {
  it('has unique ids, a question in every case, and two turns for a follow-up', () => {
    expect(new Set(GOLDEN.map((c) => c.id)).size).toBe(GOLDEN.length);
    for (const c of GOLDEN) {
      expect(c.turns.length).toBe(c.group === 'followup' ? 2 : 1);
      expect(c.page.startsWith('/')).toBe(true);
      for (const source of c.sources) expect(source.startsWith('/')).toBe(true);
    }
  });
});
