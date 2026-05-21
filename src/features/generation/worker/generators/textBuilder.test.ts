import { describe, it, expect, beforeAll } from 'vitest';
import { fitFontSize } from './textBuilder';
import { loadFont } from 'brepjs';
import { isErr } from '@/core/result';
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
});
