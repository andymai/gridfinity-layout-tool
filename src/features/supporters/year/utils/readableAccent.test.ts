import { describe, expect, it } from 'vitest';
import { hexContrast } from '@/shared/utils/color';
import { CARD_BACKGROUND, readableAccent } from './readableAccent';

describe('readableAccent', () => {
  it('keeps an accent that already reads well', () => {
    expect(readableAccent('#f59e0b')).toBe('#f59e0b');
  });

  it('lightens a dark accent until small text passes AA', () => {
    const violet = readableAccent('#7c3aed');
    expect(violet).not.toBe('#7c3aed');
    expect(hexContrast(violet, CARD_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
  });
});
