import { describe, it, expect } from 'vitest';
import { hingePinLengths, planHingeLid, resolveHingeFitMm } from './hingeLidPlan';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import {
  DEFAULT_LID_HINGE_CONFIG,
  LID_HINGE_BARREL_RADIUS_MM,
  LID_HINGE_FACE_RELIEF_MM,
  LID_HINGE_FIT_MAX_MM,
  LID_HINGE_FIT_MIN_MM,
  LID_HINGE_KNUCKLE_MIN_MM,
  LID_HINGE_STOP_ANGLE_DEG,
} from '@/features/bin-designer/types/lid';
import { buildFullMask } from '@/shared/utils/cellMask';
import type { BinParams, LidHingeConfig, LidRailSide } from '@/features/bin-designer/types';

function params(over: Partial<BinParams> = {}, hinge: Partial<LidHingeConfig> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 6,
    ...over,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      ...over.lid,
      enabled: true,
      attachment: 'hinge',
      hinge: { ...DEFAULT_LID_HINGE_CONFIG, ...hinge },
    },
  };
}

describe('planHingeLid — rejections', () => {
  it('reports `disabled` rather than a fault when the lid is not hinged', () => {
    const p = params();
    const plan = planHingeLid({ ...p, lid: { ...p.lid, attachment: 'clickRails' } });
    expect(plan).toEqual({ geometry: null, rejection: 'disabled' });
  });

  it('reports `disabled` when the lid is off entirely', () => {
    const p = params();
    expect(planHingeLid({ ...p, lid: { ...p.lid, enabled: false } }).rejection).toBe('disabled');
  });

  it('refuses a custom shape, since a side name does not name a polygon edge', () => {
    // An L: a full 3x2 mask with one corner cell cleared, which is what makes
    // it PARTIAL. A full mask is still a rectangle and takes the hinge.
    const full = buildFullMask(3, 2);
    const cells = [...full.cells];
    cells[0] = 0;
    expect(planHingeLid(params({ cellMask: { ...full, cells } })).rejection).toBe(
      'unsupported-shape'
    );
    expect(planHingeLid(params({ cellMask: full })).rejection).toBeNull();
  });

  it('refuses a bin with no stacking lip — nothing to notch, nothing to catch', () => {
    const p = params();
    expect(planHingeLid({ ...p, base: { ...p.base, stackingLip: false } }).rejection).toBe(
      'no-lip'
    );
  });

  it('refuses a wall too short to hold the minimum knuckles', () => {
    // A 1u wall is 40.3mm of interior less two 3mm corner insets: comfortably
    // enough. The rejection needs a genuinely tiny grid, which is what makes it
    // worth pinning — the bound is on millimetres, not on unit count.
    expect(planHingeLid(params({ width: 1, depth: 1, gridUnitMm: 12 })).rejection).toBe(
      'wall-too-short'
    );
  });
});

describe('planHingeLid — knuckle layout', () => {
  it('lays an odd count so the BIN owns both end knuckles', () => {
    for (const width of [1, 2, 3, 5]) {
      const { geometry } = planHingeLid(params({ width }));
      const run = geometry?.runs[0];
      expect(run).toBeDefined();
      if (!run) continue;
      expect(run.knuckles.length % 2).toBe(1);
      expect(run.knuckles[0].owner).toBe('bin');
      expect(run.knuckles[run.knuckles.length - 1].owner).toBe('bin');
    }
  });

  it('tiles the run exactly, with no gap between nominal bands', () => {
    // The bands are NOMINAL — the running clearance is applied by the builder,
    // as the amount each slot cutter is grown by, and appears in exactly one
    // place. If the plan left gaps here the clearance would be counted twice.
    const run = planHingeLid(params()).geometry?.runs[0];
    expect(run).toBeDefined();
    if (!run) return;
    expect(run.knuckles[0].lo).toBeCloseTo(run.lo, 6);
    expect(run.knuckles[run.knuckles.length - 1].hi).toBeCloseTo(run.hi, 6);
    for (let i = 1; i < run.knuckles.length; i += 1) {
      expect(run.knuckles[i].lo).toBeCloseTo(run.knuckles[i - 1].hi, 6);
    }
  });

  it('never lays a knuckle narrower than the minimum', () => {
    for (const width of [1, 2, 3, 4, 6]) {
      const run = planHingeLid(params({ width })).geometry?.runs[0];
      if (!run) continue;
      for (const k of run.knuckles) {
        expect(k.hi - k.lo).toBeGreaterThanOrEqual(LID_HINGE_KNUCKLE_MIN_MM);
      }
    }
  });

  it('alternates ownership, so every lid knuckle has bin knuckles either side', () => {
    const run = planHingeLid(params()).geometry?.runs[0];
    expect(run).toBeDefined();
    if (!run) return;
    expect(run.knuckles.map((k) => k.owner)).toEqual(
      run.knuckles.map((_, i) => (i % 2 === 0 ? 'bin' : 'lid'))
    );
  });
});

