import { describe, expect, it } from 'vitest';
import { wrapText } from './shareText';

/** One unit per character, so widths are easy to reason about. */
const measure = (text: string): number => text.length;

describe('wrapText', () => {
  it('breaks at spaces within the width', () => {
    expect(wrapText('You planned six drawers this year.', 12, measure)).toEqual([
      'You planned',
      'six drawers',
      'this year.',
    ]);
  });

  it('keeps a short text on one line', () => {
    expect(wrapText('Your size: 2×1', 40, measure)).toEqual(['Your size: 2×1']);
  });

  it('breaks between characters in a script with no spaces', () => {
    expect(wrapText('切片软件至今记得它。', 4, measure)).toEqual(['切片软件', '至今记得', '它。']);
  });

  it('breaks a single word longer than the line', () => {
    expect(wrapText('Fackexperten', 5, measure)).toEqual(['Facke', 'xpert', 'en']);
  });
});
