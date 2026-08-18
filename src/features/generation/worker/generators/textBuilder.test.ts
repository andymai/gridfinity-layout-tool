import { describe, it, expect, beforeAll } from 'vitest';
import {
  clearTextMetricsMemo,
  fitTextSize,
  getTypeMeasurer,
  planTextForHost,
  resolveEffectiveFont,
} from './textBuilder';
import { loadFont } from 'brepjs';
import { isErr } from '@/core/result';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/shared/types/bin';
import type { TextStyleDefaults } from '@/shared/types/bin';

/**
 * Loads the bundled Atkinson TTF once for the whole file so the real metrics
 * path is exercised. Vitest's env has no `fetch` for `?url` assets, so the file
 * is read off disk.
 *
 * Placement itself is covered in `@/shared/utils/typePlan.test.ts`, which owns
 * the layout. What is left here is the worker-side surface: the stencil swap,
 * the guards that keep a missing font from producing geometry, and the memo
 * whose staleness would silently measure against the wrong face.
 */
beforeAll(async () => {
  const ttfPath = resolve(
    __dirname,
    '../../../../shared/fonts/assets/AtkinsonHyperlegible-Regular.ttf'
  );
  const buffer = readFileSync(ttfPath);
  const result = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'atkinson'
  );
  if (isErr(result)) throw new Error(`Test setup failed: ${result.error.message}`);
  clearTextMetricsMemo();
});

const STYLE: TextStyleDefaults = { ...DEFAULT_TEXT_STYLE_DEFAULTS };
const HOST = { availW: 30, availD: 10 };

describe('resolveEffectiveFont', () => {
  it('swaps to the stencil for through-cut whatever the pick', () => {
    expect(resolveEffectiveFont('atkinson', 'through-cut')).toBe('allerta-stencil');
    expect(resolveEffectiveFont('poppins', 'through-cut')).toBe('allerta-stencil');
  });

  it('honours the pick for engrave and emboss', () => {
    expect(resolveEffectiveFont('atkinson', 'engrave')).toBe('atkinson');
    expect(resolveEffectiveFont('poppins', 'emboss')).toBe('poppins');
  });
});

describe('planTextForHost', () => {
  it('plans a caption that fits', () => {
    const plan = planTextForHost({ text: 'M4', style: STYLE, ...HOST });
    expect(plan).not.toBeNull();
    expect(plan?.lines[0].text).toBe('M4');
  });

  it('returns null for empty or whitespace-only text', () => {
    expect(planTextForHost({ text: '', style: STYLE, ...HOST })).toBeNull();
    expect(planTextForHost({ text: '   ', style: STYLE, ...HOST })).toBeNull();
  });

  it('returns null when the family is not loaded rather than planning against nothing', () => {
    // Only Atkinson is loaded here. A plan built from missing metrics would
    // report a size and a position that no geometry could honour.
    const plan = planTextForHost({
      text: 'M4',
      style: { ...STYLE, font: 'barlow-condensed' },
      ...HOST,
    });
    expect(plan).toBeNull();
  });

  it('returns null when the legibility floor exceeds the host', () => {
    expect(
      planTextForHost({ text: 'M4', style: { ...STYLE, minFontSize: 8 }, availW: 2, availD: 10 })
    ).toBeNull();
  });
});

describe('fitTextSize', () => {
  it('reports the size the build would pick', () => {
    const size = fitTextSize({ text: 'M4', style: STYLE, ...HOST });
    const plan = planTextForHost({ text: 'M4', style: STYLE, ...HOST });
    expect(size).toBe(plan?.fontSize);
  });

  it('reports null for a caption that will not fit, which is what marks it as overflowing', () => {
    expect(
      fitTextSize({ text: 'M4', style: { ...STYLE, minFontSize: 8 }, availW: 2, availD: 10 })
    ).toBeNull();
  });
});

describe('clearTextMetricsMemo', () => {
  it('hands out a fresh measurer, so a font reload cannot be measured against the old face', () => {
    const before = getTypeMeasurer();
    clearTextMetricsMemo();
    expect(getTypeMeasurer()).not.toBe(before);
  });
});
