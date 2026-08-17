import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import {
  LID_CORNER_RADIUS,
  LID_FIT_CLEARANCE,
  LID_TRAY_FLOOR,
  resolveLidFootprintClearance,
  resolveLidPlateThickness,
  retentionBossRadius,
} from '@/shared/types/bin';
import type { BinParams, LidConfig } from '@/shared/types/bin';
import {
  LID_CUTOUT_WALL_MARGIN_MM,
  lidCutoutHitsKeepout,
  lidCutoutHostFace,
  lidCutoutInWindow,
  lidCutoutWindow,
  lidCutoutsAllowed,
} from './lidCutoutPlan';

function params(lid: Partial<LidConfig> = {}, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...extra,
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, ...lid },
  };
}

describe('lidCutoutsAllowed', () => {
  it('allows a plain enabled lid', () => {
    expect(lidCutoutsAllowed(params())).toBe(true);
  });

  it('refuses a disabled lid', () => {
    expect(lidCutoutsAllowed(params({ enabled: false }))).toBe(false);
  });

  it('refuses a bin with no stacking lip — there is nothing for the lid to grip', () => {
    const p = params({}, { base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } });
    expect(lidCutoutsAllowed(p)).toBe(false);
  });

  it('refuses a FULL stack grid but allows the lip-only variant', () => {
    // The same split lid text makes: a full grid owns the top face, a lip-only
    // one leaves the recessed floor inside the lip as one clear face.
    expect(lidCutoutsAllowed(params({ stackableTop: true, stackLipOnly: false }))).toBe(false);
    expect(lidCutoutsAllowed(params({ stackableTop: true, stackLipOnly: true }))).toBe(true);
  });

  it('refuses a polygon lid', () => {
    const p = params({}, { cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] } });
    expect(lidCutoutsAllowed(p)).toBe(false);
  });
});

describe('lidCutoutHostFace', () => {
  it('measures the whole plate from Z=0 on a plain lid', () => {
    const p = params();
    const host = lidCutoutHostFace(p);
    expect(host.topZ).toBe(0);
    expect(host.thickness).toBe(resolveLidPlateThickness(p));
  });

  it("starts at a tray's recessed floor and clears only the material under it", () => {
    // The recess owns the visible surface once it exists, so a hole through a tray
    // lid must not be sized against the pre-recess plate — that would cut through
    // the tray and out the bottom of the lid.
    const depthMm = 5;
    const p = params({ tray: { enabled: true, depthMm, wallMm: 2 }, stackableTop: false });
    const host = lidCutoutHostFace(p);
    expect(host.topZ).toBe(-depthMm);
    // `resolveLidPlateThickness` folds the recess into the plate as
    // `depth + max(topThicknessMm, LID_TRAY_FLOOR)`, so what is left is the tray's
    // own floor.
    expect(host.thickness).toBeCloseTo(Math.max(p.lid.topThicknessMm, LID_TRAY_FLOOR), 5);
    expect(host.thickness).toBeLessThan(resolveLidPlateThickness(p));
  });

  it('ignores a tray recess that the stack grid has overridden', () => {
    // `resolveLidInputs` forces the tray off when the lid is stackable, so the
    // host face must not honour it either or the two would size holes differently.
    const p = params({ tray: { enabled: true, depthMm: 5, wallMm: 2 }, stackableTop: true });
    expect(lidCutoutHostFace(p).topZ).toBe(0);
  });
});

