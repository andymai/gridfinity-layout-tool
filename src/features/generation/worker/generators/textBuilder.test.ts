import { describe, it, expect, beforeAll } from 'vitest';
import {
  fitFontSize,
  measureInkExtents,
  resolveEffectiveFont,
  clearTextMetricsMemo,
} from './textBuilder';
import type { InkExtents } from './textBuilder';
import { loadFont, textMetrics } from 'brepjs';
import { isErr, isOk } from '@/core/result';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads the bundled Atkinson TTF once for the whole test file so we can
 * exercise the real `textMetrics` path. Vitest's jsdom env has no `fetch`
 * for `?url` assets, so we read the file off disk.
 */
beforeAll(async () => {
  const ttfPath = resolve(__dirname, '../assets/fonts/AtkinsonHyperlegible-Regular.ttf');
  const buffer = readFileSync(ttfPath);
  const result = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'atkinson'
  );
  if (isErr(result)) throw new Error(`Test setup failed: ${result.error.message}`);
});

describe('fitFontSize', () => {
  it('returns a size within the requested range', () => {
    const fit = fitFontSize('M4', 'atkinson', 30, 10, 3, 20);
    expect(fit.fits).toBe(true);
    expect(fit.fontSize).toBeGreaterThanOrEqual(3);
    expect(fit.fontSize).toBeLessThanOrEqual(20);
  });

  it('reports fits:false when even the minimum overflows the width', () => {
    const fit = fitFontSize('VERY_LONG_LABEL_TEXT', 'atkinson', 5, 50, 3, 20);
    expect(fit.fits).toBe(false);
  });

  it('reports fits:false when the minimum overflows the depth', () => {
    const fit = fitFontSize('A', 'atkinson', 100, 0.5, 3, 20);
    expect(fit.fits).toBe(false);
  });

  it('returns fits:false for empty text', () => {
    const fit = fitFontSize('', 'atkinson', 100, 100, 3, 20);
    expect(fit.fits).toBe(false);
  });

  it('returns fits:false for non-positive area', () => {
    expect(fitFontSize('A', 'atkinson', 0, 10, 3, 20).fits).toBe(false);
    expect(fitFontSize('A', 'atkinson', 10, -1, 3, 20).fits).toBe(false);
  });

  it('returns fits:false when min > max', () => {
    expect(fitFontSize('A', 'atkinson', 100, 100, 20, 3).fits).toBe(false);
  });

  it('scales monotonically — bigger area yields ≥ font size', () => {
    const small = fitFontSize('LABEL', 'atkinson', 20, 8, 3, 20);
    const big = fitFontSize('LABEL', 'atkinson', 60, 24, 3, 20);
    expect(big.fontSize).toBeGreaterThanOrEqual(small.fontSize);
  });

  it('returns fits:false for an unknown font family', () => {
    // @ts-expect-error — testing runtime guard with an unsupported family
    const fit = fitFontSize('A', 'comic-sans', 100, 100, 3, 20);
    expect(fit.fits).toBe(false);
  });

  it('chooses a near-maximal size: the rendered bbox fits and is bound by an axis', () => {
    // The linear solver should land on the largest size that still fits, so the
    // rendered bbox stays within budget and (when not clamped) touches a bound.
    const availW = 30;
    const availD = 10;
    const fit = fitFontSize('SCREWS', 'atkinson', availW, availD, 3, 20);
    expect(fit.fits).toBe(true);
    const m = textMetrics('SCREWS', { fontSize: fit.fontSize, fontFamily: 'atkinson' });
    expect(isOk(m)).toBe(true);
    if (isOk(m)) {
      expect(m.value.width).toBeLessThanOrEqual(availW + 1e-6);
      expect(m.value.height).toBeLessThanOrEqual(availD + 1e-6);
      // Not clamped to either bound → the limiting axis must sit right at budget.
      if (fit.fontSize > 3 && fit.fontSize < 20) {
        const touchesW = Math.abs(m.value.width - availW) < 0.05;
        const touchesH = Math.abs(m.value.height - availD) < 0.05;
        expect(touchesW || touchesH).toBe(true);
      }
    }
  });

  it('is deterministic and unaffected by clearing the metrics memo', () => {
    const before = fitFontSize('BOLTS', 'atkinson', 30, 10, 3, 20);
    clearTextMetricsMemo();
    const after = fitFontSize('BOLTS', 'atkinson', 30, 10, 3, 20);
    expect(after.fits).toBe(before.fits);
    expect(after.fontSize).toBeCloseTo(before.fontSize, 6);
  });
});

