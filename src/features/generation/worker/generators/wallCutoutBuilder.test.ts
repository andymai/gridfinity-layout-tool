import { describe, it, expect, beforeAll } from 'vitest';
import { draw, getBounds, intersect, withScope } from 'brepjs';
import type { DisposalScope, Shape3D } from 'brepjs';
import { isOk } from '@/core/result';
import {
  autoCornerRadius,
  buildSingleCutout,
  computeInteriorDividerCutouts,
  cornerSlackFor,
} from './wallCutoutBuilder';
import type { CornerSlack } from './wallCutoutBuilder';
import type { CutoutCornerRadii } from '@/shared/utils/wallCutoutPosition';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { CUT_RIM_CLEARANCE, LIP_HEIGHT } from './generatorConstants';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, DividerOverride, WallCutoutShape } from '@/features/bin-designer/types';

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Shape3D =>
  draw([x0, y0])
    .lineTo([x1, y0])
    .lineTo([x1, y1])
    .lineTo([x0, y1])
    .close()
    .sketchOnPlane('XY', z0)
    .extrude(z1 - z0);

const INNER_W = 80;
const INNER_D = 40;
/** Divider top, in the body frame: what an interior window is measured from. */
const DIVIDER_TOP_Z = 21;

/** Bin with the interior-divider cutout enabled and a given compartment grid. */
function makeParams(
  compartments: Partial<BinParams['compartments']>,
  overrides?: DividerOverride[]
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      // Reuse the enabled left-wall cutout shape (width/depth + position) for interior.
      interior: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
    },
    compartments: {
      ...DEFAULT_BIN_PARAMS.compartments,
      ...compartments,
      ...(overrides ? { dividerOverrides: overrides } : {}),
    },
  };
}

