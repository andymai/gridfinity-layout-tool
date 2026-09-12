// @vitest-environment node
/**
 * Retention + insertion budget for the lid click rail (`attachment: 'clickRails'`).
 *
 * This used to score the rail against the fit clearance alone — "the bump
 * stands proud by `INSET`, `INSET` beats the clearance, ship it" — which is a
 * claim about two numbers that never mentions the lip. #4207 shipped past it
 * once (the bump reaching 2.70mm inset, past the lip's 2.6mm maximum), and the
 * profile that replaced it failed the same way in the opposite direction: every
 * face of the rail sat 0.25mm to 0.6mm INSIDE the lip along the rail's whole
 * length, a press fit the lid could not seat at all, still green here.
 *
 * So the budget is now stated against the lip's own profile. The rail's top
 * face lands at `z = LIP_SMALL_TAPER` above the bin's wall top (see
 * `clickRailProfile`), which makes every point of the cross-section addressable
 * in bin coordinates without building a solid — the same altitude as before,
 * but measuring the thing that actually decides whether the lid works.
 *
 * `lidClickRailSeating.scenario.test.ts` is the paired check on real solids.
 */
import { describe, it, expect } from 'vitest';
import {
  clickRailProfile,
  LID_CLICK_RAIL_CATCH_DEPTH,
  LID_CLICK_RAIL_CATCH_GAP,
  LID_CLICK_RAIL_SHANK_CLEARANCE,
  LID_CLICK_RAIL_MIN_CATCH,
  LID_CLICK_RAIL_DROP_BELOW_WALL,
  LID_CLICK_RAIL_INNER,
  LID_CORNER_RADIUS,
  LID_FIT_CLEARANCE,
  LID_SNAP_PLUG_CLEARANCE,
} from './lidConstants';
import { GRIDFINITY_SPEC as G } from '@/shared/printSettings/gridfinityGeometry';

/** The spine every real rail placement uses (`resolveLidInputs`). */
const SPINE = LID_CORNER_RADIUS - LID_FIT_CLEARANCE;
/** The stock bin this is all aimed at. */
const STOCK_WALL = 1.2;
/** What `resolveLidMateRelief` hands a snap-fit lid on such a bin. */
const RELIEF = LID_SNAP_PLUG_CLEARANCE;

/** Inset from the bin's outer wall face to the lip's inner boundary at `z`. */
function lipInsetAt(z: number, wallThickness: number): number {
  const throat = G.LIP_SMALL_TAPER + G.LIP_BIG_TAPER;
  if (z >= G.LIP_SMALL_TAPER) return G.LIP_BIG_TAPER;
  if (z >= 0) return G.LIP_BIG_TAPER + (G.LIP_SMALL_TAPER - z);
  if (z >= -G.LIP_SUPPORT_DROP) return throat;
  // The 45 degree support, until it dies into the bin's own cavity face.
  return Math.max(wallThickness, throat + (z + G.LIP_SUPPORT_DROP));
}

/** Bin-relative inset of the rail's outer face at drop `d` below its own top. */
function railInsetAt(d: number, p: ReturnType<typeof clickRailProfile>, spine: number): number {
  const at = (x: number): number => spine - x;
  if (d <= p.flareDrop) {
    const t = p.flareDrop === 0 ? 1 : d / p.flareDrop;
    return at(p.flareX + (p.shankX - p.flareX) * t);
  }
  if (d <= p.catchTopDrop) return at(p.shankX);
  if (d <= p.catchBottomDrop) {
    const t = (d - p.catchTopDrop) / (p.catchBottomDrop - p.catchTopDrop);
    return at(p.shankX + (p.catchX - p.shankX) * t);
  }
  const t = (d - p.catchBottomDrop) / (p.bottomDrop - p.catchBottomDrop);
  return at(p.catchX + (p.leadInX - p.catchX) * t);
}

/** Bin-relative z of the rail's outer face at drop `d` below its own top. */
const railZAt = (d: number): number => G.LIP_SMALL_TAPER - d;

