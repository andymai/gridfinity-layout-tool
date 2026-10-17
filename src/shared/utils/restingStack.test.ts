import { describe, it, expect, afterEach } from 'vitest';
import type { Bin, BinId, Layer } from '@/core/types';
import { binId, designId, gridUnits, heightUnits, layerId } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { createTestBin } from '@/test/testUtils';
import { registerLinkedExcessResolver } from './collision';
import type { RestingStack } from './restingStack';
import {
  drawerHeightFloor,
  findStackViolations,
  findUnevenlySupported,
  getBlockedZones,
  getRestingStack,
  maxBinHeight,
  maxClearanceHeight,
  newViolations,
  resolveRestingStack,
  restack,
} from './restingStack';

const L1 = layerId('layer1');
const L2 = layerId('layer2');
const L3 = layerId('layer3');

const layers: Layer[] = [
  { id: L1, name: 'Layer 1', height: heightUnits(6) },
  { id: L2, name: 'Layer 2', height: heightUnits(6) },
  { id: L3, name: 'Layer 3', height: heightUnits(6) },
];

function bin(
  id: string,
  layer: Layer['id'],
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  extra: Partial<Bin> = {}
): Bin {
  return createTestBin({
    id: binId(id),
    layerId: layer,
    x: gridUnits(x),
    y: gridUnits(y),
    width: gridUnits(w),
    depth: gridUnits(d),
    height: heightUnits(h),
    ...extra,
  });
}

function zOf(stack: RestingStack, id: string): number | undefined {
  return stack.bins.get(binId(id))?.zStart;
}

afterEach(() => {
  registerLinkedExcessResolver(null);
});

