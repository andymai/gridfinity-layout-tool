import { afterEach, describe, expect, it } from 'vitest';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import type { Bin, SlantConfig } from '@/core/types';
import { binId, designId, gridUnits, heightUnits, layerId } from '@/core/types';
import {
  placedSlant,
  registerLinkedSlantResolver,
  slantConflicts,
  slantZone,
  type LinkedSlantFacts,
} from './placedSlant';

const L1 = layerId('layer1');
const L2 = layerId('layer2');
const BACK_45: SlantConfig = { angleDeg: 45, side: 'back', endSupport: true };

const layout = createTestLayout({
  drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(20) },
  layers: [
    { id: L1, name: 'Layer 1', height: heightUnits(3) },
    { id: L2, name: 'Layer 2', height: heightUnits(3) },
  ],
});

function bin(overrides: Partial<Bin>): Bin {
  return createTestBin({ width: gridUnits(2), height: heightUnits(12), ...overrides });
}

function withFacts(facts: Record<string, LinkedSlantFacts>): void {
  registerLinkedSlantResolver((id) => facts[id]);
}

afterEach(() => {
  registerLinkedSlantResolver(null);
});

describe('placedSlant', () => {
  it('is null for an upright bin', () => {
    expect(placedSlant(bin({}), layout)).toBeNull();
  });

  it('puts the end support on the cells the top leans over', () => {
    const slant = placedSlant(bin({ x: gridUnits(1), y: gridUnits(2), slant: BACK_45 }), layout);
    expect(slant?.plan.side).toBe('back');
    expect(slant?.support).toEqual({ x: 1, y: 3, width: 2, depth: 2 });
  });

  it('reaches toward each side', () => {
    const at = { x: gridUnits(4), y: gridUnits(4), height: heightUnits(6) };
    const support = (side: SlantConfig['side']) =>
      placedSlant(bin({ ...at, slant: { ...BACK_45, side } }), layout)?.support;
    expect(support('back')).toEqual({ x: 4, y: 5, width: 2, depth: 1 });
    expect(support('front')).toEqual({ x: 4, y: 3, width: 2, depth: 1 });
    expect(support('right')).toEqual({ x: 6, y: 4, width: 1, depth: 1 });
    expect(support('left')).toEqual({ x: 3, y: 4, width: 1, depth: 1 });
  });

  it('has no support cells without an end support', () => {
    const { endSupport: _, ...noSupport } = BACK_45;
    const slant = placedSlant(bin({ slant: noSupport }), layout);
    expect(slant).not.toBeNull();
    expect(slant?.support).toBeNull();
  });

  it('starts a half-unit bin on the half cell its leading edge lands on', () => {
    const slant = placedSlant(
      bin({ depth: gridUnits(1.5), height: heightUnits(6), slant: BACK_45 }),
      layout
    );
    expect(slant?.support).toEqual({ x: 0, y: 1.5, width: 2, depth: 1.5 });
  });

  it("takes a linked design's slant, and lets the placed one replace it", () => {
    withFacts({ d1: { config: { angleDeg: 30, side: 'left' } } });
    const linked = bin({ linkedDesignId: designId('d1') });
    expect(placedSlant(linked, layout)?.plan.side).toBe('left');
    expect(placedSlant({ ...linked, slant: BACK_45 }, layout)?.plan.side).toBe('back');
  });

  it('keeps a bin upright when its design blocks a slant', () => {
    withFacts({ d1: { blocked: true } });
    expect(placedSlant(bin({ linkedDesignId: designId('d1'), slant: BACK_45 }), layout)).toBeNull();
  });

  it('keeps a bin with its own overhang upright, as the export does', () => {
    const overhang = { left: 5, right: 0, front: 0, back: 0 };
    expect(placedSlant(bin({ slant: BACK_45, overhang }), layout)).toBeNull();
  });

  it("sizes the support from the design's base and extra wall", () => {
    const short = { height: heightUnits(6), linkedDesignId: designId('d1'), slant: BACK_45 };
    withFacts({ d1: {} });
    expect(placedSlant(bin(short), layout)?.support?.depth).toBe(1);
    withFacts({ d1: { flatBase: true } });
    expect(placedSlant(bin(short), layout)?.support?.depth).toBe(2);
    withFacts({ d1: { extraWallMm: 5 } });
    expect(placedSlant(bin(short), layout)?.support?.depth).toBe(2);
  });
  // A 2x1 design in a 1x2 footprint stands turned a quarter counterclockwise.
  it("turns a linked design's slant with a turned placement", () => {
    withFacts({ d1: { width: 2, depth: 1, config: BACK_45 } });
    const turned = bin({
      x: gridUnits(4),
      y: gridUnits(4),
      width: gridUnits(1),
      depth: gridUnits(2),
      height: heightUnits(6),
      linkedDesignId: designId('d1'),
    });
    const slant = placedSlant(turned, layout);
    expect(slant?.plan.side).toBe('left');
    expect(slant?.support).toEqual({ x: 3, y: 4, width: 1, depth: 2 });
  });

  it("sizes a linked support from the design's height, not the placement's", () => {
    withFacts({ d1: { height: 12 } });
    const short = { height: heightUnits(6), linkedDesignId: designId('d1'), slant: BACK_45 };
    expect(placedSlant(bin(short), layout)?.support?.depth).toBe(2);
  });
  it("sizes a linked support in the design's own units", () => {
    withFacts({ d1: { heightUnitMm: 10 } });
    const linked = { height: heightUnits(6), linkedDesignId: designId('d1'), slant: BACK_45 };
    expect(placedSlant(bin(linked), layout)?.support?.depth).toBe(2);
  });
});

