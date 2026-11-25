import { describe, expect, it } from 'vitest';
import type { AskCorpus, AskLabels } from './corpus.js';
import { createToolRunner, toolDefinitions } from './tools.js';

const corpus: AskCorpus = {
  version: 'test',
  map: 'map',
  pages: {
    '/baseplates/splitting': {
      group: 'Baseplates',
      title: 'Split for your print bed',
      url: 'https://gridfinitylayouttool.com/docs/baseplates/splitting',
      markdown:
        '# Split for your print bed {#split}\n\nClick [[ui:Split plate]].\n\n## Lock the pieces {#lock-the-pieces}\n\nConnector keys hold the pieces.',
      labels: ['baseplate.split'],
    },
  },
};
const english: AskLabels = { 'baseplate.split': 'Split plate' };
const german: AskLabels = { 'baseplate.split': 'Platte teilen' };
const run = createToolRunner(
  corpus,
  (locale) => (locale === 'de' ? german : english),
  english,
  'https://gridfinitylayouttool.com'
);

describe('toolDefinitions', () => {
  it('lets read_page take only the links in the corpus', () => {
    const [readPage] = toolDefinitions(corpus);
    expect(readPage).toMatchObject({
      name: 'read_page',
      input_schema: { properties: { link: { enum: ['/baseplates/splitting'] } } },
    });
  });
});

describe('read_page', () => {
  it('returns the page and its step label', () => {
    const result = run('read_page', { link: '/baseplates/splitting' }, 'en');
    expect(result).toMatchObject({
      isError: false,
      label: 'Reading Baseplates › Split for your print bed',
      link: '/baseplates/splitting',
    });
    expect(result.content).toBe(corpus.pages['/baseplates/splitting']?.markdown);
  });

  it('adds the labels in the reader language after the page', () => {
    expect(run('read_page', { link: '/baseplates/splitting' }, 'de').content).toContain(
      'Labels on this page, German | English:\n- Platte teilen | Split plate'
    );
  });

  it('refuses a link that the corpus does not have', () => {
    expect(run('read_page', { link: '/nope' }, 'en').isError).toBe(true);
    expect(run('read_page', { path: '/baseplates/splitting' }, 'en').isError).toBe(true);
  });
});

describe('search_docs', () => {
  it('lists the matching sections with their URL and anchor', () => {
    const result = run('search_docs', { query: 'connector keys' }, 'en');
    expect(result.label).toBe('Searching for “connector keys”');
    expect(result.content).toContain(
      '1. Split for your print bed › Lock the pieces (/baseplates/splitting, https://gridfinitylayouttool.com/docs/baseplates/splitting#lock-the-pieces)'
    );
  });

  it('says so when nothing matches', () => {
    expect(run('search_docs', { query: 'zebra' }, 'en').content).toBe('No section matches.');
  });
});

describe('drawer_fit', () => {
  it('reports the grids, the stacks and the link', () => {
    const result = run('drawer_fit', { widthMm: 400, depthMm: 300, heightMm: 80 }, 'en');
    expect(result.label).toBe('Checking a 400 × 300 × 80 mm drawer');
    expect(result.content).toBe(
      [
        'Drawer: 400 x 300 x 80 mm.',
        'Whole-unit grid: 9 x 7 units (378 x 294 mm), spare room 22 mm in width and 6 mm in depth.',
        'Half-unit grid: 9.5 x 7 units (399 x 294 mm), spare room 1 mm in width and 6 mm in depth. It needs Half-grid mode.',
        'Tallest bins under 80 mm with the default baseplate: one bin: 10 units (74.4 mm); stacks of 2: 5 units each (74.1 mm in all); stacks of 3: 3 units each (66.7 mm in all).',
        'Plan this drawer in the app: https://gridfinitylayouttool.com/?drawer=400x300x80',
      ].join('\n')
    );
  });

  it('converts inches', () => {
    expect(run('drawer_fit', { widthMm: 10, depthMm: 10, unit: 'in' }, 'en').content).toContain(
      'Drawer: 254 x 254 mm.'
    );
  });

  it('refuses a drawer the app cannot plan', () => {
    const result = run('drawer_fit', { widthMm: 20, depthMm: 300 }, 'en');
    expect(result.isError).toBe(true);
    expect(result.content).toContain('from 42 mm to 2100 mm');
  });

  it('refuses a height that the app does not take, rather than claim nothing fits', () => {
    const result = run('drawer_fit', { widthMm: 400, depthMm: 300, heightMm: 5001 }, 'en');
    expect(result.isError).toBe(true);
    expect(result.content).toContain('from 1 mm to 5000 mm');
  });

  it('refuses input that is not numbers', () => {
    expect(run('drawer_fit', { widthMm: '400', depthMm: 300 }, 'en').isError).toBe(true);
  });
});

it('refuses an unknown tool', () => {
  expect(run('delete_everything', {}, 'en').isError).toBe(true);
});