describe('computeInteriorDividerCutouts', () => {
  it('returns nothing when there is only one compartment', () => {
    const params = makeParams({ cols: 1, rows: 1, cells: [0] });
    expect(computeInteriorDividerCutouts(params, INNER_W, INNER_D, DIVIDER_TOP_Z)).toEqual([]);
  });

  it('returns nothing when the interior cutout is disabled', () => {
    const params = makeParams({ cols: 2, rows: 1, cells: [0, 1] });
    const disabled: BinParams = {
      ...params,
      walls: { ...params.walls, interior: { ...params.walls.interior, enabled: false } },
    };
    expect(computeInteriorDividerCutouts(disabled, INNER_W, INNER_D, DIVIDER_TOP_Z)).toEqual([]);
  });

  it('places a straight vertical divider cutout on the grid line (rotateZ 90)', () => {
    const params = makeParams({ cols: 2, rows: 1, cells: [0, 1] });
    const cuts = computeInteriorDividerCutouts(params, INNER_W, INNER_D, DIVIDER_TOP_Z);
    expect(cuts).toHaveLength(1);
    expect(cuts[0].x).toBeCloseTo(0, 6); // boundary 1 of 2 → centre
    expect(cuts[0].rotateZ).toBe(90);
  });

  it('translates the cutout when the divider is shifted (equal offsets)', () => {
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: 5,
      offsetEnd: 5,
    };
    const params = makeParams({ cols: 2, rows: 1, cells: [0, 1] }, [override]);
    const [cut] = computeInteriorDividerCutouts(params, INNER_W, INNER_D, DIVIDER_TOP_Z);
    // Pure translation: midpoint shifts by the offset, no rotation.
    expect(cut.x).toBeCloseTo(5, 6);
    expect(cut.rotateZ).toBeCloseTo(90, 6);
  });

  it('rotates the cutout to follow a tilted vertical divider', () => {
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: 5,
      offsetEnd: -5,
    };
    const params = makeParams({ cols: 2, rows: 1, cells: [0, 1] }, [override]);
    const [cut] = computeInteriorDividerCutouts(params, INNER_W, INNER_D, DIVIDER_TOP_Z);
    // segLen = 1 cell = INNER_D/1 = 40; dx = offsetEnd - offsetStart = -10.
    const expected = (Math.atan2(40, -10) * 180) / Math.PI;
    expect(cut.x).toBeCloseTo(0, 6); // symmetric tilt → midpoint unchanged
    expect(cut.rotateZ).toBeCloseTo(expected, 4);
    expect(cut.rotateZ).not.toBe(90); // the regression: it used to stay axis-aligned
  });

  it('keeps a multi-pair boundary merged into one window when untilted (no regression)', () => {
    // 2×2 grid: the vertical boundary spans pairs 0|1 and 2|3. With no overrides
    // these stay merged into a single centered window per boundary (historical
    // behavior), not one per pair.
    const params = makeParams({ cols: 2, rows: 2, cells: [0, 1, 2, 3] });
    const cuts = computeInteriorDividerCutouts(params, INNER_W, INNER_D, DIVIDER_TOP_Z);
    expect(cuts).toHaveLength(2); // one vertical + one horizontal
    const vertical = cuts.filter((c) => c.rotateZ === 90);
    const horizontal = cuts.filter((c) => c.rotateZ === 0);
    expect(vertical).toHaveLength(1);
    expect(horizontal).toHaveLength(1);
    expect(vertical[0].x).toBeCloseTo(0, 6);
    expect(vertical[0].y).toBeCloseTo(0, 6); // centered across both rows
  });

  it('splits a multi-pair boundary per pair once a tilt is present', () => {
    // Tilting only pair 0|1 forces the pair-aware path: the vertical boundary
    // now yields a tilted window for 0|1 and a straight one for 2|3.
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: 5,
      offsetEnd: -5,
    };
    const params = makeParams({ cols: 2, rows: 2, cells: [0, 1, 2, 3] }, [override]);
    const cuts = computeInteriorDividerCutouts(params, INNER_W, INNER_D, DIVIDER_TOP_Z);
    expect(cuts).toHaveLength(4); // 2 vertical (per pair) + 2 horizontal (per pair)
    const tilted = cuts.filter((c) => c.rotateZ !== 90 && c.rotateZ !== 0);
    expect(tilted).toHaveLength(1); // only the 0|1 segment is angled
  });

  it('rotates the cutout to follow a tilted horizontal divider', () => {
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: 4,
      offsetEnd: -4,
    };
    const params = makeParams({ cols: 1, rows: 2, cells: [0, 1] }, [override]);
    const [cut] = computeInteriorDividerCutouts(params, INNER_W, INNER_D, DIVIDER_TOP_Z);
    // Horizontal segLen = 1 cell = INNER_W/1 = 80; dy = -8.
    const expected = (Math.atan2(-8, 80) * 180) / Math.PI;
    expect(cut.y).toBeCloseTo(0, 6);
    expect(cut.rotateZ).toBeCloseTo(expected, 4);
    expect(cut.rotateZ).not.toBe(0); // the regression: it used to stay axis-aligned
  });

  // ─── Alignment / offset / mm parity with outer walls (discussion) ──
  // A linked outer config (e.g. left-aligned + offset) is copied onto the
  // interior cutout, so the divider window must track it instead of staying
  // centred on the divider midpoint.
  const withInterior = (
    params: BinParams,
    patch: Partial<BinParams['walls']['left']>
  ): BinParams => ({
    ...params,
    walls: { ...params.walls, interior: { ...params.walls.interior, ...patch } },
  });

  it('shifts a vertical divider cutout along Y for left vs right alignment', () => {
    const base = makeParams({ cols: 2, rows: 1, cells: [0, 1] });
    const [left] = computeInteriorDividerCutouts(
      withInterior(base, { alignment: 'left', offset: 0 }),
      INNER_W,
      INNER_D,
      DIVIDER_TOP_Z
    );
    const [center] = computeInteriorDividerCutouts(
      withInterior(base, { alignment: 'center', offset: 0 }),
      INNER_W,
      INNER_D,
      DIVIDER_TOP_Z
    );
    const [right] = computeInteriorDividerCutouts(
      withInterior(base, { alignment: 'right', offset: 0 }),
      INNER_W,
      INNER_D,
      DIVIDER_TOP_Z
    );
    // Vertical divider runs along Y (rotateZ 90): alignment moves the window
    // along Y, never off the grid line in X.
    expect(center.y).toBeCloseTo(0, 6);
    expect(left.y).toBeLessThan(center.y);
    expect(right.y).toBeGreaterThan(center.y);
    expect(left.y).toBeCloseTo(-right.y, 6);
    expect(left.x).toBeCloseTo(0, 6);
    expect(right.x).toBeCloseTo(0, 6);
  });

  it('shifts a horizontal divider cutout along X for the offset', () => {
    const base = makeParams({ cols: 1, rows: 2, cells: [0, 1] });
    const [centered] = computeInteriorDividerCutouts(
      withInterior(base, { alignment: 'center', offset: 0 }),
      INNER_W,
      INNER_D,
      DIVIDER_TOP_Z
    );
    const [offset] = computeInteriorDividerCutouts(
      withInterior(base, { alignment: 'center', offset: 3 }),
      INNER_W,
      INNER_D,
      DIVIDER_TOP_Z
    );
    // Horizontal divider runs along X (rotateZ 0): a +offset slides it +X.
    expect(centered.x).toBeCloseTo(0, 6);
    expect(offset.x).toBeCloseTo(3, 6);
    expect(offset.y).toBeCloseTo(centered.y, 6);
  });

  it('sizes a tilted divider cutout by its true diagonal length, not the projected span', () => {
    // Symmetric ±20mm tilt on a segLen=40 vertical divider → 45° wall whose
    // true length is hypot(40, 40). A 70% window must scale to that length.
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: -20,
      offsetEnd: 20,
    };
    const base = makeParams({ cols: 2, rows: 1, cells: [0, 1] }, [override]);
    const [cut] = computeInteriorDividerCutouts(
      withInterior(base, { width: 70, alignment: 'center', offset: 0 }),
      INNER_W,
      INNER_D,
      DIVIDER_TOP_Z
    );
    expect(cut.rotateZ).toBeCloseTo(45, 4);
    expect(cut.cutW).toBeCloseTo(Math.hypot(40, 40) * 0.7, 4);
  });

  it('honours an absolute mm width override instead of the percentage', () => {
    const base = makeParams({ cols: 2, rows: 1, cells: [0, 1] });
    // Percentage default (70%) would give 0.7 * segLen; the mm override wins.
    const [cut] = computeInteriorDividerCutouts(
      withInterior(base, { widthMm: 10 }),
      INNER_W,
      INNER_D,
      DIVIDER_TOP_Z
    );
    expect(cut.cutW).toBeCloseTo(10, 6);
  });
});