describe('resolveRestingStack', () => {
  it('rests an upper-layer bin on the bin under it, not at the layer plane', () => {
    const stack = resolveRestingStack(
      [bin('low', L1, 0, 0, 2, 2, 3), bin('up', L2, 0, 0, 2, 2, 3)],
      layers
    );
    expect(zOf(stack, 'low')).toBe(0);
    expect(zOf(stack, 'up')).toBe(3);
    expect(stack.bins.get(binId('up'))?.restsOn).toEqual([binId('low')]);
  });

  it('drops a bin with nothing under it to the plate, whatever its layer', () => {
    const stack = resolveRestingStack([bin('alone', L3, 4, 4, 1, 1, 2)], layers);
    expect(zOf(stack, 'alone')).toBe(0);
    expect(stack.bins.get(binId('alone'))?.restsOn).toEqual([]);
  });

  it('rests on the tallest of the bins it overlaps', () => {
    const stack = resolveRestingStack(
      [
        bin('short', L1, 0, 0, 1, 1, 3),
        bin('tall', L1, 1, 0, 1, 1, 6),
        bin('span', L2, 0, 0, 2, 1, 2),
      ],
      layers
    );
    expect(zOf(stack, 'span')).toBe(6);
    expect(stack.bins.get(binId('span'))?.restsOn).toEqual([binId('tall')]);
  });

  it('lists every supporter that reaches the resting height', () => {
    const stack = resolveRestingStack(
      [bin('a', L1, 0, 0, 1, 1, 4), bin('b', L1, 1, 0, 1, 1, 4), bin('top', L2, 0, 0, 2, 1, 2)],
      layers
    );
    expect(stack.bins.get(binId('top'))?.restsOn).toEqual([binId('a'), binId('b')]);
  });

  it('chains through several layers and reaches over an empty middle layer', () => {
    const stack = resolveRestingStack(
      [bin('c', L3, 0, 0, 1, 1, 2), bin('a', L1, 0, 0, 1, 1, 3), bin('b', L2, 0, 0, 1, 1, 4)],
      layers
    );
    expect(zOf(stack, 'b')).toBe(3);
    expect(zOf(stack, 'c')).toBe(7);
    expect(stack.tallest).toBe(9);

    const skipped = resolveRestingStack(
      [bin('a', L1, 0, 0, 1, 1, 3), bin('c', L3, 0, 0, 1, 1, 2)],
      layers
    );
    expect(zOf(skipped, 'c')).toBe(3);
  });

  it('never stacks bins that share a layer', () => {
    const stack = resolveRestingStack(
      [bin('a', L1, 0, 0, 2, 2, 3), bin('b', L1, 1, 1, 2, 2, 3)],
      layers
    );
    expect(zOf(stack, 'a')).toBe(0);
    expect(zOf(stack, 'b')).toBe(0);
  });

  it('ignores layer heights entirely', () => {
    const bins = [bin('a', L1, 0, 0, 1, 1, 3), bin('b', L2, 0, 0, 1, 1, 2)];
    const tiny = layers.map((l) => ({ ...l, height: heightUnits(2) }));
    const huge = layers.map((l) => ({ ...l, height: heightUnits(20) }));
    expect(zOf(resolveRestingStack(bins, tiny), 'b')).toBe(3);
    expect(zOf(resolveRestingStack(bins, huge), 'b')).toBe(3);
  });

  it('skips staging bins and bins on unknown layers', () => {
    const stack = resolveRestingStack(
      [
        bin('stashed', STAGING_ID, 0, 0, 1, 1, 9),
        bin('orphan', layerId('gone'), 0, 0, 1, 1, 9),
        bin('up', L2, 0, 0, 1, 1, 2),
      ],
      layers
    );
    expect(stack.bins.has(binId('stashed'))).toBe(false);
    expect(stack.bins.has(binId('orphan'))).toBe(false);
    expect(zOf(stack, 'up')).toBe(0);
  });

  it('stacks on a linked design’s extra rise', () => {
    registerLinkedExcessResolver((b) => (b.linkedDesignId === undefined ? 0 : 1));
    const stack = resolveRestingStack(
      [
        bin('lidded', L1, 0, 0, 1, 1, 3, { linkedDesignId: designId('d') }),
        bin('up', L2, 0, 0, 1, 1, 2),
      ],
      layers
    );
    expect(stack.bins.get(binId('lidded'))?.materialTop).toBe(4);
    expect(zOf(stack, 'up')).toBe(4);
  });

  it('lands a bin on top of reserved clearance and records it', () => {
    const stack = resolveRestingStack(
      [
        bin('tools', L1, 0, 0, 1, 1, 3, { clearanceHeight: heightUnits(2) }),
        bin('up', L2, 0, 0, 1, 1, 2),
      ],
      layers
    );
    expect(zOf(stack, 'up')).toBe(5);
    expect(stack.onClearance).toEqual([{ binId: binId('up'), clearanceOf: binId('tools') }]);
  });

  it('does not flag a bin that something solid holds level with the clearance top', () => {
    const stack = resolveRestingStack(
      [
        bin('tools', L1, 0, 0, 1, 1, 3, { clearanceHeight: heightUnits(2) }),
        bin('solid', L1, 1, 0, 1, 1, 5),
        bin('bridge', L2, 0, 0, 2, 1, 2),
      ],
      layers
    );
    expect(zOf(stack, 'bridge')).toBe(5);
    expect(stack.onClearance).toEqual([]);
  });

  it('does not flag a bin that spans clearance while resting on a taller neighbour', () => {
    const stack = resolveRestingStack(
      [
        bin('tools', L1, 0, 0, 1, 1, 3, { clearanceHeight: heightUnits(2) }),
        bin('tall', L1, 1, 0, 1, 1, 7),
        bin('bridge', L2, 0, 0, 2, 1, 2),
      ],
      layers
    );
    expect(zOf(stack, 'bridge')).toBe(7);
    expect(stack.onClearance).toEqual([]);
  });
});

