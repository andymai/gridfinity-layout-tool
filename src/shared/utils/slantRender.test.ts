import { describe, it, expect } from 'vitest';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { gridUnits, heightUnits, mm } from '@/core/types';
import type { SlantConfig } from '@/core/types';
import { slantRenderFields } from './slantRender';

const layout = createTestLayout({ gridUnitMm: mm(42), gridUnitMmY: mm(21) });
const bin = (slant?: SlantConfig) =>
  createTestBin({ width: gridUnits(2), height: heightUnits(6), ...(slant ? { slant } : {}) });

describe('slantRenderFields', () => {
  it('leaves an upright bin alone', () => {
    expect(slantRenderFields(bin(), layout)).toEqual({});
  });

  it('shears along X by the slope, from the top of the socket', () => {
    const { shear } = slantRenderFields(bin({ angleDeg: 45, side: 'left' }), layout);
    expect(shear?.x).toBeCloseTo(-1, 6);
    expect(shear?.y).toBe(0);
    expect(shear?.pivot).toBeCloseTo(4.75 / 42, 6);
  });

  it('gives a shift along Y in Y grid units, which the scene stretches back', () => {
    const { shear } = slantRenderFields(bin({ angleDeg: 45, side: 'back' }), layout);
    expect(shear?.y).toBeCloseTo(2, 6);
  });

  it('places the support on its cells with the reach in grid units along the lean', () => {
    const { slantSupport } = slantRenderFields(
      bin({ angleDeg: 45, side: 'right', endSupport: true }),
      layout
    );
    expect(slantSupport).toMatchObject({ side: 'right', x: 2, y: 0, width: 1, depth: 1 });
    expect(slantSupport?.reach).toBeCloseTo(37.25 / 42, 6);
    expect(slantSupport?.top).toBeCloseTo(1, 6);
  });
});
