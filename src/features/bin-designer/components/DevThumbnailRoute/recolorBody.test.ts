import { describe, it, expect } from 'vitest';
import { recolorBody } from './recolorBody';
import { coloredFeatures, PALETTE } from '@/features/bin-designer/data/examples/palette';

const TEAL = '#2ea3a3';

describe('recolorBody', () => {
  it('repaints the body', () => {
    const params = { featureColors: coloredFeatures({ scoop: PALETTE.coral }) };

    expect(recolorBody(params, TEAL).featureColors?.body).toBe(TEAL);
  });

  it('carries defaulted zones along with the body', () => {
    // coloredFeatures defaults every unspecified zone to the body color, so
    // these would otherwise keep the old grey while the shell turns teal.
    const params = { featureColors: coloredFeatures({ scoop: PALETTE.coral }) };

    const result = recolorBody(params, TEAL).featureColors;

    expect(result?.base).toBe(TEAL);
    expect(result?.dividers).toBe(TEAL);
    expect(result?.text).toBe(TEAL);
    expect(result?.lid).toBe(TEAL);
  });

  it('leaves zones that carry a real accent alone', () => {
    const params = {
      featureColors: coloredFeatures({
        labelTab: PALETTE.amber,
        scoop: PALETTE.coral,
        lip: PALETTE.amber,
      }),
    };

    const result = recolorBody(params, TEAL).featureColors;

    expect(result?.labelTab).toBe(PALETTE.amber);
    expect(result?.scoop).toBe(PALETTE.coral);
  });

  it('recolors lip cells that defaulted to the body but not accented ones', () => {
    const defaulted = recolorBody({ featureColors: coloredFeatures() }, TEAL);
    expect(Object.values(defaulted.featureColors?.lip.cells ?? {})).toContain(TEAL);

    const accented = recolorBody({ featureColors: coloredFeatures({ lip: PALETTE.amber }) }, TEAL);
    expect(Object.values(accented.featureColors?.lip.cells ?? {})).not.toContain(TEAL);
  });

  it('preserves non-color params', () => {
    const params = { width: 3, depth: 2, featureColors: coloredFeatures() };

    const result = recolorBody(params, TEAL);

    expect(result.width).toBe(3);
    expect(result.depth).toBe(2);
  });

  it('passes params through untouched when the example has no featureColors', () => {
    const params = { width: 3 };

    expect(recolorBody(params, TEAL)).toBe(params);
  });
});
