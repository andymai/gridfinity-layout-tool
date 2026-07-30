import { describe, it, expect } from 'vitest';
import { formatOffset, minPrintableLabelFontMm, JBM_DIGIT_STEM_PER_FONT } from './couponHelpers';
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';

/** Thinnest JetBrains Mono digit stem (mm) at the label size for `nozzle`. */
const stemAt = (nozzle: number | undefined): number =>
  minPrintableLabelFontMm(nozzle) * JBM_DIGIT_STEM_PER_FONT;

describe('minPrintableLabelFontMm', () => {
  // The bug (#3019): a raised stroke thinner than one nozzle bead is culled by
  // the slicer, so the fit-sample labels sliced away to nothing. Every supported
  // nozzle must produce a label whose thinnest stem is at least one bead wide.
  it.each([0.4, 0.6, 0.8, 1.0])('keeps the digit stem ≥ one bead at nozzle %smm', (nozzle) => {
    expect(stemAt(nozzle)).toBeGreaterThanOrEqual(nozzle);
  });

  it('grows the label with the nozzle', () => {
    expect(minPrintableLabelFontMm(0.6)).toBeGreaterThan(minPrintableLabelFontMm(0.4));
    expect(minPrintableLabelFontMm(0.8)).toBeGreaterThan(minPrintableLabelFontMm(0.6));
  });

  it('falls back to the 0.4mm baseline for a missing or invalid nozzle', () => {
    const baseline = minPrintableLabelFontMm(NOZZLE_BASELINE);
    const invalid: readonly (number | undefined)[] = [undefined, NaN, 0, -0.4, Infinity];
    for (const bad of invalid) {
      expect(minPrintableLabelFontMm(bad)).toBe(baseline);
    }
  });

  it('honors a legibility floor for sub-baseline nozzles', () => {
    // A tiny nozzle can print a thin stem, but the label must stay readable, so
    // the font never drops below the legibility floor.
    const font = minPrintableLabelFontMm(0.2);
    expect(font).toBeGreaterThanOrEqual(3.5);
    // At the floor the stem still clears the (small) 0.2mm bead comfortably.
    expect(font * JBM_DIGIT_STEM_PER_FONT).toBeGreaterThan(0.2);
  });
});

describe('formatOffset', () => {
  it('signs positive offsets and leaves zero unsigned', () => {
    expect(formatOffset(0.05)).toBe('+0.05');
    expect(formatOffset(0.1)).toBe('+0.10');
    expect(formatOffset(-0.1)).toBe('-0.10');
    expect(formatOffset(0)).toBe('0.00');
  });
});