describe('planHingeLid — segmentation around absences', () => {
  /**
   * Hinge on `hingeSide`, one cutout on `cutSide`.
   *
   * The two are separate arguments on purpose: an earlier version passed one
   * value to both and its "ignores a cutout on another wall" case was silently
   * re-testing the same-wall case. The master `walls.enabled` toggle also
   * activates the factory left/right cutouts, so every side is pinned
   * explicitly rather than left to the defaults.
   */
  function withCutout(hingeSide: LidRailSide, cutSide: LidRailSide, widthPct: number): BinParams {
    const p = params({}, { side: hingeSide });
    const off = { ...p.walls.left, enabled: false };
    return {
      ...p,
      walls: {
        ...p.walls,
        enabled: true,
        front: off,
        back: off,
        left: off,
        right: off,
        [cutSide]: { ...off, enabled: true, width: widthPct, depth: 60 },
      },
    };
  }

  it('splits the run either side of a wall cutout, and quotes two pins', () => {
    // A cutout takes the rim material a knuckle welds to. It costs the barrel
    // its own span and NOT its wall — CLAUDE.md gotcha #19 is explicit that
    // notching is never a whole-wall disable.
    const plan = planHingeLid(withCutout('back', 'back', 30));
    expect(plan.rejection).toBeNull();
    expect(plan.geometry?.runs).toHaveLength(2);
    expect(hingePinLengths(withCutout('back', 'back', 30))).toHaveLength(2);
  });

  it('keeps every surviving run a real hinge, not a stub', () => {
    const plan = planHingeLid(withCutout('back', 'back', 30));
    for (const run of plan.geometry?.runs ?? []) {
      expect(run.knuckles.length).toBeGreaterThanOrEqual(3);
      expect(run.knuckles[0].owner).toBe('bin');
      expect(run.knuckles[run.knuckles.length - 1].owner).toBe('bin');
    }
  });

  it('rejects only when no stretch survives', () => {
    expect(planHingeLid(withCutout('back', 'back', 95)).rejection).toBe('wall-obstructed');
  });

  it('ignores a cutout on a wall the hinge is not on', () => {
    const one = planHingeLid(withCutout('back', 'front', 30));
    expect(one.geometry?.runs).toHaveLength(1);
  });

  it('does NOT segment around dividers or label tabs', () => {
    // Both live inboard of the inner wall face and below the rim; the barrel is
    // above the rim and hard against the outer face. Which walls an obstruction
    // takes is a question about its footprint, never about its anchor — asked
    // here in the other direction and answered no.
    const p = params();
    const withTabs = planHingeLid({ ...p, label: { ...p.label, enabled: true } });
    expect(withTabs.geometry?.runs).toHaveLength(1);
    expect(withTabs.geometry?.runs[0]).toEqual(planHingeLid(p).geometry?.runs[0]);
  });
});

