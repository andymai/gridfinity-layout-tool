import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout, HandleConfig, WallCutout } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import {
  LIP_GAP_RAIL_MARGIN,
  unlippedSides,
  lipGapRailBlocks,
  lipGapSides,
  lipGaps,
  polygonLipGaps,
  railSegmentsClearOfPolygonGaps,
  knifeSlotWallExits,
} from './lipGapPlan';

/**
 * The default 2x2x3 bin: innerW = innerD = 2*42 - 0.5 - 2*1.2 = 81.1mm, and an
 * interior ceiling 15.3mm above the cavity floor (21 total, less the 5mm socket
 * and the 0.7mm lip taper). Every expectation below is stated against those.
 */
const INNER = 81.1;
const INTERIOR_H = 15.3;

function bin(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

function walls(
  over: Partial<Record<'front' | 'back' | 'left' | 'right', WallCutout>> = {}
): BinParams['walls'] {
  const side = {
    enabled: false,
    width: 70,
    depth: 50,
    alignment: 'center' as const,
    offset: 0,
    widthMm: null,
  };
  return {
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: true,
    front: { ...side },
    back: { ...side },
    left: { ...side },
    right: { ...side },
    ...over,
  };
}

const HANDLE_SIDE = { enabled: false, width: null, height: null, cornerRadius: null };

function handles(over: Partial<HandleConfig> = {}): HandleConfig {
  return {
    ...DEFAULT_BIN_PARAMS.handles,
    enabled: true,
    width: 50,
    height: 15,
    count: 1,
    verticalPosition: 0.7,
    front: { ...HANDLE_SIDE },
    back: { ...HANDLE_SIDE },
    left: { ...HANDLE_SIDE },
    right: { ...HANDLE_SIDE },
    ...over,
  };
}

describe('lipGaps: wall cutouts', () => {
  it('takes the cutout span and nothing more', () => {
    const gaps = lipGaps(
      bin({ walls: walls({ front: { ...walls().front, enabled: true, width: 40, depth: 50 } }) })
    );
    const half = (INNER * 0.4) / 2;
    expect(gaps).toEqual([
      { side: 'front', source: 'cutout', lo: -half, hi: half, wallSpan: INNER },
    ]);
  });

  it('widens by the shoulder round, which reaches its full radius at the rim', () => {
    // The round-over flares the cut outward as it rises, so the stretch of wall
    // with no lip is wider than the span the user set. A rail placed against
    // the nominal span would hang over the flare and grip nothing — while
    // colliding with nothing, which is why no interference probe sees it.
    const r = 4;
    const cut = { ...walls().front, enabled: true, width: 40, depth: 50 };
    const square = lipGaps(bin({ walls: walls({ front: cut }) }));
    const rounded = lipGaps(bin({ walls: walls({ front: { ...cut, cornerRadiusTop: r } }) }));
    expect(rounded[0].hi - rounded[0].lo).toBeCloseTo(square[0].hi - square[0].lo + 2 * r, 6);
    expect(rounded[0].lo).toBeCloseTo(square[0].lo - r, 6);
    expect(rounded[0].hi).toBeCloseTo(square[0].hi + r, 6);
  });

  it('takes no extra width where the cut leaves no wall to round', () => {
    // A full-width cut has no shoulder, so the builder squares it and the gap
    // must not grow — mirroring the profile's own slack clamp gate for gate.
    const full = { ...walls().front, enabled: true, width: 100, depth: 50, cornerRadiusTop: 5 };
    const gaps = lipGaps(bin({ walls: walls({ front: full }) }));
    expect(gaps[0].hi - gaps[0].lo).toBeCloseTo(INNER, 6);
  });

  it('can be what tips a wall from partly lipped to unusable', () => {
    // 90% of an 81.1mm wall leaves 4.05mm of lip in each corner, which is a
    // usable rail. A 4mm round at each end eats it to 0.05mm and the wall has
    // nothing left to grip — the whole point of routing the flare through here.
    const wide = { ...walls().front, enabled: true, width: 90, depth: 50 };
    expect(unlippedSides(lipGaps(bin({ walls: walls({ front: wide }) })), 'cutout')).toEqual([]);
    const rounded = lipGaps(bin({ walls: walls({ front: { ...wide, cornerRadiusTop: 4 } }) }));
    expect(unlippedSides(rounded, 'cutout')).toEqual(['front']);
  });

  it('follows alignment off the wall centre', () => {
    const left = lipGaps(
      bin({
        walls: walls({
          left: { ...walls().left, enabled: true, width: 40, depth: 50, alignment: 'left' },
        }),
      })
    )[0];
    // `computeCutoutCenter` anchors a left-aligned cut one wallThickness from
    // the corner, so its near edge lands there rather than on the centreline.
    expect(left.lo).toBeCloseTo(-INNER / 2 + DEFAULT_BIN_PARAMS.wallThickness, 5);
  });

  it('honours an absolute mm width over the percentage', () => {
    const gap = lipGaps(
      bin({
        walls: walls({
          back: { ...walls().back, enabled: true, width: 40, depth: 50, widthMm: 20 },
        }),
      })
    )[0];
    expect(gap.hi - gap.lo).toBeCloseTo(20, 5);
  });

  it('reports nothing for a cutout with no depth, which is never built', () => {
    expect(
      lipGaps(bin({ walls: walls({ front: { ...walls().front, enabled: true, depth: 0 } }) }))
    ).toEqual([]);
  });

  it('reports nothing when the feature is off at the top level', () => {
    const off = walls({ front: { ...walls().front, enabled: true } });
    expect(lipGaps(bin({ walls: { ...off, enabled: false } }))).toEqual([]);
  });

  it('reports nothing on a polygon bin, whose cuts follow resolved mask edges', () => {
    const cells = Array<0 | 1>(64).fill(1);
    cells[0] = 0;
    const cellMask: CellMask = { cols: 8, rows: 8, cells };
    expect(
      lipGaps(
        bin({ cellMask, walls: walls({ front: { ...walls().front, enabled: true, depth: 50 } }) })
      )
    ).toEqual([]);
  });
});

describe('lipGaps: handle holes', () => {
  const frontHandle = (over: Partial<HandleConfig> = {}) =>
    lipGaps(bin({ handles: handles({ front: { ...HANDLE_SIDE, enabled: true }, ...over }) }));

  it('takes the hole span for a handle reaching the lip', () => {
    const gaps = frontHandle();
    const half = (INNER * 0.5) / 2;
    expect(gaps).toEqual([
      { side: 'front', source: 'handle', lo: -half, hi: half, wallSpan: INNER },
    ]);
  });

  it('reports nothing for a handle sitting low enough to leave the lip whole', () => {
    // Centred at 30% of a 15.3mm interior, a 15mm request clamps to ~6.1mm, so
    // the hole's top lands well below `interiorHeight - LIP_HEIGHT`.
    expect(frontHandle({ verticalPosition: 0.3 })).toEqual([]);
  });

  it('splits around a cutout on the same wall, exactly as the builder does', () => {
    const gaps = lipGaps(
      bin({
        handles: handles({ front: { ...HANDLE_SIDE, enabled: true }, width: 80 }),
        walls: walls({ front: { ...walls().front, enabled: true, width: 20, depth: 50 } }),
      })
    );
    // One cutout plus the two handle stretches its clearance leaves either side.
    expect(gaps.map((g) => g.source)).toEqual(['cutout', 'handle', 'handle']);
    const cut = gaps[0];
    for (const seg of gaps.slice(1)) {
      expect(seg.hi <= cut.lo || seg.lo >= cut.hi).toBe(true);
    }
  });

  it('reports no handle at all when it cannot fit beside the minimum end gaps', () => {
    // `computeMultiHandleOffsets` needs 3mm clear at each end, so a full-span
    // handle is never placed. Charging a rail for it would take the whole wall
    // for a hole the builder declined to cut.
    expect(frontHandle({ width: 100 }).filter((g) => g.source === 'handle')).toEqual([]);
  });

  it('emits one span per handle when the wall carries several', () => {
    const gaps = frontHandle({ count: 3, width: 20 });
    expect(gaps).toHaveLength(3);
    const centres = gaps.map((g) => (g.lo + g.hi) / 2).sort((a, b) => a - b);
    expect(centres[1]).toBeCloseTo(0, 5);
    expect(centres[0]).toBeLessThan(0);
    expect(centres[2]).toBeGreaterThan(0);
  });

  it('skips the back wall when label tabs own it, as `handleBuilder` does', () => {
    const params = bin({
      handles: handles({ back: { ...HANDLE_SIDE, enabled: true } }),
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    });
    expect(lipGaps(params)).toEqual([]);
    // ...and takes it back when the tabs go away, so the skip is the label's
    // doing rather than the back wall being unreachable.
    expect(lipGapSides(lipGaps({ ...params, label: DEFAULT_BIN_PARAMS.label }), 'handle')).toEqual([
      'back',
    ]);
  });

  it('skips a slotted bin, which the handle feature never builds on', () => {
    expect(
      lipGaps(
        bin({ style: 'slotted', handles: handles({ front: { ...HANDLE_SIDE, enabled: true } }) })
      )
    ).toEqual([]);
  });

  it('skips a hole clamped under 1mm tall, which is never cut', () => {
    // A 1U bin leaves ~2mm of interior; the 10% margin either side clamps the
    // hole below the builder's own floor.
    expect(frontHandle({ height: 0.4 })).toEqual([]);
  });
});

describe('lipGapRailBlocks', () => {
  it('widens each gap by the standoff margin', () => {
    const gaps = lipGaps(
      bin({ walls: walls({ front: { ...walls().front, enabled: true, width: 40, depth: 50 } }) })
    );
    const [block] = lipGapRailBlocks(gaps);
    expect(block.lo).toBeCloseTo(gaps[0].lo - LIP_GAP_RAIL_MARGIN, 5);
    expect(block.hi).toBeCloseTo(gaps[0].hi + LIP_GAP_RAIL_MARGIN, 5);
    expect(block.side).toBe('front');
  });
});

describe('unlippedSides', () => {
  const allFour = (width: number) =>
    walls({
      front: { ...walls().front, enabled: true, width, depth: 50 },
      back: { ...walls().back, enabled: true, width, depth: 50 },
      left: { ...walls().left, enabled: true, width, depth: 50 },
      right: { ...walls().right, enabled: true, width, depth: 50 },
    });

  it('reports nothing while any lip survives, however many walls are cut', () => {
    // The case is about: four 40% windows leave 60% of every wall, and
    // calling that "no lip anywhere" cost the design its lid entirely.
    expect(unlippedSides(lipGaps(bin({ walls: allFour(40) })), 'cutout')).toEqual([]);
  });

  it('reports a wall whose cut runs the full span', () => {
    expect(unlippedSides(lipGaps(bin({ walls: allFour(100) })), 'cutout')).toEqual([
      'front',
      'back',
      'left',
      'right',
    ]);
  });

  it('merges neighbouring gaps rather than testing each alone', () => {
    // Two 60% handles do not overlap the centre individually, but together they
    // leave nothing: a per-gap test would call this wall lipped.
    const gaps = [
      { side: 'front' as const, source: 'handle' as const, lo: -40, hi: 5, wallSpan: 80 },
      { side: 'front' as const, source: 'handle' as const, lo: -5, hi: 40, wallSpan: 80 },
    ];
    expect(unlippedSides(gaps, 'handle')).toEqual(['front']);
  });

  it('does not merge across daylight between two gaps', () => {
    const gaps = [
      { side: 'front' as const, source: 'handle' as const, lo: -40, hi: -5, wallSpan: 80 },
      { side: 'front' as const, source: 'handle' as const, lo: 5, hi: 40, wallSpan: 80 },
    ];
    expect(unlippedSides(gaps, 'handle')).toEqual([]);
  });

  it('keeps the two sources apart', () => {
    const gaps = lipGaps(
      bin({
        walls: allFour(100),
        handles: handles({ front: { ...HANDLE_SIDE, enabled: true } }),
      })
    );
    expect(unlippedSides(gaps, 'cutout')).toHaveLength(4);
    expect(unlippedSides(gaps, 'handle')).toEqual([]);
  });
});

describe('lipGaps: interior height', () => {
  it('measures a handle against the pipeline interior, not the raw wall', () => {
    // The two differ by the 0.7mm lip taper on every lipped bin, which is the
    // plane `handleBuilder` is actually handed. Pinned so a drift back to
    // `height * heightUnitMm - SOCKET_HEIGHT` fails here rather than silently
    // moving every hole 0.5mm.
    const gaps = lipGaps(
      bin({ handles: handles({ front: { ...HANDLE_SIDE, enabled: true }, height: 100 }) })
    );
    expect(gaps).toHaveLength(1);
    // Height clamps to 2 * (min(centreZ, ceiling - centreZ) - 10% margin).
    const centreZ = INTERIOR_H * 0.7;
    const expected = 2 * (Math.min(centreZ, INTERIOR_H - centreZ) - INTERIOR_H * 0.1);
    expect(expected).toBeCloseTo(6.12, 2);
  });
});

describe('polygonLipGaps', () => {
  /** An L: bottom half full, top half only the left two columns. */
  const L_MASK: CellMask = {
    cols: 4,
    rows: 4,
    cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0],
  };
  const FULL: CellMask = { cols: 4, rows: 4, cells: Array<1>(16).fill(1) };

  const withMask = (mask: CellMask, over: Partial<BinParams> = {}): BinParams =>
    bin({ width: 2, depth: 2, cellMask: mask, ...over });

  it('reports nothing for a bin with no openings', () => {
    expect(polygonLipGaps(withMask(L_MASK))).toEqual([]);
  });

  it('reports nothing for a rectangle, which uses the side-keyed plan', () => {
    // A fully-filled mask is treated as rectangular, so it must fall to
    // `lipGaps` rather than being described twice.
    const params = withMask(FULL, {
      walls: walls({ front: { ...walls().front, enabled: true, width: 40, depth: 50 } }),
    });
    expect(polygonLipGaps(params)).toEqual([]);
    expect(lipGaps(params).length).toBeGreaterThan(0);
  });

  it('places a cutout on the edge that faces its side', () => {
    const gaps = polygonLipGaps(
      withMask(L_MASK, {
        walls: walls({ back: { ...walls().back, enabled: true, width: 40, depth: 50 } }),
      })
    );
    expect(gaps).toHaveLength(1);
    const [g] = gaps;
    expect(g.side).toBe('back');
    expect(g.source).toBe('cutout');
    // The L's back wall is the SHORT top edge over the left columns, not the
    // bin's full width — so the gap is measured against that edge's own span
    // and sits over the left half. Reading the bounding box instead would put
    // it in the middle of a wall that is not there.
    expect(g.hi).toBeLessThan(0);
  });

  it('measures the span against the edge, not the bounding box', () => {
    // The L's back edge spans 2 mask cells (42mm) against the front's 4 (84mm),
    // and each loses the same `TOLERANCE + 2 * wallThickness` for clearance and
    // walls — so the spans are 39.1 and 81.1, not one exactly half the other.
    // Measuring against the bin's bounding box would make both 81.1 and put a
    // full-width back cutout through a wall that is not there.
    const spanOn = (side: 'front' | 'back'): number => {
      const g = polygonLipGaps(
        withMask(L_MASK, {
          walls: walls({ [side]: { ...walls()[side], enabled: true, width: 100, depth: 50 } }),
        })
      )[0];
      return g.hi - g.lo;
    };
    const lost = GRIDFINITY_SPEC.TOLERANCE + 2 * DEFAULT_BIN_PARAMS.wallThickness;
    expect(spanOn('front')).toBeCloseTo(4 * 0.5 * DEFAULT_BIN_PARAMS.gridUnitMm - lost, 5);
    expect(spanOn('back')).toBeCloseTo(2 * 0.5 * DEFAULT_BIN_PARAMS.gridUnitMm - lost, 5);
  });

  it('carries the edge’s own cross coordinate so a rail can match it', () => {
    const gaps = polygonLipGaps(
      withMask(L_MASK, {
        walls: walls({ front: { ...walls().front, enabled: true, width: 40, depth: 50 } }),
      })
    );
    // The front edge is the bottom of the mask, at -halfDepth.
    expect(gaps[0].edgeCross).toBeCloseTo(-(4 * 0.5 * DEFAULT_BIN_PARAMS.gridUnitMm) / 2, 5);
  });

  it('applies the same builder gates the rectangle path does', () => {
    // Slotted bins build no handles at all; the shared `wallGaps` is what makes
    // that true for a custom shape without restating it.
    const handled = withMask(L_MASK, {
      handles: handles({ front: { ...HANDLE_SIDE, enabled: true } }),
    });
    expect(polygonLipGaps(handled).length).toBeGreaterThan(0);
    expect(polygonLipGaps({ ...handled, style: 'slotted' })).toEqual([]);
  });
});

