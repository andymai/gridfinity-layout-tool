import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { binFloorMm } from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';
import { deriveDimensions } from './pipeline/context';
import { dividerPatternsApply, planDividerPatterns, widestClearRun } from './dividerPatterns';

const FLOOR_TOP = binFloorMm(DEFAULT_BIN_PARAMS.wallThickness);

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 6,
    wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
    compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
    ...overrides,
  };
}

function plan(params: BinParams) {
  return planDividerPatterns(params, deriveDimensions(params, false));
}

describe('dividerPatternsApply', () => {
  it('requires the pattern and the divider opt-in together', () => {
    const dim = deriveDimensions(makeParams(), false);
    expect(dividerPatternsApply(makeParams(), dim)).toBe(true);
    expect(
      dividerPatternsApply(
        makeParams({ wallPattern: { enabled: true, pattern: 'honeycomb', dividers: false } }),
        dim
      )
    ).toBe(false);
    expect(
      dividerPatternsApply(
        makeParams({ wallPattern: { enabled: false, pattern: 'honeycomb', dividers: true } }),
        dim
      )
    ).toBe(false);
  });

  it('treats a legacy config with no dividers field as off', () => {
    const params = makeParams({ wallPattern: { enabled: true, pattern: 'honeycomb' } });
    expect(dividerPatternsApply(params, deriveDimensions(params, false))).toBe(false);
  });

  it('is unavailable on solid and slotted bins', () => {
    const solid = makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, solid: true } });
    expect(dividerPatternsApply(solid, deriveDimensions(solid, false))).toBe(false);

    const slotted = makeParams({ style: 'slotted' });
    expect(dividerPatternsApply(slotted, deriveDimensions(slotted, false))).toBe(false);
  });
});

describe('planDividerPatterns', () => {
  it('emits one target per divider segment, placed on the wall', () => {
    const result = plan(makeParams());
    expect(result).not.toBeNull();
    // A 2x2 grid of distinct compartments has one column and one row divider.
    expect(result?.targets).toHaveLength(2);
    const rotations = result?.targets.map((t) => t.rotateZ).sort((a, b) => a - b);
    expect(rotations).toEqual([0, 90]);
    for (const target of result?.targets ?? []) {
      expect(target.x).toBeCloseTo(0, 6);
      expect(target.y).toBeCloseTo(0, 6);
      expect(target.patternSpan).toBeLessThan(target.wallLen);
    }
  });

  it('holds a solid margin at both junctions', () => {
    const border = 2;
    const params = makeParams();
    const result = planDividerPatterns(params, deriveDimensions(params, false), border);
    for (const target of result?.targets ?? []) {
      expect(target.wallLen - target.patternSpan).toBeCloseTo(2 * border, 6);
    }
  });

  it('re-fits the band to a shortened divider rather than clipping it', () => {
    const full = plan(makeParams());
    const short = plan(
      makeParams({
        compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2, dividerHeight: 20 },
      })
    );
    expect(short?.bandHeight).toBeLessThan(full?.bandHeight ?? 0);
    // The band still starts at the floor skirt — only its top moves down.
    expect(short?.bandZ0).toBeCloseTo(full?.bandZ0 ?? 0, 6);
  });

  it('returns null when the divider is too short to hold a band', () => {
    expect(
      plan(
        makeParams({
          compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2, dividerHeight: 4 },
        })
      )
    ).toBeNull();
  });

  it('returns null for a single-compartment bin', () => {
    expect(plan(makeParams({ compartments: DEFAULT_BIN_PARAMS.compartments }))).toBeNull();
  });

  it('blocks the pattern where two dividers cross', () => {
    const result = plan(makeParams());
    for (const target of result?.targets ?? []) {
      const crossing = target.keepOuts.find((k) => k.uMin < 0 && k.uMax > 0);
      expect(crossing, 'the mid-span crossing must be kept solid').toBeDefined();
      // Full height: a crossing is structural for the whole divider.
      expect(crossing?.zMin).toBeLessThanOrEqual(result?.bandZ0 ?? 0);
      expect(crossing?.zMax).toBeGreaterThanOrEqual(
        (result?.bandZ0 ?? 0) + (result?.bandHeight ?? 0)
      );
    }
  });

  it('anchors a coincident keep-out to the divider end, not part-way along it', () => {
    // A scoop box's x edge lands exactly ON the column divider it abuts, which
    // is the degenerate input for the centerline clip. The keep-out must still
    // start at the divider's front end.
    const params = makeParams({
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    });
    const result = plan(params);
    const target = result?.targets[0];
    expect(target?.rotateZ).toBe(90);
    const ramp = target?.keepOuts.find((k) => k.zMin <= FLOOR_TOP);
    expect(ramp?.uMin).toBeLessThanOrEqual(-(target?.wallLen ?? 0) / 2);
  });

  it('blocks the pattern under a scoop ramp, near the floor only', () => {
    const params = makeParams({
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    });
    const result = plan(params);
    const target = result?.targets[0];
    expect(target).toBeDefined();
    // The ramp stands on the floor, so its keep-out starts at the floor top.
    const ramp = target?.keepOuts.find((k) => k.zMin <= FLOOR_TOP);
    expect(ramp, 'the ramp footing must be kept solid').toBeDefined();
    // A ramp is a floor feature — it must not swallow the whole band.
    expect(ramp?.zMax).toBeLessThan((result?.bandZ0 ?? 0) + (result?.bandHeight ?? 0));
  });

  it('blocks the pattern behind an interior divider cutout, from the top down', () => {
    const params = makeParams({
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
    });
    const result = plan(params);
    const bandTop = (result?.bandZ0 ?? 0) + (result?.bandHeight ?? 0);
    const cutout = result?.targets[0]?.keepOuts.find((k) => k.zMax >= bandTop);
    expect(cutout, 'the cutout window must be kept clear of pattern').toBeDefined();
    expect(cutout?.zMin).toBeGreaterThan(result?.bandZ0 ?? 0);
  });

  it('keeps the label tab anchorage solid', () => {
    const params = makeParams({
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    });
    const result = plan(params);
    const bandTop = (result?.bandZ0 ?? 0) + (result?.bandHeight ?? 0);
    const anyTopZone = result?.targets.some((t) => t.keepOuts.some((k) => k.zMax >= bandTop * 0.5));
    expect(anyTopZone).toBe(true);
  });
});

