import { describe, it, expect } from 'vitest';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin, Layer } from '@/core/types';
import type { BaseplateHeightParams } from '@/shared/printSettings/baseplateHeight';
import { createTestBin } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import { drawerCeilingFit, type LinkedDesignRise } from './drawerCeiling';
import { LIP_PROTRUSION_MM, STACK_JUNCTION_MM } from './heightUnits';

const PLAIN_PLATE: BaseplateHeightParams = { magnetHoles: false, magnetDepth: 2.4 };
const MAGNET_PLATE: BaseplateHeightParams = { magnetHoles: true, magnetDepth: 2.4 };

const LAYERS: Layer[] = [
  { id: layerId('l1'), name: 'Bottom', height: heightUnits(4) },
  { id: layerId('l2'), name: 'Top', height: heightUnits(4) },
];

function bin(overrides: Partial<Bin> = {}): Bin {
  return createTestBin({
    id: binId(`b${String(Math.random()).slice(2, 8)}`),
    layerId: layerId('l1'),
    ...overrides,
  });
}

function fit(bins: Bin[], ceilingMm: number | undefined, plate = PLAIN_PLATE) {
  return drawerCeilingFit({
    bins,
    layers: LAYERS,
    heightUnitMm: 7,
    plate,
    ceilingMm,
  });
}

