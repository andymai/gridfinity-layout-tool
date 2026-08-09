import { describe, expect, it } from 'vitest';
import { composeSerpTitle, estimateTitlePx, SERP_TITLE_MAX_PX } from './serpTitle';

const SITE_NAME = 'Gridfinity Layout Tool';

describe('estimateTitlePx', () => {
  it('measures the generator title against its hand-computed Arial width', () => {
    // 27678 Arial advance units at 20px. Recomputing this by hand is the only
    // way to catch a corrupted entry in ADVANCE_GROUPS, since every other
    // assertion here is relative.
    expect(
      estimateTitlePx('Gridfinity Generator — Free Online Bin & Baseplate Generator')
    ).toBeCloseTo(553.56, 1);
  });

  it('separates glyph widths rather than counting characters', () => {
    expect(estimateTitlePx('lllll')).toBeLessThan(estimateTitlePx('WWWWW'));
  });

  it('counts CJK glyphs as full-width', () => {
    // Five Hangul syllables are one em each, so ~5x a 222-unit 'l'.
    expect(estimateTitlePx('그리드피니')).toBeCloseTo(100, 1);
    expect(estimateTitlePx('网格无限生成器')).toBeCloseTo(140, 1);
  });

  it('is zero for the empty string', () => {
    expect(estimateTitlePx('')).toBe(0);
  });
});

describe('composeSerpTitle', () => {
  it('drops the brand suffix when it would push the title past the budget', () => {
    const title = 'Gridfinity Generator — Free Online Bin & Baseplate Generator';
    expect(composeSerpTitle(title, SITE_NAME)).toBe(title);
  });

  it('keeps the brand suffix on a title short enough to carry it', () => {
    expect(composeSerpTitle('What is Gridfinity?', SITE_NAME)).toBe(
      `What is Gridfinity? | ${SITE_NAME}`
    );
  });

  it('never returns a title wider than the budget unless the title alone exceeds it', () => {
    const short = composeSerpTitle('Gridfinity Sizes', SITE_NAME);
    expect(estimateTitlePx(short)).toBeLessThanOrEqual(SERP_TITLE_MAX_PX);
  });

  it('returns an over-budget title untouched rather than truncating it', () => {
    // Composing is the only lever here; trimming the unique title is the
    // author's call, surfaced by the build warning.
    const tooLong = 'G'.repeat(60);
    expect(composeSerpTitle(tooLong, SITE_NAME)).toBe(tooLong);
    expect(estimateTitlePx(tooLong)).toBeGreaterThan(SERP_TITLE_MAX_PX);
  });
});