describe('railSegmentsClearOfPolygonGaps', () => {
  const gap = {
    side: 'front' as const,
    source: 'cutout' as const,
    edgeCross: -40,
    lo: -5,
    hi: 5,
  };

  it('cuts a run around a gap on the matching edge', () => {
    const segs = railSegmentsClearOfPolygonGaps([{ lo: -30, hi: 30 }], 'front', -40, [gap]);
    expect(segs).toEqual([
      { lo: -30, hi: -5 - LIP_GAP_RAIL_MARGIN },
      { lo: 5 + LIP_GAP_RAIL_MARGIN, hi: 30 },
    ]);
  });

  it('leaves a PARALLEL edge on the same side untouched', () => {
    // The reason gaps carry an edge coordinate at all: a U faces front with two
    // walls, and a cutout on one of them must not cost the other its rail.
    expect(railSegmentsClearOfPolygonGaps([{ lo: -30, hi: 30 }], 'front', 12, [gap])).toEqual([
      { lo: -30, hi: 30 },
    ]);
  });

  it('ignores a gap belonging to another side', () => {
    expect(railSegmentsClearOfPolygonGaps([{ lo: -30, hi: 30 }], 'back', -40, [gap])).toEqual([
      { lo: -30, hi: 30 },
    ]);
  });
});

