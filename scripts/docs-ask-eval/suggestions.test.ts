import { describe, expect, it } from 'vitest';
import { suggestionCases } from './suggestions';

describe('suggestionCases', () => {
  it('asks each starter question on its own page', () => {
    const cases = suggestionCases([
      { file: 'apps/docs/index.md', data: { questions: ['A?', 'B?'] }, body: '' },
      { file: 'apps/docs/designer/lids.md', data: { questions: ['C?', 7] }, body: '' },
      { file: 'apps/docs/reference/glossary.md', data: {}, body: '' },
    ]);
    expect(cases.map((c) => [c.id, c.page, c.turns])).toEqual([
      ['/index#1', '/index', ['A?']],
      ['/index#2', '/index', ['B?']],
      ['/designer/lids#1', '/designer/lids', ['C?']],
    ]);
  });
});
