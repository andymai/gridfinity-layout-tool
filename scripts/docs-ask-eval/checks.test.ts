import { describe, expect, it } from 'vitest';
import { planLayoutInput, runPlanLayout } from '../../api/lib/agent/index.js';
import type { PlanView } from '../../api/lib/agent/index.js';
import type { AskCorpus } from '../../api/lib/docsAsk/corpus.js';
import { DISCUSSIONS_URL } from '../../api/lib/docsAsk/prompt.js';
import { checkAnswer, checkPlans, docsPage } from './checks';
import type { OpenDrawer } from './checks';
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

describe('bare docs URLs', () => {
  it('checks a bare URL like a link, and counts an inline link once', () => {
    const english = { 'binDesigner.lid': 'Lid' };
    const answer = [
      'See https://gridfinitylayouttool.com/docs/designer/nothing.',
      '[Turn on a lid](https://gridfinitylayouttool.com/docs/designer/lids#turn-on-a-lid)',
    ].join('\n');
    const checks = checkAnswer(answer, corpus, english, english);
    expect(checks.brokenLinks).toEqual(['https://gridfinitylayouttool.com/docs/designer/nothing']);
    expect(checks.citedPages).toEqual(['/designer/lids']);
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

  it('names the drawer that each drawer case must end with', () => {
    for (const c of GOLDEN.filter((g) => g.group === 'drawer')) {
      expect(c.openDrawer, c.id).toBeDefined();
    }
  });
});

describe('checkPlans', () => {
  const origin = { origin: 'https://gridfinitylayouttool.com' };
  const drawerPlan = (input: unknown): PlanView => {
    const { plan } = runPlanLayout(planLayoutInput.parse(input), origin);
    if (plan === null) throw new Error('no plan');
    return plan;
  };
  const half = drawerPlan({
    drawer: { width: 48, depth: 36, height: 9, unit: 'cm' },
    halfGrid: true,
    bins: [],
  });
  const whole = drawerPlan({ drawer: { width: 48, depth: 36, height: 9, unit: 'cm' }, bins: [] });
  const expected: OpenDrawer = {
    mm: [480, 360, 90],
    grids: [
      [11, 8],
      [11, 8.5],
    ],
  };
  const ending = (plan: PlanView, text = 'An 11 x 8.5 grid fits with Half-grid mode.'): string =>
    `${text}\n\n[[plan:${plan.handle}]]`;

  it('passes an answer that ends with the drawer at the grid it names', () => {
    expect(checkPlans(ending(half), [half], expected)).toEqual([]);
    expect(checkPlans(ending(half, 'Ein Raster von 11 × 8,5 passt.'), [half], expected)).toEqual(
      []
    );
    expect(checkPlans(ending(whole, 'An 11 x 8 grid fits.'), [whole], expected)).toEqual([]);
  });

  it('flags a plan that the chat did not make, or a grid that the answer does not name', () => {
    expect(checkPlans(ending(half), [], expected)).toContain(
      `[[plan:${half.handle}]] is not a plan from plan_layout`
    );
    expect(checkPlans(ending(whole, 'An 11 x 8.5 grid fits.'), [whole], expected)).toEqual([
      'the answer does not name the 11 x 8 grid of its plan',
    ]);
  });

  it('flags a link that opens another layout than its map', () => {
    const tampered: PlanView = { ...half, link: whole.link };
    expect(checkPlans(ending(tampered), [tampered], expected)).toContain(
      `the link of [[plan:${half.handle}]] opens another layout than its map shows`
    );
  });

  it('flags a link whose bins differ from the map, even at the same grid and count', () => {
    const shelf = { grid: { width: 3, depth: 2 } };
    const wide = drawerPlan({ ...shelf, bins: [{ label: 'M3', width: 2, depth: 1, height: 3 }] });
    const small = drawerPlan({ ...shelf, bins: [{ label: 'M3', width: 1, depth: 1, height: 3 }] });
    const swapped: PlanView = { ...wide, link: small.link };
    expect(checkPlans(`A 3 x 2 grid.\n\n[[plan:${wide.handle}]]`, [swapped])).toEqual([
      `the link of [[plan:${wide.handle}]] opens another layout than its map shows`,
    ]);
  });

  it('flags a drawer of another size, with bins, or at a grid that does not fit', () => {
    const noHeight = drawerPlan({ drawer: { width: 48, depth: 36, unit: 'cm' }, bins: [] });
    expect(checkPlans(ending(noHeight, '11 x 8'), [noHeight], expected)).toEqual([
      "the plan's drawer is 480 x 360 mm, not 480 x 360 x 90",
    ]);
    const withBins = drawerPlan({
      drawer: { width: 48, depth: 36, height: 9, unit: 'cm' },
      bins: [{ label: 'M3', width: 1, depth: 1, height: 3 }],
    });
    expect(checkPlans(ending(withBins, '11 x 8'), [withBins], expected)).toEqual([
      'the plan has 1 bins, not none',
    ]);
    expect(
      checkPlans(ending(whole, '11 x 8'), [whole], { ...expected, grids: [[11, 8.5]] })
    ).toEqual(['the plan opens 11 x 8, not 11 x 8.5']);
  });

  it('wants the plan last, once, and no other link into the app', () => {
    expect(checkPlans(`${ending(half)}\n\nChange it in the app.`, [half], expected)).toEqual([
      'does not end with the plan',
    ]);
    expect(checkPlans('An 11 x 8.5 grid fits.', [half], expected)).toEqual([
      'shows 0 plans, not 1',
      'does not end with the plan',
    ]);
    expect(
      checkPlans(
        ending(half, 'An 11 x 8.5 grid: https://gridfinitylayouttool.com/?drawer=480x360x90'),
        [half],
        expected
      )
    ).toEqual(['writes a link to the app: https://gridfinitylayouttool.com/?drawer=480x360x90']);
    expect(
      checkPlans(
        ending(half, 'See [the docs](https://gridfinitylayouttool.com/docs/layouts/drawer-setup).'),
        [half],
        { ...expected, grids: [[11, 8.5]] }
      )
    ).toEqual(['the answer does not name the 11 x 8.5 grid of its plan']);
  });

  it('wants no plan and no link into the app for a drawer that nothing fits', () => {
    expect(checkPlans('No grid fits a 38 mm drawer.', [], null)).toEqual([]);
    expect(checkPlans(ending(half), [half], null)).toEqual([
      'shows a plan for a drawer with no fit',
    ]);
    expect(
      checkPlans('No grid fits. Try https://gridfinitylayouttool.com/?drawer=38x38', [], null)
    ).toEqual(['writes a link to the app: https://gridfinitylayouttool.com/?drawer=38x38']);
  });
});