describe('lidCutoutWindow', () => {
  it('is null whenever the gate refuses', () => {
    expect(lidCutoutWindow(params({ enabled: false }))).toBeNull();
    expect(lidCutoutWindow(params({ stackableTop: true, stackLipOnly: false }))).toBeNull();
  });

  it('spans the mating cavity, not the lid plate', () => {
    const p = params({}, { width: 2, depth: 3 });
    const w = lidCutoutWindow(p);
    expect(w).not.toBeNull();

    const fit = resolveLidFootprintClearance(p);
    const lidOuterW = 2 * p.gridUnitMm - 2 * fit;
    const lidOuterD = 3 * p.gridUnitMm - 2 * fit;
    // Cavity inset is a constant `LID_CORNER_RADIUS - fitClearance` at every Z
    // (`buildMatingShell` holds the inner face there), plus the printability band.
    const inset = LID_CORNER_RADIUS - fit + LID_CUTOUT_WALL_MARGIN_MM;
    expect(w!.spanW).toBeCloseTo(lidOuterW - 2 * inset, 5);
    expect(w!.spanD).toBeCloseTo(lidOuterD - 2 * inset, 5);
    // The point of the whole exercise: strictly inside the plate.
    expect(w!.spanW).toBeLessThan(lidOuterW);
  });

  it('is centred when overhang is symmetric or absent', () => {
    const w = lidCutoutWindow(params());
    expect(w!.offsetX).toBe(0);
    expect(w!.offsetY).toBe(0);
  });

  it('travels with an asymmetric overhang, because the lid perimeter does', () => {
    // The lid wraps the bin's overhang-shifted lip. A window left on the nominal
    // centre would put every hole off-centre by the asymmetry.
    const p = params(
      {},
      {
        overhang: { enabled: true, left: 0, right: 6, front: 0, back: 0, feet: false },
      }
    );
    const w = lidCutoutWindow(p);
    expect(w!.offsetX).toBeCloseTo(3, 5);
    expect(w!.offsetY).toBe(0);
    // ...and grows, rather than merely sliding.
    expect(w!.spanW).toBeCloseTo(lidCutoutWindow(params())!.spanW + 6, 5);
  });

  it('carries no keepouts on a friction or click-rail lid', () => {
    expect(lidCutoutWindow(params({ attachment: 'clickRails' }))!.keepouts).toEqual([]);
    expect(lidCutoutWindow(params({ attachment: 'friction' }))!.keepouts).toEqual([]);
  });

  it('carries one keepout per retention magnet, inside the window', () => {
    const p = params({ attachment: 'magnetic' }, { width: 2, depth: 2 });
    const w = lidCutoutWindow(p);
    expect(w!.keepouts).toHaveLength(4);
    for (const k of w!.keepouts) {
      // Placed in the window frame, and big enough to be the boss plus a margin.
      expect(k.x).toBeGreaterThan(0);
      expect(k.y).toBeGreaterThan(0);
      expect(k.x).toBeLessThan(w!.spanW);
      expect(k.y).toBeLessThan(w!.spanD);
      expect(k.r).toBeGreaterThan(retentionBossRadius(p.lid.retentionMagnet.diameter));
    }
  });

  it('adds keepouts for edge magnets on a lid long enough to take them', () => {
    const four = lidCutoutWindow(params({ attachment: 'magnetic' }, { width: 5, depth: 1 }))!
      .keepouts.length;
    const withEdges = lidCutoutWindow(
      params(
        {
          attachment: 'magnetic',
          retentionMagnet: { ...DEFAULT_BIN_PARAMS.lid.retentionMagnet, edgeMagnets: 2 },
        },
        { width: 5, depth: 1 }
      )
    )!.keepouts.length;
    // Routed through the real placement function, so the spacing rule that decides
    // how many actually fit is the one the worker uses.
    expect(withEdges).toBeGreaterThan(four);
  });

  it('is the same width whatever the attachment costs in fit clearance', () => {
    // Not a coincidence, and worth pinning: the fit clearance CANCELS. The outer
    // footprint shrinks by it and the cavity inset (`LID_CORNER_RADIUS -
    // fitClearance`) grows by the same amount, leaving
    // `span = width * pitch - 2 * LID_CORNER_RADIUS - 2 * margin`.
    //
    // So a magnetic lid, which pays an extra LID_MAGNETIC_EXTRA_CLEARANCE per side,
    // still offers exactly the drawable area a click-rail lid does — switching
    // attachment mode cannot silently move a user's holes.
    const magnetic = params({ attachment: 'magnetic' });
    const rails = params({ attachment: 'clickRails' });
    expect(resolveLidFootprintClearance(magnetic)).toBeGreaterThan(LID_FIT_CLEARANCE);
    expect(resolveLidFootprintClearance(rails)).toBe(LID_FIT_CLEARANCE);

    const w = lidCutoutWindow(magnetic)!;
    expect(w.spanW).toBeCloseTo(lidCutoutWindow(rails)!.spanW, 5);
    expect(w.spanW).toBeCloseTo(
      magnetic.width * magnetic.gridUnitMm - 2 * LID_CORNER_RADIUS - 2 * LID_CUTOUT_WALL_MARGIN_MM,
      5
    );
  });
});

describe('placement checks', () => {
  const window = lidCutoutWindow(params({ attachment: 'magnetic' }, { width: 2, depth: 2 }))!;

  it('accepts bounds inside the span and rejects bounds over an edge', () => {
    expect(lidCutoutInWindow({ x: 1, y: 1, width: 5, depth: 5 }, window)).toBe(true);
    expect(lidCutoutInWindow({ x: -0.5, y: 1, width: 5, depth: 5 }, window)).toBe(false);
    expect(lidCutoutInWindow({ x: window.spanW - 1, y: 1, width: 5, depth: 5 }, window)).toBe(
      false
    );
  });

  it('flags bounds that reach a boss and clears bounds that do not', () => {
    const boss = window.keepouts[0];
    expect(lidCutoutHitsKeepout({ x: boss.x - 1, y: boss.y - 1, width: 2, depth: 2 }, window)).toBe(
      true
    );
    // Dead centre of a 1x1-ish window is clear of every corner boss.
    expect(
      lidCutoutHitsKeepout(
        { x: window.spanW / 2 - 1, y: window.spanD / 2 - 1, width: 2, depth: 2 },
        window
      )
    ).toBe(false);
  });

  it('measures the boss distance from the nearest point of the bounds, not the centre', () => {
    // A long slot whose centre is far from a boss still hits it if an end reaches.
    // Testing the centre would pass this and the lid would lose its magnet.
    const boss = window.keepouts[0];
    const slot = { x: boss.x - 0.5, y: boss.y - 0.5, width: window.spanW / 2, depth: 1 };
    expect(lidCutoutHitsKeepout(slot, window)).toBe(true);
  });
});