describe('slantZone', () => {
  it('is the footprint alone for an upright bin', () => {
    const upright = bin({});
    expect(slantZone(upright, layout)).toEqual({ slanted: false, rects: [upright] });
  });

  it('adds the support cells to a slanted bin', () => {
    const zone = slantZone(bin({ slant: BACK_45 }), layout);
    expect(zone.slanted).toBe(true);
    expect(zone.rects).toHaveLength(2);
  });
});

describe('slantConflicts', () => {
  const slanted = bin({ id: binId('s'), x: gridUnits(0), y: gridUnits(0), slant: BACK_45 });

  function conflicts(candidate: Bin, others: Bin[]) {
    const all = { ...layout, bins: [...others, candidate] };
    return slantConflicts(candidate, placedSlant(candidate, all), all).map((c) => ({
      kind: c.kind,
      with: c.with.id,
    }));
  }

  it('finds a bin on the support cells', () => {
    const behind = bin({ id: binId('b'), y: gridUnits(2) });
    expect(conflicts(slanted, [behind])).toEqual([{ kind: 'collision', with: 'b' }]);
    expect(conflicts(behind, [slanted])).toEqual([{ kind: 'collision', with: 's' }]);
  });

  it('leaves a bin past the support alone', () => {
    expect(conflicts(slanted, [bin({ id: binId('b'), y: gridUnits(3) })])).toEqual([]);
  });

  it('finds two supports on the same cells', () => {
    const facing = bin({
      id: binId('f'),
      y: gridUnits(4),
      slant: { ...BACK_45, side: 'front' },
    });
    expect(conflicts(slanted, [facing])).toEqual([{ kind: 'collision', with: 'f' }]);
  });

  it('keeps every other layer off a slanted bin and its support', () => {
    const over = bin({ id: binId('o'), layerId: L2 });
    const overSupport = bin({ id: binId('o'), layerId: L2, y: gridUnits(2) });
    expect(conflicts(over, [slanted])).toEqual([{ kind: 'stacked', with: 's' }]);
    expect(conflicts(overSupport, [slanted])).toEqual([{ kind: 'stacked', with: 's' }]);
    expect(conflicts({ ...slanted, layerId: L2 }, [bin({ id: binId('u') })])).toEqual([
      { kind: 'stacked', with: 'u' },
    ]);
  });

  it('lets upright bins stack', () => {
    expect(conflicts(bin({ id: binId('o'), layerId: L2 }), [bin({ id: binId('u') })])).toEqual([]);
  });

  it('ignores staged bins and the ones it is told to skip', () => {
    const staged = bin({ id: binId('st'), layerId: STAGING_ID, y: gridUnits(2) });
    expect(conflicts(slanted, [staged])).toEqual([]);
    const behind = bin({ id: binId('b'), y: gridUnits(2) });
    const all = { ...layout, bins: [behind, slanted] };
    expect(slantConflicts(slanted, placedSlant(slanted, all), all, () => true)).toEqual([]);
  });
});