/** Deterministic PRNG so a failing seed reproduces. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function randomBins(rand: () => number, count: number, prefix: string): Bin[] {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  return Array.from({ length: count }, (_, i) =>
    bin(
      `${prefix}${String(i)}`,
      pick([L1, L2, L3]),
      pick([0, 0.5, 1, 2, 3]),
      pick([0, 0.5, 1, 2, 3]),
      pick([0.5, 1, 2]),
      pick([0.5, 1, 2]),
      pick([2, 3, 4, 6]),
      rand() < 0.2 ? { clearanceHeight: heightUnits(pick([1, 2])) } : {}
    )
  );
}

function normalize(stack: RestingStack): unknown {
  return {
    bins: [...stack.bins.entries()]
      .map(([id, r]) => [id, r.zStart, r.materialTop, r.stackTop, [...r.restsOn].sort()])
      .sort(),
    tallest: stack.tallest,
    onClearance: stack.onClearance.map((c) => `${c.binId}>${c.clearanceOf}`).sort(),
  };
}

describe('restack', () => {
  it('matches a full resolve for random removals and additions', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rand = rng(seed);
      const bins = randomBins(rand, 12, 'b');
      const before = resolveRestingStack(bins, layers);
      const remove = new Set<BinId>(bins.filter(() => rand() < 0.25).map((b) => b.id));
      const add = randomBins(rand, 3, 'n');
      if (rand() < 0.5 && bins.length > 0) {
        // Re-add a removed id at a new spot, as canPlaceBin does for a moved bin.
        const moved = bins[0];
        remove.add(moved.id);
        add.push({ ...moved, x: gridUnits(moved.x + 1) });
      }
      const expected = resolveRestingStack(
        [...bins.filter((b) => !remove.has(b.id) && !add.some((a) => a.id === b.id)), ...add],
        layers
      );
      expect(normalize(restack(before, bins, layers, remove, add)), `seed ${seed}`).toEqual(
        normalize(expected)
      );
    }
  });
});

describe('getRestingStack', () => {
  it('serves the same stack while the arrays are unchanged', () => {
    const bins = [bin('a', L1, 0, 0, 1, 1, 3)];
    expect(getRestingStack(bins, layers)).toBe(getRestingStack(bins, layers));
  });

  it('recomputes when an array grows in place', () => {
    const bins: Bin[] = [bin('a', L1, 0, 0, 1, 1, 3)];
    getRestingStack(bins, layers);
    bins.push(bin('b', L2, 0, 0, 1, 1, 2));
    expect(normalize(getRestingStack(bins, layers))).toEqual(
      normalize(resolveRestingStack(bins, layers))
    );
  });

  it('recomputes when the linked-rise version changes', () => {
    let excess = 0;
    let version = 0;
    registerLinkedExcessResolver(
      () => excess,
      () => version
    );
    const bins = [
      bin('lidded', L1, 0, 0, 1, 1, 3, { linkedDesignId: designId('d') }),
      bin('up', L2, 0, 0, 1, 1, 2),
    ];
    expect(zOf(getRestingStack(bins, layers), 'up')).toBe(3);
    excess = 2;
    version = 1;
    expect(zOf(getRestingStack(bins, layers), 'up')).toBe(5);
  });
});

describe('stack violations', () => {
  it('reports stacks past the drawer and bins resting on clearance', () => {
    const stack = resolveRestingStack(
      [
        bin('tools', L1, 0, 0, 1, 1, 3, { clearanceHeight: heightUnits(2) }),
        bin('up', L2, 0, 0, 1, 1, 6),
      ],
      layers
    );
    expect(findStackViolations(stack, 10)).toEqual([
      { kind: 'exceeds_height', binId: binId('up') },
      { kind: 'clearance', binId: binId('up'), clearanceOf: binId('tools') },
    ]);
  });

  it('counts only violations the change introduces', () => {
    const over = [bin('high', L1, 0, 0, 1, 1, 12)];
    const before = resolveRestingStack(over, layers);
    const after = resolveRestingStack([...over, bin('ok', L1, 3, 3, 1, 1, 3)], layers);
    expect(newViolations(before, after, 10)).toEqual([]);

    const worse = resolveRestingStack([...over, bin('up', L2, 3, 3, 1, 1, 11)], layers);
    expect(newViolations(before, worse, 10)).toEqual([
      { kind: 'exceeds_height', binId: binId('up') },
    ]);
  });

  it('counts a stack that was already over and rises further', () => {
    // 3u + 5u is already 2u over a 6u drawer; growing the lower bin lifts it more.
    const before = resolveRestingStack(
      [bin('low', L1, 0, 0, 1, 1, 3), bin('up', L2, 0, 0, 1, 1, 5)],
      layers
    );
    const raised = resolveRestingStack(
      [bin('low', L1, 0, 0, 1, 1, 4), bin('up', L2, 0, 0, 1, 1, 5)],
      layers
    );
    const lowered = resolveRestingStack(
      [bin('low', L1, 0, 0, 1, 1, 2), bin('up', L2, 0, 0, 1, 1, 5)],
      layers
    );
    expect(newViolations(before, raised, 6)).toEqual([
      { kind: 'exceeds_height', binId: binId('up') },
    ]);
    expect(newViolations(before, lowered, 6)).toEqual([]);
  });
});

describe('maxBinHeight', () => {
  it('leaves a plate bin with nothing above the whole drawer', () => {
    const b = bin('a', L1, 0, 0, 1, 1, 3);
    expect(maxBinHeight(b, [b], layers, 12)).toBe(12);
  });

  it('subtracts what rests on the bin and its own clearance', () => {
    const b = bin('a', L1, 0, 0, 1, 1, 3, { clearanceHeight: heightUnits(1) });
    const bins = [b, bin('mid', L2, 0, 0, 1, 1, 4), bin('top', L3, 0, 0, 1, 1, 2)];
    // The stack above rests on the clearance top: 12 - 1 - 4 - 2.
    expect(maxBinHeight(b, bins, layers, 12)).toBe(5);
  });

  it('lets clearance give way when the edit keeps height plus clearance fixed', () => {
    // 3u + 3u clearance fills a 6u drawer; growing to 4u leaves 2u of clearance.
    const b = bin('a', L1, 0, 0, 1, 1, 3, { clearanceHeight: heightUnits(3) });
    expect(maxBinHeight(b, [b], layers, 6)).toBe(3);
    expect(maxBinHeight(b, [b], layers, 6, { clearanceGivesWay: true })).toBe(6);
  });

  it('lets a bin rise under a stack that is already over, while that stack stays put', () => {
    // 8u middle bridge on an 8u support, an 8u bin on top: 24u in 12u. The
    // 2u bin beside the support can reach 8u without moving the bridge.
    const b = bin('short', L1, 0, 0, 1, 1, 2);
    const bins = [
      b,
      bin('support', L1, 1, 0, 1, 1, 8),
      bin('bridge', L2, 0, 0, 2, 1, 8),
      bin('top', L3, 0, 0, 1, 1, 8),
    ];
    expect(maxBinHeight(b, bins, layers, 12)).toBe(8);
  });

  it('starts from where the bin rests', () => {
    const under = bin('under', L1, 0, 0, 1, 1, 4);
    const b = bin('b', L2, 0, 0, 1, 1, 2);
    expect(maxBinHeight(b, [under, b], layers, 12)).toBe(8);
  });

  it('sizes a candidate that is not in the layout yet', () => {
    const under = bin('under', L1, 0, 0, 1, 1, 4);
    const candidate = bin('new', L2, 0, 0, 1, 1, 0);
    expect(maxBinHeight(candidate, [under], layers, 12)).toBe(8);
  });

  it('is exactly the height at which some stack first passes the drawer', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rand = rng(seed);
      const bins = randomBins(rand, 10, 'b');
      const target = bins[Math.floor(rand() * bins.length)];
      const drawer = 30;
      const limit = maxBinHeight(target, bins, layers, drawer);
      const withHeight = (h: number): Bin[] =>
        bins.map((b) => (b.id === target.id ? { ...b, height: heightUnits(h) } : b));
      const before = resolveRestingStack(withHeight(0), layers);
      const overflows = (h: number): boolean =>
        newViolations(before, resolveRestingStack(withHeight(h), layers), drawer).some(
          (v) => v.kind === 'exceeds_height'
        );
      if (limit < 0) continue;
      expect(overflows(limit), `seed ${seed}`).toBe(false);
      expect(overflows(limit + 0.5), `seed ${seed}`).toBe(true);
    }
  });

  it('matches the first overflowing height when clearance gives way', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rand = rng(seed);
      const bins = randomBins(rand, 10, 'b');
      const target = bins[Math.floor(rand() * bins.length)];
      const drawer = 30;
      const clearance = target.clearanceHeight ?? 0;
      const total = target.height + clearance;
      const limit = maxBinHeight(target, bins, layers, drawer, { clearanceGivesWay: true });
      const edited = (h: number): Bin[] =>
        bins.map((b) =>
          b.id === target.id
            ? {
                ...b,
                height: heightUnits(h),
                clearanceHeight: heightUnits(clearance > 0 ? Math.max(0, total - h) : 0),
              }
            : b
        );
      const before = resolveRestingStack(bins, layers);
      const overflows = (h: number): boolean =>
        newViolations(before, resolveRestingStack(edited(h), layers), drawer).some(
          (v) => v.kind === 'exceeds_height'
        );
      if (limit < target.height) continue;
      expect(overflows(limit), `seed ${seed}`).toBe(false);
      expect(overflows(limit + 0.5), `seed ${seed}`).toBe(true);
    }
  });
});

describe('maxClearanceHeight', () => {
  it('allows clearance up to an upper bin that a taller neighbour holds', () => {
    const b = bin('a', L1, 0, 0, 1, 1, 3);
    const bins = [b, bin('tall', L1, 1, 0, 1, 1, 5), bin('up', L2, 0, 0, 2, 1, 2)];
    const limit = maxClearanceHeight(b, bins, layers, 12);
    expect(limit).toBe(2);
    const withLimit = bins.map((x) =>
      x.id === b.id ? { ...x, clearanceHeight: heightUnits(limit) } : x
    );
    expect(
      newViolations(resolveRestingStack(bins, layers), resolveRestingStack(withLimit, layers), 12)
    ).toEqual([]);
  });

  it('never drops below the clearance a bin reserves now', () => {
    // 5u + 1u clearance on a 5u bin is already over a 10u drawer.
    const b = bin('a', L2, 0, 0, 1, 1, 5, { clearanceHeight: heightUnits(1) });
    const bins = [bin('under', L1, 0, 0, 1, 1, 5), b];
    expect(maxClearanceHeight(b, bins, layers, 10)).toBe(1);
  });

  it('stops at the base of the lowest bin above', () => {
    const b = bin('a', L1, 0, 0, 2, 2, 3);
    const bins = [b, bin('up', L2, 1, 1, 1, 1, 2)];
    expect(maxClearanceHeight(b, bins, layers, 12)).toBe(0);
    expect(maxClearanceHeight(b, [b], layers, 12)).toBe(9);
  });
});

describe('drawerHeightFloor', () => {
  it('is the tallest stack, never above the current height', () => {
    const bins = [bin('a', L1, 0, 0, 1, 1, 3), bin('b', L2, 0, 0, 1, 1, 4)];
    expect(drawerHeightFloor(bins, layers, 12)).toBe(7);
    expect(drawerHeightFloor(bins, layers, 5)).toBe(5);
    expect(drawerHeightFloor([], layers, 12)).toBe(2);
  });
});

describe('findUnevenlySupported', () => {
  it('flags an overhang and a bin leaning on a taller neighbour', () => {
    const bins = [
      bin('base', L1, 0, 0, 1, 1, 3),
      bin('overhang', L2, 0, 0, 2, 1, 2),
      bin('short', L1, 4, 0, 1, 1, 2),
      bin('tall', L1, 5, 0, 1, 1, 4),
      bin('leaning', L2, 4, 0, 2, 1, 2),
      bin('evenA', L1, 0, 4, 1, 1, 3),
      bin('evenB', L1, 1, 4, 1, 1, 3),
      bin('even', L2, 0, 4, 2, 1, 2),
      bin('plate', L2, 8, 8, 1, 1, 2),
    ];
    const uneven = findUnevenlySupported(bins, resolveRestingStack(bins, layers));
    expect([...uneven].sort()).toEqual([binId('leaning'), binId('overhang')].sort());
  });

  it('does not count a supporter that meets the base only with its clearance', () => {
    const bins = [
      bin('tools', L1, 0, 0, 1, 1, 3, { clearanceHeight: heightUnits(2) }),
      bin('solid', L1, 1, 0, 1, 1, 5),
      bin('bridge', L2, 0, 0, 2, 1, 2),
    ];
    const stack = resolveRestingStack(bins, layers);
    expect(stack.onClearance).toEqual([]);
    expect([...findUnevenlySupported(bins, stack)]).toEqual([binId('bridge')]);
  });

  it('measures half-unit footprints exactly', () => {
    const bins = [bin('base', L1, 0, 0, 1, 1, 3), bin('half', L2, 0.5, 0, 0.5, 1, 2)];
    expect(findUnevenlySupported(bins, resolveRestingStack(bins, layers)).size).toBe(0);
  });
});

describe('getBlockedZones', () => {
  it('blocks the footprint of clearance from a lower layer', () => {
    const bins = [bin('tools', L1, 1, 1, 2, 2, 3, { clearanceHeight: heightUnits(2) })];
    expect(getBlockedZones(L2, bins, layers)).toEqual([
      {
        x: gridUnits(1),
        y: gridUnits(1),
        width: gridUnits(2),
        depth: gridUnits(2),
        sourceBinId: binId('tools'),
        sourceLayerId: L1,
      },
    ]);
    expect(getBlockedZones(L1, bins, layers)).toEqual([]);
  });

  it('leaves a tall bin without clearance unblocked', () => {
    expect(getBlockedZones(L2, [bin('tall', L1, 0, 0, 1, 1, 9)], layers)).toEqual([]);
  });

  it('drops a zone that bins on a middle layer cover completely', () => {
    const bins = [
      bin('tools', L1, 0, 0, 1, 1, 3, { clearanceHeight: heightUnits(2) }),
      bin('tall', L1, 1, 0, 1, 1, 7),
      bin('lid', L2, 0, 0, 2, 1, 2),
    ];
    expect(getBlockedZones(L3, bins, layers)).toEqual([]);
    expect(getBlockedZones(L2, bins, layers)).toHaveLength(1);
  });

  it('clips a partly covered zone to the clearance still exposed', () => {
    // The bridge on layer 2 covers the right half of the 2×1 clearance bin, so
    // a bin on layer 3 can rest on the bridge there; only x 0..1 is blocked.
    const bins = [
      bin('tools', L1, 0, 0, 2, 1, 3, { clearanceHeight: heightUnits(2) }),
      bin('solid', L1, 2, 0, 1, 1, 6),
      bin('bridge', L2, 1, 0, 2, 1, 2),
    ];
    expect(getBlockedZones(L3, bins, layers)).toEqual([
      {
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(1),
        depth: gridUnits(1),
        sourceBinId: binId('tools'),
        sourceLayerId: L1,
      },
    ]);
  });

  it('splits an exposed region that is not a rectangle into rectangles', () => {
    const bins = [
      bin('tools', L1, 0, 0, 2, 2, 3, { clearanceHeight: heightUnits(2) }),
      bin('solid', L1, 1, 1, 1, 1, 6),
      bin('corner', L2, 1, 1, 1, 1, 2),
    ];
    const zones = getBlockedZones(L3, bins, layers);
    const area = zones.reduce((sum, z) => sum + z.width * z.depth, 0);
    expect(area).toBe(3);
    expect(zones.every((z) => !(z.x >= 1 && z.y >= 1))).toBe(true);
  });

  it('ignores staging bins and unknown layers', () => {
    const stashed = bin('s', STAGING_ID, 0, 0, 1, 1, 3, { clearanceHeight: heightUnits(2) });
    expect(getBlockedZones(L2, [stashed], layers)).toEqual([]);
    expect(getBlockedZones(layerId('gone'), [stashed], layers)).toEqual([]);
  });
});
