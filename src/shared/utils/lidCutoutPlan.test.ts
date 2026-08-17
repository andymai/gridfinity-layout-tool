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
  lidCutoutHostFace,
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

  it('refuses a base-only bin, which never gets a lid at all', () => {
    // `shouldGenerateLid` refuses a tile (no cavity to close), so offering the
    // editor for a part that is never built is worse than refusing.
    const p = params({}, { base: { ...DEFAULT_BIN_PARAMS.base, tile: true } });
    expect(lidCutoutsAllowed(p)).toBe(false);
  });

  it('refuses a lid carrying stack magnet pockets', () => {
    // The pockets are blind cups in this same plate; a hole across one opens it
    // laterally and the magnet falls out, watertight and unnoticed.
    const p = params({ stackableTop: true, stackLipOnly: true, magnetHoles: true });
    expect(lidCutoutsAllowed(p)).toBe(false);
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

  it('narrows to the tray floor, not the cavity, on a wide-rimmed tray lid', () => {
    // The host face drops to the recess floor, so a window still spanning the
    // cavity would put its outer ring UNDER the rim: a slot there cuts the plate
    // out from beneath the wall and leaves it bridging a void.
    const wallMm = 8;
    const tray = params({ tray: { enabled: true, depthMm: 4, wallMm }, stackableTop: false });
    const plain = lidCutoutWindow(params())!;
    const withTray = lidCutoutWindow(tray)!;
    expect(withTray.spanW).toBeLessThan(plain.spanW);
    // Bounded by the rim once it is wider than the cavity inset.
    const fit = resolveLidFootprintClearance(tray);
    const outerW = tray.width * tray.gridUnitMm - 2 * fit;
    expect(withTray.spanW).toBeCloseTo(outerW - 2 * (wallMm + LID_CUTOUT_WALL_MARGIN_MM), 5);
  });

  it('leaves a narrow tray rim alone, since the cavity is the tighter bound', () => {
    const tray = params({ tray: { enabled: true, depthMm: 4, wallMm: 2 }, stackableTop: false });
    expect(lidCutoutWindow(tray)!.spanW).toBeCloseTo(lidCutoutWindow(params())!.spanW, 5);
  });

  it('anchors a lip-only stack top on the grid, so overhang does not shift it', () => {
    // That floor is cut from the nominal socket grid and does not move with the
    // perimeter. A perimeter-derived window would run over the stacking lip ring,
    // whose only attachment to the lid is the plate the cut removes.
    const lipOnly: Partial<LidConfig> = { stackableTop: true, stackLipOnly: true };
    const plain = lidCutoutWindow(params(lipOnly))!;
    const overhung = lidCutoutWindow(
      params(lipOnly, {
        overhang: { enabled: true, left: 0, right: 6, front: 0, back: 0, feet: false },
      })
    )!;
    expect(overhung.offsetX).toBe(0);
    expect(overhung.spanW).toBeCloseTo(plain.spanW, 5);
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