describe('knifeSlotWallExits', () => {
  const CHEF = {
    bladeLengthMm: 205,
    heelHeightMm: 47,
    spineThicknessMm: 2.3,
    handleWidthMm: 23,
    handleHeightMm: 23,
    openEnd: 'end' as const,
  };

  function knifeSlot(overrides: Partial<Cutout> = {}): Cutout {
    return {
      id: 'k1',
      shape: 'knifeSlot',
      x: 5,
      y: 10,
      width: 60,
      depth: 3.8,
      cutDepth: 12,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
      knife: CHEF,
      ...overrides,
    };
  }

  function solidBin(cutouts: Cutout[]): BinParams {
    return bin({
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts,
    });
  }

  it('maps rotation and openEnd to the exit wall', () => {
    const at = (rotation: number, openEnd: 'start' | 'end') =>
      knifeSlotWallExits(
        solidBin([knifeSlot({ rotation, knife: { ...CHEF, openEnd } })]),
        INNER,
        INNER
      )[0]?.side;
    expect(at(0, 'end')).toBe('right');
    expect(at(0, 'start')).toBe('left');
    expect(at(90, 'end')).toBe('front');
    expect(at(180, 'end')).toBe('left');
    expect(at(270, 'end')).toBe('back');
  });

  it('centres the exit on the slot centerline and reports the slot thickness', () => {
    const [exit] = knifeSlotWallExits(solidBin([knifeSlot()]), INNER, INNER);
    expect(exit.centre).toBeCloseTo(10 + 3.8 / 2 - INNER / 2, 5);
    expect(exit.width).toBe(3.8);
  });

  it('expands repeat arrays into one exit per instance', () => {
    const exits = knifeSlotWallExits(
      solidBin([
        knifeSlot({
          array: {
            mode: 'grid',
            cols: 1,
            rows: 3,
            pitchX: 12,
            pitchY: 12,
            count: 1,
            radius: 20,
            startAngle: 0,
            rotateToCenter: false,
          },
        }),
      ]),
      INNER,
      INNER
    );
    expect(exits).toHaveLength(3);
    expect(new Set(exits.map((e) => e.side))).toEqual(new Set(['right']));
  });

  it('mirrors the builder gates: non-solid, grouped, hidden, rotated, enclosed', () => {
    const nonSolid = bin({ cutouts: [knifeSlot()] });
    expect(knifeSlotWallExits(nonSolid, INNER, INNER)).toHaveLength(0);
    expect(knifeSlotWallExits(solidBin([knifeSlot({ groupId: 'g1' })]), INNER, INNER)).toHaveLength(
      0
    );
    expect(knifeSlotWallExits(solidBin([knifeSlot({ hidden: true })]), INNER, INNER)).toHaveLength(
      0
    );
    expect(knifeSlotWallExits(solidBin([knifeSlot({ rotation: 30 })]), INNER, INNER)).toHaveLength(
      0
    );
    expect(
      knifeSlotWallExits(
        solidBin([knifeSlot({ knife: { ...CHEF, openEnd: undefined } })]),
        INNER,
        INNER
      )
    ).toHaveLength(0);
  });

  it('feeds lipGaps a knifeSlot-source gap the rail plan yields to', () => {
    const gaps = lipGaps(solidBin([knifeSlot()]));
    const knife = gaps.filter((g) => g.source === 'knifeSlot');
    expect(knife).toHaveLength(1);
    expect(knife[0].side).toBe('right');
    expect(knife[0].hi - knife[0].lo).toBeCloseTo(3.8, 5);
    expect(lipGapSides(gaps, 'knifeSlot')).toEqual(['right']);
  });
});