describe('inkBox vertical fit', () => {
  const PLATE_BAND_MM = 7.8;

  function inkOf(text: string, fontSize: number): InkExtents {
    const ink = measureInkExtents(text, fontSize, 'atkinson');
    if (!ink) throw new Error(`no ink extents for "${text}" at size ${fontSize}`);
    return ink;
  }

  it('measures the glyphs drawn, not the font-wide ascender..descender band', () => {
    // textMetrics().height is a font constant — identical for an all-caps run
    // and one full of descenders. The ink box has to distinguish them.
    const caps = inkOf('KABEL', 10);
    const descenders = inkOf('gjpqy', 10);

    const lineBox = textMetrics('KABEL', { fontSize: 10, fontFamily: 'atkinson' });
    expect(isOk(lineBox)).toBe(true);
    if (!isOk(lineBox)) return;

    expect(caps.minY).toBeCloseTo(0, 2);
    expect(caps.maxY - caps.minY).toBeLessThan(lineBox.value.height);
    expect(descenders.minY).toBeLessThan(0);
    expect(descenders.maxY - descenders.minY).toBeGreaterThan(caps.maxY - caps.minY);
  });

  it('fills the band an all-caps run only half-used under lineBox', () => {
    // Width deliberately generous, so the fit is purely the band the line box
    // reserved for ascenders/descenders "KABEL" never draws.
    const lineFit = fitFontSize('KABEL', 'atkinson', 100, PLATE_BAND_MM, 3, 20);
    const inkFit = fitFontSize('KABEL', 'atkinson', 100, PLATE_BAND_MM, 3, 20, 'inkBox');
    expect(lineFit.fits).toBe(true);
    expect(inkFit.fits).toBe(true);
    expect(inkFit.fontSize).toBeGreaterThan(lineFit.fontSize * 1.5);

    const ink = inkOf('KABEL', inkFit.fontSize);
    expect(ink.maxY - ink.minY).toBeCloseTo(PLATE_BAND_MM, 2);
  });

  it('still lets width bind at real plate proportions', () => {
    // A 1U plate's 32.8mm text run is the narrower budget for a 5-glyph
    // string, so the ink fit grows the glyphs without overflowing sideways.
    const inkFit = fitFontSize('KABEL', 'atkinson', 32.8, PLATE_BAND_MM, 3, 20, 'inkBox');
    const lineFit = fitFontSize('KABEL', 'atkinson', 32.8, PLATE_BAND_MM, 3, 20);
    expect(inkFit.fontSize).toBeGreaterThan(lineFit.fontSize * 1.5);
    const width = textMetrics('KABEL', { fontSize: inkFit.fontSize, fontFamily: 'atkinson' });
    expect(isOk(width)).toBe(true);
    if (isOk(width)) expect(width.value.width).toBeLessThanOrEqual(32.8 + 1e-6);
  });

  it('never overflows the band it was given', () => {
    for (const text of ['KABEL', 'gjpqy', 'M4 x 12', 'Ø8']) {
      const fit = fitFontSize(text, 'atkinson', 32.8, PLATE_BAND_MM, 3, 20, 'inkBox');
      if (!fit.fits) continue;
      const ink = inkOf(text, fit.fontSize);
      expect(ink.maxY - ink.minY).toBeLessThanOrEqual(PLATE_BAND_MM + 1e-6);
    }
  });

  it('returns null extents for an unloaded font', () => {
    expect(measureInkExtents('A', 10, 'not-a-font' as 'atkinson')).toBeNull();
  });
});

describe('resolveEffectiveFont', () => {
  // The swap is the printability guarantee for through-cut: glyphs with
  // closed counters (O, A, D…) lose their inner islands when cut all the
  // way through, so the renderer forces a stencil font regardless of the
  // user's pick. Lock the behavior in directly here so a regression can
  // never silently slip past the scenario tests.
  it('returns the requested font for engrave and emboss', () => {
    expect(resolveEffectiveFont('atkinson', 'engrave')).toBe('atkinson');
    expect(resolveEffectiveFont('jetbrains-mono', 'engrave')).toBe('jetbrains-mono');
    expect(resolveEffectiveFont('allerta-stencil', 'engrave')).toBe('allerta-stencil');
    expect(resolveEffectiveFont('atkinson', 'emboss')).toBe('atkinson');
    expect(resolveEffectiveFont('jetbrains-mono', 'emboss')).toBe('jetbrains-mono');
    expect(resolveEffectiveFont('allerta-stencil', 'emboss')).toBe('allerta-stencil');
  });

  it('forces allerta-stencil for through-cut regardless of the requested font', () => {
    expect(resolveEffectiveFont('atkinson', 'through-cut')).toBe('allerta-stencil');
    expect(resolveEffectiveFont('jetbrains-mono', 'through-cut')).toBe('allerta-stencil');
    expect(resolveEffectiveFont('allerta-stencil', 'through-cut')).toBe('allerta-stencil');
  });
});