describe('autoCornerRadius', () => {
  it('derives from the cutout width alone — bin height must not move it (#3162)', () => {
    // The regression: a height term (min(width, height) * 0.15) made raising
    // the bin height balloon the corner radius of an untouched cutout
    // (~2.8mm at 3u → the 5mm clamp at 6u). Width-only keeps it stable.
    expect(autoCornerRadius(98)).toBe(5); // wide slot hits the 5mm cap
    expect(autoCornerRadius(20)).toBeCloseTo(3, 9); // 15% slope in range
    expect(autoCornerRadius(1)).toBe(0.5); // floor for tiny slots
  });
});

describe('cornerSlackFor', () => {
  it('splits the leftover wall evenly for a centred cut', () => {
    expect(cornerSlackFor(80, 60, 0)).toEqual({ left: 10, right: 10 });
  });

  it('reports zero on both sides for a full-width cut', () => {
    expect(cornerSlackFor(80, 80, 0)).toEqual({ left: 0, right: 0 });
  });

  it('tracks an off-centre cut asymmetrically', () => {
    // Shifted 5mm toward +X: 15mm of wall left behind it, 5mm ahead.
    expect(cornerSlackFor(80, 60, 5)).toEqual({ left: 15, right: 5 });
  });

  it('never reports negative slack when a cut overruns its span', () => {
    // Callers clamp cut width to the span, so this is a guard rather than a
    // reachable state: a negative radius cap would throw inside the pen.
    expect(cornerSlackFor(80, 100, 0)).toEqual({ left: 0, right: 0 });
  });
});