describe('drawerCeilingFit', () => {
  it('returns null when the drawer is unmeasured', () => {
    expect(fit([bin()], undefined)).toBeNull();
  });

  it('returns null for a non-positive ceiling', () => {
    expect(fit([bin()], 0)).toBeNull();
    expect(fit([bin()], Number.NaN)).toBeNull();
  });

  it('counts the lip a single bin stands on top of its body', () => {
    const result = fit([bin({ height: heightUnits(6), layerId: layerId('l1') })], 100);
    expect(result?.tallestMm).toBeCloseTo(6 * 7 + LIP_PROTRUSION_MM, 5);
  });

  // The reported case: a drawer measured at 55mm floors to 7.85u, the inspector
  // offers 7.85u as the max, and the part prints 4.35mm proud of the drawer.
  it('flags the bin that exactly fills the unit budget as overflowing', () => {
    const result = fit([bin({ height: heightUnits(7.85), layerId: layerId('l1') })], 55);
    expect(result?.fits).toBe(false);
    expect(result?.slackMm).toBeCloseTo(-4.35, 5);
    expect(result?.overflowing).toHaveLength(1);
    expect(result?.overflowing[0]?.overflowMm).toBeCloseTo(4.35, 5);
  });

  it('nests a stacked bin into the one below rather than summing printed heights', () => {
    const bottom = bin({ id: binId('bottom'), height: heightUnits(4), layerId: layerId('l1') });
    const top = bin({ id: binId('top'), height: heightUnits(4), layerId: layerId('l2') });
    const result = fit([bottom, top], 200);

    // Two 4u bins: two pitches plus the junction the top one does not sink into.
    const pitch = 4 * 7 + LIP_PROTRUSION_MM - STACK_JUNCTION_MM;
    expect(result?.tallestMm).toBeCloseTo(2 * pitch + STACK_JUNCTION_MM, 5);
    // Strictly less than naive summing, by exactly one junction shortfall.
    expect(result?.tallestMm).toBeLessThan(2 * (4 * 7 + LIP_PROTRUSION_MM));
  });

  it('does not nest bins whose footprints miss each other', () => {
    const left = bin({ id: binId('left'), x: gridUnits(0), height: heightUnits(4) });
    const right = bin({
      id: binId('right'),
      x: gridUnits(5),
      height: heightUnits(4),
      layerId: layerId('l2'),
    });
    const result = fit([left, right], 200);
    // The upper bin stands alone on the drawer floor, so it is not lifted.
    expect(result?.tallestMm).toBeCloseTo(4 * 7 + LIP_PROTRUSION_MM, 5);
  });

  it('lifts every column by the plate floor, not the plate printed height', () => {
    const plain = fit([bin({ height: heightUnits(4) })], 200, PLAIN_PLATE);
    const magnet = fit([bin({ height: heightUnits(4) })], 200, MAGNET_PLATE);
    // A no-magnet plate contributes nothing: the socket sinks into its pockets.
    expect(magnet?.tallestMm ?? 0).toBeGreaterThan(plain?.tallestMm ?? 0);
    // The rise is the retaining floor under the pockets, never SOCKET_HEIGHT.
    expect((magnet?.tallestMm ?? 0) - (plain?.tallestMm ?? 0)).toBeLessThan(5);
  });

  it('counts declared clearance as height the contents occupy', () => {
    const bare = fit([bin({ height: heightUnits(4) })], 200);
    const withContents = fit(
      [bin({ height: heightUnits(4), clearanceHeight: heightUnits(2) })],
      200
    );
    expect((withContents?.tallestMm ?? 0) - (bare?.tallestMm ?? 0)).toBeCloseTo(14, 5);
  });

  it('ignores staged bins, which are not in the drawer', () => {
    const result = fit(
      [bin({ height: heightUnits(20), layerId: STAGING_ID }), bin({ height: heightUnits(2) })],
      200
    );
    expect(result?.tallestMm).toBeCloseTo(2 * 7 + LIP_PROTRUSION_MM, 5);
  });

  it('measures a linked design through its own rise, lid included', () => {
    const linkedBin = bin({ id: binId('linked'), height: heightUnits(4) });
    const linkedRise = (): LinkedDesignRise => ({ riseMm: 60, socketless: false });
    const result = drawerCeilingFit({
      bins: [linkedBin],
      layers: LAYERS,
      heightUnitMm: 7,
      plate: PLAIN_PLATE,
      ceilingMm: 55,
      linkedRise,
    });
    expect(result?.tallestMm).toBeCloseTo(60, 5);
    expect(result?.fits).toBe(false);
  });

  // A flat or tray base has no foot to drop into the pockets, so it rests on
  // the plate's TOP FACE — the full printed height, not the drawer floor. On
  // the default plate that is a 5mm difference, larger than the 4.3mm lip
  // overshoot this whole check exists to catch.
  it('stands a socketless linked design on the plate top, not the drawer floor', () => {
    const linkedBin = bin({ id: binId('flat'), height: heightUnits(4) });
    const linkedRise = (): LinkedDesignRise => ({ riseMm: 50, socketless: true });
    const result = drawerCeilingFit({
      bins: [linkedBin],
      layers: LAYERS,
      heightUnitMm: 7,
      plate: PLAIN_PLATE,
      ceilingMm: 54,
      linkedRise,
    });
    // Plain plate: SOCKET_HEIGHT (5mm) tall, floor depth 0.
    expect(result?.tallestMm).toBeCloseTo(55, 5);
    expect(result?.fits).toBe(false);
  });

  // The junction credit needs the SUPPORTER's lip: a bin stacked on a lipless
  // design rests on its flat top with nothing to settle into.
  it('does not nest a bin stacked on a lipless linked design', () => {
    const bottom = bin({ id: binId('bottom'), height: heightUnits(4), layerId: layerId('l1') });
    const top = bin({ id: binId('top'), height: heightUnits(4), layerId: layerId('l2') });
    const linkedRise = (b: Bin): LinkedDesignRise | undefined =>
      b.id === bottom.id ? { riseMm: 28, socketless: false, hasLip: false } : undefined;
    const result = drawerCeilingFit({
      bins: [bottom, top],
      layers: LAYERS,
      heightUnitMm: 7,
      plate: PLAIN_PLATE,
      ceilingMm: 200,
      linkedRise,
    });
    expect(result?.tallestMm).toBeCloseTo(28 + 4 * 7 + LIP_PROTRUSION_MM, 5);
  });

  it('still nests on a linked design that keeps its lip', () => {
    const bottom = bin({ id: binId('bottom'), height: heightUnits(4), layerId: layerId('l1') });
    const top = bin({ id: binId('top'), height: heightUnits(4), layerId: layerId('l2') });
    const linkedRise = (b: Bin): LinkedDesignRise | undefined =>
      b.id === bottom.id ? { riseMm: 28, socketless: false, hasLip: true } : undefined;
    const result = drawerCeilingFit({
      bins: [bottom, top],
      layers: LAYERS,
      heightUnitMm: 7,
      plate: PLAIN_PLATE,
      ceilingMm: 200,
      linkedRise,
    });
    expect(result?.tallestMm).toBeCloseTo(28 - STACK_JUNCTION_MM + 4 * 7 + LIP_PROTRUSION_MM, 5);
  });

  it('sorts overflowing bins tallest first', () => {
    const short = bin({ id: binId('short'), height: heightUnits(8), x: gridUnits(0) });
    const tall = bin({ id: binId('tall'), height: heightUnits(9), x: gridUnits(4) });
    const result = fit([short, tall], 55);
    expect(result?.overflowing.map((b) => b.binId)).toEqual([binId('tall'), binId('short')]);
  });

  it('treats a sub-epsilon overshoot as a fit', () => {
    const height = (55 - LIP_PROTRUSION_MM) / 7 + 0.004 / 7;
    const result = fit([bin({ height: heightUnits(height) })], 55);
    expect(result?.fits).toBe(true);
  });

  // Layers are a planning abstraction: a printed bin falls until something stops
  // it. A layer-3 bin with an empty layer 2 beneath it rests on the layer-1 bin,
  // not at layer 3's nominal z.
  it('rests a bin on what is physically under it, not on its layer z', () => {
    const bottom = bin({ id: binId('bottom'), height: heightUnits(4), layerId: layerId('l1') });
    const top = bin({ id: binId('top'), height: heightUnits(4), layerId: layerId('l3') });
    const result = drawerCeilingFit({
      bins: [bottom, top],
      layers: [...LAYERS, { id: layerId('l3'), name: 'Third', height: heightUnits(4) }],
      heightUnitMm: 7,
      plate: PLAIN_PLATE,
      ceilingMm: 200,
    });

    const pitch = 4 * 7 + LIP_PROTRUSION_MM - STACK_JUNCTION_MM;
    expect(result?.tallestMm).toBeCloseTo(2 * pitch + STACK_JUNCTION_MM, 5);
    // Strictly below the three-layer nominal z, which is the point.
    expect(result?.tallestMm).toBeLessThan(3 * 4 * 7);
  });

  it('takes the tallest supporter when a bin spans two below it', () => {
    const short = bin({ id: binId('short'), x: gridUnits(0), height: heightUnits(2) });
    const tall = bin({ id: binId('tall'), x: gridUnits(1), height: heightUnits(5) });
    const over = bin({
      id: binId('over'),
      x: gridUnits(0),
      width: gridUnits(2),
      height: heightUnits(2),
      layerId: layerId('l2'),
    });
    const result = fit([short, tall, over], 200);
    const tallTop = 5 * 7 + LIP_PROTRUSION_MM;
    expect(result?.tallestMm).toBeCloseTo(
      tallTop - STACK_JUNCTION_MM + (2 * 7 + LIP_PROTRUSION_MM),
      5
    );
  });
});
