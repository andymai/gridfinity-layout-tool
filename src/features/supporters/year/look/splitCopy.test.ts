import { describe, expect, it } from 'vitest';
import { sentences, splitAroundValue, splitAtLabel } from './splitCopy';

describe('sentences', () => {
  it('splits sentences and keeps decimals and quotes whole', () => {
    expect(sentences('148 things now have a home. Most of them.', 'en')).toEqual([
      '148 things now have a home.',
      'Most of them.',
    ]);
    expect(sentences('“Knife Block”. Worth the wait.', 'en')).toHaveLength(2);
    expect(sentences('About 1.5 kg of filament', 'en')).toEqual(['About 1.5 kg of filament']);
  });

  it('splits Japanese at its full stops', () => {
    expect(sentences('三角形 8,010 個。スライサーはまだ覚えています。', 'ja')).toEqual([
      '三角形 8,010 個。',
      'スライサーはまだ覚えています。',
    ]);
  });
});

describe('splitAtLabel', () => {
  it('takes the label up to the colon before the value', () => {
    expect(splitAtLabel('Longest print: 27 hr 20 min', '27 hr 20 min')).toEqual({
      label: 'Longest print:',
      rest: '27 hr 20 min',
    });
    expect(splitAtLabel('Most complicated: “Grid”', 'Grid')).toEqual({
      label: 'Most complicated:',
      rest: '“Grid”',
    });
  });

  it('reads a full-width colon and a spaced one', () => {
    expect(splitAtLabel('いちばん複雑：「Grid」', 'Grid')?.label).toBe('いちばん複雑：');
    expect(splitAtLabel('Votre taille : 1×1', '1×1')).toEqual({
      label: 'Votre taille :',
      rest: '1×1',
    });
  });

  it('leaves a string without a colon whole', () => {
    expect(splitAtLabel('Grid is the most complicated', 'Grid')).toBeNull();
    expect(splitAtLabel('Size 1×1', '1×1')).toBeNull();
  });
});

describe('splitAroundValue', () => {
  it('keeps the full stop with a leading value', () => {
    expect(splitAroundValue('966 × 798 mm. “Workbench”', '966 × 798 mm')).toEqual({
      before: '',
      value: '966 × 798 mm.',
      after: '“Workbench”',
    });
  });

  it('keeps the words before a value that comes last', () => {
    expect(splitAroundValue('“Werkbank”, 966 × 798 mm.', '966 × 798 mm')).toEqual({
      before: '“Werkbank”,',
      value: '966 × 798 mm.',
      after: '',
    });
    expect(
      splitAroundValue('{size}。「作業台」'.replace('{size}', '9 × 7 mm'), '9 × 7 mm')?.value
    ).toBe('9 × 7 mm。');
  });

  it('returns null when the value is not there', () => {
    expect(splitAroundValue('Workbench', '966 mm')).toBeNull();
  });
});