describe('buildSingleCutout corner placement', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  // 40mm span → autoCornerRadius saturates at its 5mm cap, the worst case for
  //. OVERSHOOT is the production no-lip value, so the cut runs from
  // z = WALL_HEIGHT - CUT_HEIGHT up to z = WALL_HEIGHT + CUT_RIM_CLEARANCE and
  // the wall's visible rim sits at z = WALL_HEIGHT.
  const CUT_WIDTH = 40;
  const CUT_HEIGHT = 30;
  const OVERSHOOT = CUT_RIM_CLEARANCE;
  const EXTRUDE_DEPTH = 8;
  const WALL_HEIGHT = 40;
  const CENTERED = { x: 0, y: 0, rotateZ: 0 };
  const FLOOR_Z = WALL_HEIGHT - CUT_HEIGHT;

  /**
   * Horizontal span of the cut across the thin Z slab starting at `z`.
   *
   * Measured on the positioned solid rather than the 2D profile on purpose:
   * `isInside2D` is winding-sensitive (`drawRoundedRectangle` emits a
   * counterClockwise blueprint and calls its own centre outside), and 2D
   * drawing booleans throw on these profiles. A 3D bounding box is immune to
   * both, and this exercises the real overshoot/`cutZ` placement — the half of
   * That decides whether an arc reaches the rim at all.
   */
  const spanAtZ = (
    shape: WallCutoutShape,
    z: number,
    cutHeight: number = CUT_HEIGHT,
    cornerSlack?: CornerSlack,
    radii?: CutoutCornerRadii
  ): number =>
    withScope((scope: DisposalScope) => {
      const cut = scope.register(
        buildSingleCutout(
          shape,
          CUT_WIDTH,
          cutHeight,
          OVERSHOOT,
          EXTRUDE_DEPTH,
          WALL_HEIGHT,
          CENTERED,
          cornerSlack,
          radii
        )
      );
      const slab = scope.register(
        box(-2 * CUT_WIDTH, 2 * CUT_WIDTH, -EXTRUDE_DEPTH, EXTRUDE_DEPTH, z, z + 0.001)
      );
      const clipped = intersect(cut, slab);
      expect(isOk(clipped), `slab intersection at z=${z}`).toBe(true);
      if (!isOk(clipped)) return NaN;
      const b = getBounds(scope.register(clipped.value));
      return b.xMax - b.xMin;
    });

  it('straddles the wall and overshoots the rim', () => {
    // The u-shape profile switched from drawRoundedRectangle to a pen for
    //, which flips the blueprint winding (counterClockwise → clockwise).
    // Winding can flip an extrusion's direction, so pin the placement: the cut
    // must stay centred on the wall face in Y and still clear the rim in Z.
    const b = withScope((scope: DisposalScope) =>
      getBounds(
        scope.register(
          buildSingleCutout(
            'u-shape',
            CUT_WIDTH,
            CUT_HEIGHT,
            OVERSHOOT,
            EXTRUDE_DEPTH,
            WALL_HEIGHT,
            CENTERED
          )
        )
      )
    );
    expect(b.yMin).toBeCloseTo(-EXTRUDE_DEPTH / 2, 3);
    expect(b.yMax).toBeCloseTo(EXTRUDE_DEPTH / 2, 3);
    expect(b.zMin).toBeCloseTo(FLOOR_Z, 3);
    expect(b.zMax).toBeCloseTo(WALL_HEIGHT + OVERSHOOT, 3);
  });

  it('opens the u-shape to full width at the rim (#3173)', () => {
    // The regression: a 5mm radius only clears a 2mm overshoot over the top 2mm
    // of its arc, so at rim level the arc had already pulled the opening in by
    // 5 - sqrt(5² - 2²) = 1mm per side — 2mm of visible flare on the wall's rim.
    expect(spanAtZ('u-shape', WALL_HEIGHT)).toBeCloseTo(CUT_WIDTH, 2);
  });

  it('keeps the u-shape full width through the trimmed overshoot', () => {
    // Nothing narrows anywhere in the strip the boolean consumes, so no arc can
    // survive down to the rim no matter how the overshoot is retuned.
    expect(spanAtZ('u-shape', WALL_HEIGHT + OVERSHOOT - 0.001)).toBeCloseTo(CUT_WIDTH, 2);
  });

  it('still rounds the u-shape bottom corners', () => {
    const r = autoCornerRadius(CUT_WIDTH);
    // At the floor the arcs have run their full radius in from each side. The
    // probe slab has thickness, over which the arc widens back out ~0.2mm, so
    // the tolerance is loose rather than an exact CUT_WIDTH - 2r.
    expect(spanAtZ('u-shape', FLOOR_Z)).toBeCloseTo(CUT_WIDTH - 2 * r, 0);
  });

  it('falls back to a plain rectangle when the radius degenerates', () => {
    // userCutHeight/2 - 0.01 drives safeR below the 0.1 threshold, so all four
    // corners stay square and the floor spans the full width.
    const tinyHeight = 0.2;
    expect(spanAtZ('u-shape', WALL_HEIGHT - tinyHeight, tinyHeight)).toBeCloseTo(CUT_WIDTH, 2);
  });

  it('squares the bottom corners when the cut spans the whole wall', () => {
    // The reported artifact: with no wall left beyond the cut edge, a 5mm bottom
    // fillet has nothing to blend into and stands up as a tapering fin welded to
    // the side wall. Zero slack must reach the floor at full width instead.
    expect(spanAtZ('u-shape', FLOOR_Z, CUT_HEIGHT, { left: 0, right: 0 })).toBeCloseTo(
      CUT_WIDTH,
      2
    );
  });

  it('caps each bottom corner by the wall left on its own side', () => {
    // Alignment can leave one end flush and the other deep in material, so the
    // radii are resolved per corner rather than from a single worst case.
    const r = autoCornerRadius(CUT_WIDTH);
    const flushLeft = spanAtZ('u-shape', FLOOR_Z, CUT_HEIGHT, { left: 0, right: Infinity });
    expect(flushLeft).toBeCloseTo(CUT_WIDTH - r, 0);
  });

  it('shrinks the fillet to the available slack rather than dropping it', () => {
    // Slack below the auto radius keeps a proportional fillet: the blend stays,
    // scaled to the column it runs into, so there is no cliff at exactly 100%.
    const slack = 2;
    expect(spanAtZ('u-shape', FLOOR_Z, CUT_HEIGHT, { left: slack, right: slack })).toBeCloseTo(
      CUT_WIDTH - 2 * slack,
      0
    );
  });

  it('leaves the funnel and scoop top corners square', () => {
    // Both are already square at the top; these guard against the u-shape fix
    // being generalised into the branches that never had the defect.
    expect(spanAtZ('funnel', WALL_HEIGHT + OVERSHOOT - 0.001)).toBeCloseTo(CUT_WIDTH, 2);
    expect(spanAtZ('scoop', WALL_HEIGHT + OVERSHOOT - 0.001)).toBeCloseTo(CUT_WIDTH, 2);
  });

  it('still rounds the funnel bottom corners', () => {
    // The funnel's sides are slanted, so its floor arcs do not inset by a flat
    // `r` per side — assert only that the floor is clearly pulled in from the
    // nominal 60% bottom width.
    expect(spanAtZ('funnel', FLOOR_Z)).toBeLessThan(CUT_WIDTH * 0.6 - 1);
  });

  // ─── Top round-over ────────────────────────────────────────────────────
  // The shoulder where the cut meets the rim. The cut FLARES outward as it
  // rises, so the material corner beside it comes out rounded — assert the
  // opening's width at three heights, since a square shoulder and a rounded
  // one have identical bounding boxes, triangle counts and watertightness.
  describe('top round-over', () => {
    const TOP_R = 5;
    const withTop = (top: number, bottom = 0): CutoutCornerRadii => ({ top, bottom });

    it('opens the cut by the radius on each side at the rim', () => {
      expect(spanAtZ('u-shape', WALL_HEIGHT, CUT_HEIGHT, undefined, withTop(TOP_R))).toBeCloseTo(
        CUT_WIDTH + 2 * TOP_R,
        1
      );
    });

    it('is back to the nominal span a radius below the rim', () => {
      // The arc is tangent to the cut's own side at exactly this depth, so
      // everything below it is the plain opening the user asked for.
      const z = WALL_HEIGHT - TOP_R - 0.5;
      expect(spanAtZ('u-shape', z, CUT_HEIGHT, undefined, withTop(TOP_R))).toBeCloseTo(
        CUT_WIDTH,
        2
      );
    });

    it('is a true arc between the two, not a chamfer', () => {
      // The blend's circle is centred at (span/2 + r, rim - r), so at depth d
      // below the rim the opening is still r - sqrt(r² - (r - d)²) wider per
      // side. A chamfer would close linearly instead, which is the only other
      // way to soften this corner.
      const openingAt = (depth: number): number =>
        CUT_WIDTH + 2 * (TOP_R - Math.sqrt(TOP_R * TOP_R - (TOP_R - depth) ** 2));
      for (const depth of [0.5, TOP_R / 2, TOP_R - 0.5]) {
        expect(
          spanAtZ('u-shape', WALL_HEIGHT - depth, CUT_HEIGHT, undefined, withTop(TOP_R)),
          `${depth}mm below the rim`
        ).toBeCloseTo(openingAt(depth), 1);
      }
      // The arc is tangent to the cut's own side where it lands, so it runs
      // out to nothing rather than meeting the wall at an angle: half a
      // millimetre above the landing it is 0.05mm wide, where a chamfer of the
      // same radius would still be a full 0.5mm per side.
      expect(openingAt(TOP_R - 0.5)).toBeLessThan(CUT_WIDTH + 0.2);
    });

    it('flares the funnel and the scoop the same way', () => {
      for (const shape of ['funnel', 'scoop'] as const) {
        expect(
          spanAtZ(shape, WALL_HEIGHT, CUT_HEIGHT, undefined, withTop(TOP_R)),
          shape
        ).toBeCloseTo(CUT_WIDTH + 2 * TOP_R, 1);
      }
    });

    it('squares the shoulder where no wall is left beside the cut', () => {
      // Same rule the bottom fillet follows: with zero slack the round-over
      // would carve the neighbouring wall rather than its own shoulder.
      expect(
        spanAtZ('u-shape', WALL_HEIGHT, CUT_HEIGHT, { left: 0, right: 0 }, withTop(TOP_R))
      ).toBeCloseTo(CUT_WIDTH, 2);
    });

    it('caps each shoulder by the wall left on its own side', () => {
      const slack = 2;
      expect(
        spanAtZ('u-shape', WALL_HEIGHT, CUT_HEIGHT, { left: 0, right: Infinity }, withTop(TOP_R))
      ).toBeCloseTo(CUT_WIDTH + TOP_R, 1);
      expect(
        spanAtZ('u-shape', WALL_HEIGHT, CUT_HEIGHT, { left: slack, right: slack }, withTop(TOP_R))
      ).toBeCloseTo(CUT_WIDTH + 2 * slack, 1);
    });

    it('never rounds deeper than the cut itself', () => {
      // A 5mm round on a 3mm-deep cut would reach past the floor and eat the
      // wall under the opening. The clamp keeps the blend inside the cut.
      const shallow = 3;
      const atRim = spanAtZ('u-shape', WALL_HEIGHT, shallow, undefined, withTop(TOP_R));
      expect(atRim).toBeLessThanOrEqual(CUT_WIDTH + 2 * shallow + 0.01);
    });

    it('lands the blend on the LIP top, not the wall top, when the bin has one', () => {
      // A lipped bin overshoots by LIP_HEIGHT + CUT_RIM_CLEARANCE, so the
      // highest material is 4.4mm above `wallHeight`. Round to the wall top
      // instead and the lip is left perched square on a rounded wall — and the
      // blend is 4.4mm lower than anything a screenshot would show.
      const lipped = LIP_HEIGHT + CUT_RIM_CLEARANCE;
      const lipTop = WALL_HEIGHT + LIP_HEIGHT;
      const spanAtLipped = (z: number): number =>
        withScope((scope: DisposalScope) => {
          const cut = scope.register(
            buildSingleCutout(
              'u-shape',
              CUT_WIDTH,
              CUT_HEIGHT,
              lipped,
              EXTRUDE_DEPTH,
              WALL_HEIGHT,
              CENTERED,
              undefined,
              { top: TOP_R, bottom: 0 }
            )
          );
          const slab = scope.register(
            box(-2 * CUT_WIDTH, 2 * CUT_WIDTH, -EXTRUDE_DEPTH, EXTRUDE_DEPTH, z, z + 0.001)
          );
          const clipped = intersect(cut, slab);
          expect(isOk(clipped), `slab intersection at z=${z}`).toBe(true);
          if (!isOk(clipped)) return NaN;
          const b = getBounds(scope.register(clipped.value));
          return b.xMax - b.xMin;
        });
      expect(spanAtLipped(lipTop)).toBeCloseTo(CUT_WIDTH + 2 * TOP_R, 1);
      expect(spanAtLipped(lipTop - TOP_R - 0.5)).toBeCloseTo(CUT_WIDTH, 2);
    });

    it('leaves the shoulder square by default', () => {
      // The resolved default is 0, which is what keeps every design saved
      // before this control generating the geometry it always did.
      expect(spanAtZ('u-shape', WALL_HEIGHT)).toBeCloseTo(CUT_WIDTH, 2);
      expect(spanAtZ('scoop', WALL_HEIGHT)).toBeCloseTo(CUT_WIDTH, 2);
    });

    it('rounds both ends independently of the bottom fillet', () => {
      const both: CutoutCornerRadii = { top: TOP_R, bottom: 4 };
      expect(spanAtZ('u-shape', WALL_HEIGHT, CUT_HEIGHT, undefined, both)).toBeCloseTo(
        CUT_WIDTH + 2 * TOP_R,
        1
      );
      expect(spanAtZ('u-shape', FLOOR_Z, CUT_HEIGHT, undefined, both)).toBeCloseTo(
        CUT_WIDTH - 2 * 4,
        0
      );
    });
  });
});