describe('planHingeLid — the axis', () => {
  it('insets the axis by the radius PLUS a relief, never by the radius alone', () => {
    // Exact tangency is the elegant-looking answer and a boolean hazard: the
    // cylinder would meet the wall's outer plane along a single line. The
    // relief is what keeps the footprint intact without it.
    const { geometry } = planHingeLid(params());
    expect(geometry?.axisInsetMm).toBeCloseTo(
      LID_HINGE_BARREL_RADIUS_MM + LID_HINGE_FACE_RELIEF_MM,
      6
    );
    expect(geometry?.axisInsetMm).toBeGreaterThan(LID_HINGE_BARREL_RADIUS_MM);
  });

  it('puts the axis inboard of the outer face, so the footprint cannot grow', () => {
    const p = params();
    const { geometry } = planHingeLid(p);
    expect(geometry).not.toBeNull();
    if (!geometry) return;
    // Cross half-extent of the OUTER face in the interior frame.
    const outerFace = p.depth * p.gridUnitMm - 0.5;
    expect(geometry.axisCrossMm + geometry.barrelRadiusMm).toBeLessThan(outerFace / 2);
  });

  it('derives the trim tilt from where the bin is, not from the stop alone', () => {
    // `stopAngleDeg - 90` was the first version and stops the lid ~28° early:
    // the trim face butts against the lip-top OUTER CORNER, which sits below
    // the axis, not level with it.
    const { geometry } = planHingeLid(params());
    expect(geometry).not.toBeNull();
    if (!geometry) return;
    const naive = LID_HINGE_STOP_ANGLE_DEG - 90;
    expect(geometry.trimTiltDeg).toBeLessThan(naive - 20);
    expect(geometry.trimTiltDeg).toBeCloseTo(
      naive + (Math.atan2(-geometry.axisAboveLipTopMm, geometry.axisInsetMm) * 180) / Math.PI,
      6
    );
  });

  it('sits the axis ABOVE the lip top — the plate underside, not the rim', () => {
    const { geometry } = planHingeLid(params());
    expect(geometry?.axisAboveLipTopMm).toBeGreaterThan(0);
  });
});

describe('planHingeLid — sides', () => {
  const cases: ReadonlyArray<readonly [LidRailSide, boolean, number]> = [
    ['back', true, 0],
    ['left', false, 90],
    ['front', true, 180],
    ['right', false, 270],
  ];

  it.each(cases)('maps %s to alongX=%s and rotation %d', (side, alongX, rotationDeg) => {
    const { geometry } = planHingeLid(params({}, { side }));
    expect(geometry?.alongX).toBe(alongX);
    expect(geometry?.rotationDeg).toBe(rotationDeg);
  });

  it('runs the barrel along the chosen wall, not always the long one', () => {
    // A bin faces a particular way in a drawer. Deriving the side from the
    // footprint's long axis would silently reorient half of them.
    const wide = planHingeLid(params({ width: 5, depth: 1 }, { side: 'left' })).geometry;
    expect(wide?.alongX).toBe(false);
  });

  it('puts the catch on the opposite wall', () => {
    expect(planHingeLid(params({}, { side: 'back' })).geometry?.catchSide).toBe('front');
    expect(planHingeLid(params({}, { side: 'left' })).geometry?.catchSide).toBe('right');
  });
});

describe('planHingeLid — the pin', () => {
  it('recesses the pin inside the barrel at both ends', () => {
    const { geometry } = planHingeLid(params());
    const run = geometry?.runs[0];
    expect(run).toBeDefined();
    if (!run) return;
    // A pin cut a little long and standing proud is the one visible failure of
    // an otherwise invisible joint, and it would stop two bins sitting side by
    // side.
    expect(run.pinLengthMm).toBeLessThan(run.hi - run.lo);
    expect(run.pinLengthMm).toBeGreaterThan(run.hi - run.lo - 2);
  });

  it('quotes one length per run, longest first', () => {
    const lengths = hingePinLengths(params());
    expect(lengths).toHaveLength(1);
    expect(lengths[0]).toBeGreaterThan(0);
    expect([...lengths]).toEqual([...lengths].sort((a, b) => b - a));
  });

  it('quotes nothing when there is no hinge', () => {
    const p = params();
    expect(hingePinLengths({ ...p, lid: { ...p.lid, attachment: 'friction' } })).toEqual([]);
  });

  it('grows the pin with the wall', () => {
    const short = hingePinLengths(params({ width: 2 }))[0];
    const long = hingePinLengths(params({ width: 5 }))[0];
    expect(long).toBeGreaterThan(short);
  });
});

describe('resolveHingeFitMm', () => {
  it('clamps into the range the panel offers', () => {
    expect(resolveHingeFitMm(0.01)).toBe(LID_HINGE_FIT_MIN_MM);
    expect(resolveHingeFitMm(9)).toBe(LID_HINGE_FIT_MAX_MM);
    expect(resolveHingeFitMm(0.3)).toBe(0.3);
  });

  it('falls back rather than propagating a non-finite value into geometry', () => {
    expect(Number.isFinite(resolveHingeFitMm(Number.NaN))).toBe(true);
  });
});