describe('widestClearRun', () => {
  const band = { bandZ0: 3, bandHeight: 20 };

  it('returns the full span when nothing blocks it', () => {
    const run = widestClearRun(
      { x: 0, y: 0, rotateZ: 0, wallLen: 40, patternSpan: 36, keepOuts: [] },
      band.bandZ0,
      band.bandHeight
    );
    expect(run).toBeCloseTo(36, 6);
  });

  it('measures the larger side of a central blockage', () => {
    const run = widestClearRun(
      {
        x: 0,
        y: 0,
        rotateZ: 0,
        wallLen: 40,
        patternSpan: 36,
        keepOuts: [{ uMin: -2, uMax: 8, zMin: 0, zMax: 100 }],
      },
      band.bandZ0,
      band.bandHeight
    );
    // Clear runs are [-18, -2] = 16 and [8, 18] = 10.
    expect(run).toBeCloseTo(16, 6);
  });

  it('ignores keep-outs that miss the band mid-height', () => {
    const run = widestClearRun(
      {
        x: 0,
        y: 0,
        rotateZ: 0,
        wallLen: 40,
        patternSpan: 36,
        keepOuts: [{ uMin: -2, uMax: 8, zMin: 0, zMax: 1 }],
      },
      band.bandZ0,
      band.bandHeight
    );
    expect(run).toBeCloseTo(36, 6);
  });

  it('reports zero when the whole span is blocked', () => {
    const run = widestClearRun(
      {
        x: 0,
        y: 0,
        rotateZ: 0,
        wallLen: 40,
        patternSpan: 36,
        keepOuts: [{ uMin: -50, uMax: 50, zMin: 0, zMax: 100 }],
      },
      band.bandZ0,
      band.bandHeight
    );
    expect(run).toBe(0);
  });
});

describe('label tab keep-outs', () => {
  const label = (over: Partial<BinParams['label']> = {}): BinParams['label'] => ({
    ...DEFAULT_BIN_PARAMS.label,
    enabled: true,
    depth: 10,
    ...over,
  });

  /** Every keep-out on a divider running along X (a row boundary). */
  function tabKeepOuts(params: BinParams) {
    const result = plan(params);
    return (result?.targets ?? []).flatMap((t) => t.keepOuts);
  }

  const span = (ks: readonly { uMin: number; uMax: number }[]) =>
    ks
      .map((k) => `${k.uMin.toFixed(2)},${k.uMax.toFixed(2)}`)
      .sort()
      .join('|');

  it('follows the tab inward when `inset` moves it off its wall', () => {
    // `inset` slides the tab body away from its anchor wall. A keep-out
    // pinned to the wall leaves the deepest `inset` mm of the tab sitting on
    // perforated divider, which is the one thing it exists to prevent.
    const plain = tabKeepOuts(makeParams({ label: label({ inset: 0 }) }));
    const inset = tabKeepOuts(makeParams({ label: label({ inset: 6 }) }));
    expect(plain.length).toBeGreaterThan(0);
    // Moving the tab can take it off a divider entirely, so the counts may
    // differ; what must not happen is the two being identical.
    expect(span(inset)).not.toBe(span(plain));
  });

  it('puts the keep-out on the FRONT wall for front-anchored tabs', () => {
    const back = tabKeepOuts(makeParams({ label: label({ edges: 'back' }) }));
    const front = tabKeepOuts(makeParams({ label: label({ edges: 'front' }) }));
    expect(back.length).toBeGreaterThan(0);
    expect(front.length).toBeGreaterThan(0);
    // Mirrored anchors must not produce identical spans.
    expect(span(front)).not.toBe(span(back));
  });
});
