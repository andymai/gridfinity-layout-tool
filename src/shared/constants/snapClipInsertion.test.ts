import { describe, it, expect } from 'vitest';
import { SNAP_CLIP, SNAP_CLIP_CLEARANCE, effectiveClearance, snapClipLevels } from './connectors';

/**
 * Insertion-feasibility budget for the snap clip (issue #2638).
 *
 * To pass the pocket throat, each barb must deflect inward by
 * `BARB_DEPTH − clearance`. The leg pivots at the bridge root; with the
 * seam-side retaining wall nested in the flex slot, rigid rotation is capped by
 * `slot gap / wall-contact depth`, and the cap is tightest when the wall top
 * first enters the slot near the leg tips. #2162 shipped a wall that filled the
 * slot to `GAP_HALF − clearance` — 0.1mm of pinch room against 0.35mm needed —
 * so the clip physically could not be inserted (field report: "It simply
 * doesn't go in"). The seated-fit and pull-apart kernel tests never exercised
 * the insertion PATH; this model does, and pins the budget so the class of bug
 * can't ship again.
 *
 * Model (quasi-static, rigid legs, worst case over the stroke): at clip
 * descent `offset` (clip top above plate top by `offset`), the wall occupies
 * clip-frame band [−BRIDGE_THK − offset, bearBottomZ − offset], clamped to the
 * slot [−legBottom, −BRIDGE_THK]. The deepest in-slot contact point, at depth
 * `d` below the bridge-root pivot, caps rotation at `slotGap / d`; available
 * deflection at the barb is that rotation × the barb's own depth below the
 * pivot. Leg bending below the contact adds only ~0.01mm at printable strains
 * (the legs are short and stubby), so the rigid model is the honest budget.
 */

interface ClipConfig {
  gapHalf: number;
  wallX: number;
  barbDepth: number;
  clearance: number;
  bridgeThk: number;
  bearDepth: number;
  legBottom: number;
  apexFromTip: number;
  catchDrop: number;
}

function fromLevels(totalHeight: number): ClipConfig {
  const lv = snapClipLevels(totalHeight, 0);
  return {
    gapHalf: SNAP_CLIP.GAP_HALF,
    wallX: lv.bearWallX,
    barbDepth: lv.barbTip - lv.legOuter,
    clearance: lv.cl,
    bridgeThk: SNAP_CLIP.BRIDGE_THK,
    bearDepth: SNAP_CLIP.BEAR_DEPTH,
    legBottom: lv.legBottom,
    apexFromTip: SNAP_CLIP.BARB_APEX_FROM_TIP,
    catchDrop: SNAP_CLIP.CATCH_DROP,
  };
}

/** Worst-case available barb deflection over the insertion stroke (mm/side). */
function worstAvailableDeflection(c: ClipConfig): number {
  const apexZ = -(c.legBottom - c.apexFromTip);
  const apexDepth = -apexZ - c.bridgeThk;
  const slotGap = c.gapHalf - c.wallX;
  const bearBottomZ = Math.max(-(c.bridgeThk + c.bearDepth), apexZ + c.catchDrop);
  // Pinch is required while the barb apex is inside the throat: from entering
  // at the top until it passes the catch ledge.
  const offsetStart = Math.min(-apexZ, c.legBottom - c.bridgeThk);
  const offsetEnd = c.catchDrop;
  let worst = Infinity;
  for (let offset = offsetStart; offset >= offsetEnd; offset -= 0.05) {
    const bandTop = -c.bridgeThk - offset;
    if (bandTop < -c.legBottom) continue; // wall entirely below the legs — no contact yet
    const deepest = Math.max(bearBottomZ - offset, -c.legBottom);
    const d = -deepest - c.bridgeThk;
    if (d <= 0) continue;
    worst = Math.min(worst, (slotGap / d) * apexDepth);
  }
  return worst;
}

const neededPinch = (c: ClipConfig): number => c.barbDepth - c.clearance;

/** Design safety factor over the rigid-rotation budget. */
const SAFETY = 1.15;

describe('snap-clip insertion feasibility (issue #2638)', () => {
  it.each([
    // 4.1 is the theoretical MIN_LEG boundary but float noise tips its
    // viability check; 4.2 is the thinnest slab that is robustly viable.
    ['minimum viable slab', 4.2],
    ['plain socket-height slab', 5],
    ['magnet slab', 7.4],
  ])('the barb pinch fits the deflection budget on a %s (H=%s)', (_label, H) => {
    const c = fromLevels(H);
    expect(snapClipLevels(H, 0).viable).toBe(true);
    expect(worstAvailableDeflection(c)).toBeGreaterThanOrEqual(neededPinch(c) * SAFETY);
  });

  it('rejects the #2162 geometry the field reported as uninsertable', () => {
    // Wall out to GAP_HALF − clearance and the original 0.45 barb: 0.1mm of
    // pinch room against 0.35 needed. The model must fail it — this is the
    // sensitivity proof that the budget catches the bug class.
    const cl = effectiveClearance(SNAP_CLIP_CLEARANCE, 0);
    const c: ClipConfig = {
      ...fromLevels(5),
      wallX: SNAP_CLIP.GAP_HALF - cl,
      barbDepth: 0.45,
    };
    expect(worstAvailableDeflection(c)).toBeLessThan(neededPinch(c));
  });

  it('accepts the pre-wall #2055 geometry that did insert', () => {
    // No wall at all (slot gap = GAP_HALF) with the original 0.45 barb — the
    // clip that shipped first and clicked in. The model must pass it, or it
    // would be rejecting geometry known to work.
    const c: ClipConfig = { ...fromLevels(5), wallX: 0, barbDepth: 0.45 };
    expect(worstAvailableDeflection(c)).toBeGreaterThanOrEqual(neededPinch(c) * SAFETY);
  });

  it('keeps a real ledge engagement after clearance', () => {
    const c = fromLevels(5);
    expect(neededPinch(c)).toBeGreaterThanOrEqual(0.15);
  });

  it('keeps the lead-in short of the tip so the profile cannot degenerate', () => {
    // LEAD_DROP == BARB_APEX_FROM_TIP would put the lead face's end exactly on
    // the leg tip corner — coincident profile points, an OCCT wire failure.
    expect(SNAP_CLIP.LEAD_DROP).toBeLessThan(SNAP_CLIP.BARB_APEX_FROM_TIP);
  });
});