describe('lid click-rail retention + insertion budget', () => {
  const stock = clickRailProfile(SPINE, STOCK_WALL, RELIEF);

  it('reaches under the lip, not into it', () => {
    // The whole point: the nub's outer face is radially PROUD of the throat,
    // so there is lip material directly above it to hook.
    const throat = G.LIP_SMALL_TAPER + G.LIP_BIG_TAPER;
    const nubInset = SPINE - stock.catchX;
    expect(throat - nubInset).toBeCloseTo(LID_CLICK_RAIL_CATCH_DEPTH, 6);
    expect(stock.catchDepth).toBeCloseTo(LID_CLICK_RAIL_CATCH_DEPTH, 6);
    expect(stock.catchDepth).toBeGreaterThanOrEqual(LID_CLICK_RAIL_MIN_CATCH);
  });

  it('clears the lip everywhere on the way down', () => {
    // The regression that motivated this file. Above the nub's own top face the
    // rail is in transit and must not touch the lip at any height; sweeping the
    // profile is what a two-constant budget could not do.
    for (let d = 0; d <= stock.catchBottomDrop; d += 0.01) {
      const clearance = railInsetAt(d, stock, SPINE) - lipInsetAt(railZAt(d), STOCK_WALL);
      expect(clearance).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('seats the catch under the lip with slack, not interference', () => {
    // The nub's top face is one gap below the support it beds against, so the
    // lid registers on its plug and the snap takes up only when pulled.
    const nubZ = railZAt(stock.catchBottomDrop);
    const supportZ = -(G.LIP_SUPPORT_DROP + stock.catchDepth);
    expect(supportZ - nubZ).toBeCloseTo(LID_CLICK_RAIL_CATCH_GAP, 6);
    expect(nubZ).toBeLessThan(-G.LIP_SUPPORT_DROP);
  });

  it('beds the catch face flat against the support, not on a corner', () => {
    // Both are 45 degrees, so the contact is a face over the full catch depth.
    // The nub stands OUTBOARD of the shank, so the run is `catchX - shankX`.
    const run = stock.catchX - stock.shankX;
    const rise = stock.catchBottomDrop - stock.catchTopDrop;
    expect(rise).toBeCloseTo(run, 6);
    expect(run).toBeGreaterThan(0);
  });

  it('presents an insertion lead-in ramp, not a vertical cliff', () => {
    // The lip's throat corner rides this on the way down and pushes the rail
    // inboard. Keep it a genuine ramp (~27-63 degrees off horizontal).
    const run = stock.catchX - stock.leadInX;
    const rise = stock.bottomDrop - stock.catchBottomDrop;
    expect(run).toBeGreaterThan(0);
    expect(rise / run).toBeGreaterThanOrEqual(0.5);
    expect(rise / run).toBeLessThanOrEqual(2);
  });

  it('joins the plug wall on a 45 degree flare, not a square ledge', () => {
    // The rail's shank is set back from the wall's outer face by the lip's
    // small taper plus the shank clearance. Stepping across that gap squarely
    // leaves a horizontal ledge on the rail's root — a 90 degree overhang
    // printed skirt-down, and a stress riser right where the catch levers.
    expect(stock.flareDrop).toBeCloseTo(stock.flareX - stock.shankX, 6);
    expect(stock.flareDrop).toBeGreaterThan(0);
    // It lands on the wall's own face, so the two are flush at the seam.
    expect(SPINE - stock.flareX).toBeCloseTo(G.LIP_BIG_TAPER + RELIEF, 6);
    // And being 45 degrees it runs parallel to the lip's small taper, which is
    // the face it passes — so the gap there is constant rather than pinching.
    const gapAt = (d: number): number =>
      railInsetAt(d, stock, SPINE) - lipInsetAt(railZAt(d), STOCK_WALL);
    expect(gapAt(0.01)).toBeCloseTo(gapAt(stock.flareDrop - 0.01), 3);
  });

  it('holds the reservation every bin-side keep-out is cut against', () => {
    expect(stock.bottomDrop).toBe(LID_CLICK_RAIL_DROP_BELOW_WALL);
    expect(stock.leadInX).toBeGreaterThan(LID_CLICK_RAIL_INNER);
  });

  it('gives back the catch a thick-walled bin has no pocket for', () => {
    // The support dies into the cavity face, so these bins have little or no
    // undercut. Aiming the nub at it anyway is how a lid stops seating.
    const thick = clickRailProfile(SPINE, 2.4, RELIEF);
    expect(thick.catchDepth).toBe(0);
    expect(SPINE - thick.catchX).toBeGreaterThanOrEqual(2.4);
    for (let d = 0; d <= thick.catchBottomDrop; d += 0.01) {
      expect(railInsetAt(d, thick, SPINE) - lipInsetAt(railZAt(d), 2.4)).toBeGreaterThanOrEqual(
        -1e-9
      );
    }
  });

  it('tracks the pocket a mid-thickness wall leaves (sensitivity proof)', () => {
    // The clamp bites once the wall reaches past `throat - CATCH_DEPTH` less the
    // shank clearance, i.e. above 2.1mm. At 2.2mm the support dies at u=2.2, so
    // the nominal nub would sit 0.1mm inside the wall and the profile has to
    // take that off rather than keep its nominal number. A 1.8mm wall still
    // clears it — the pocket reaches out past where the nub wants to be.
    expect(clickRailProfile(SPINE, 1.8, RELIEF).catchDepth).toBeCloseTo(
      LID_CLICK_RAIL_CATCH_DEPTH,
      6
    );

    const mid = clickRailProfile(SPINE, 2.2, RELIEF);
    expect(mid.catchDepth).toBeLessThan(LID_CLICK_RAIL_CATCH_DEPTH);
    expect(mid.catchDepth).toBeGreaterThanOrEqual(LID_CLICK_RAIL_MIN_CATCH);
    expect(SPINE - mid.catchX).toBeCloseTo(2.2 + LID_CLICK_RAIL_SHANK_CLEARANCE, 6);
  });
});
