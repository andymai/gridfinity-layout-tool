// @vitest-environment node
/**
 * Retention + insertion budget for the lid click rail (`attachment: 'clickRails'`,
 * issues /).
 *
 * `lidProfile.ts` is explicit that the click rails ARE the lid's retention: the
 * corner pillars sit clear of the lip, so "engagement happens on the straights
 * via the click rails." Yet the lid scenario suite only asserts rail COUNT
 * (per-side monotonic reduction) and a bounding-box "tall enough to engage"
 * sanity check — nothing pins that a rail actually catches the lip. A regression
 * that shrinks the bump (or lets the fit clearance swallow it) leaves every one
 * of those tests green while the lid just lifts off.
 *
 * The rail is a straight press-on snap: the lid drops over the bin's stacking
 * lip, and the bump's downward-facing entry chamfer cams the lip past on the way
 * down (INSERTION), after which the bump prominence sits under the lip's
 * small-taper underside to resist lift (RETENTION). The catching prominence is
 * `LID_CLICK_RAIL_INSET` — the entry chamfer steps the bump face from
 * `LID_CLICK_RAIL_OUT` inward to `OUT − INSET`, so the outermost lip a lid can
 * hook under overhangs the body by exactly `INSET`.
 *
 * Modeled as a pure geometric budget (no kernel) — the same altitude as
 * `snapClipInsertion.test.ts` — because the honest, frame-unambiguous contract
 * is the constant relationship, not a lid↔bin assembly whose transform would
 * have to be re-derived.
 */
import { describe, it, expect } from 'vitest';
import {
  LID_CLICK_RAIL_OUT,
  LID_CLICK_RAIL_INSET,
  LID_CLICK_RAIL_ENTRY_CHAMFER,
  LID_CLICK_RAIL_EXIT_CHAMFER,
  LID_CLICK_RAIL_BUMP,
  LID_CLICK_RAIL_INNER,
  LID_CLICK_RAIL_TOP_CHAMFER,
  LID_FIT_CLEARANCE,
} from './lidConstants';

/** Net radial catch left after the lid↔lip fit clearance is spent (mm). */
const catchDepth = (inset: number, clearance: number): number => inset - clearance;

/** Entry-chamfer slope as a ratio (vertical rise / horizontal run of the bump). */
const rampRatio = (entryChamfer: number, inset: number): number => entryChamfer / inset;

/**
 * Minimum net catch that FDM reliably resolves and that gives a firm, removable
 * snap. Matches the snap clip's proven ledge floor — below this the
 * lip pops out under its own weight.
 */
const MIN_CATCH = 0.15;

describe('lid click-rail retention + insertion budget (issues #2694 / #2712)', () => {
  it('leaves a real catch under the lip after the fit clearance', () => {
    // The bump prominence (INSET) must exceed the lid↔lip clearance with margin,
    // or the lip never seats under an overhang and the lid lifts straight off.
    expect(catchDepth(LID_CLICK_RAIL_INSET, LID_FIT_CLEARANCE)).toBeGreaterThanOrEqual(MIN_CATCH);
  });

  it('presents an insertion lead-in ramp, not a vertical cliff', () => {
    // The lip cams past the bump on this chamfer during press-on. A zero (or
    // near-zero) entry chamfer is a wall the lid can't climb; a huge one erases
    // the bump. Keep the ramp a genuine chamfer (~27°–63° off horizontal).
    expect(LID_CLICK_RAIL_ENTRY_CHAMFER).toBeGreaterThan(0);
    const ratio = rampRatio(LID_CLICK_RAIL_ENTRY_CHAMFER, LID_CLICK_RAIL_INSET);
    expect(ratio).toBeGreaterThanOrEqual(0.5);
    expect(ratio).toBeLessThanOrEqual(2);
    // A top chamfer lets the lid start onto the rail squarely.
    expect(LID_CLICK_RAIL_TOP_CHAMFER).toBeGreaterThan(0);
  });

  it('gives the catch vertical body and a controlled release', () => {
    // Below the entry chamfer the bump has a vertical face where the lip seats;
    // a knife-edge bump would shear or skip. The exit chamfer releases it.
    expect(LID_CLICK_RAIL_BUMP).toBeGreaterThanOrEqual(0.4);
    expect(LID_CLICK_RAIL_EXIT_CHAMFER).toBeGreaterThan(0);
  });

  it('keeps a non-degenerate bump that reaches into the cavity to grip', () => {
    // The bump apex (OUT) must stand proud of the body (OUT − INSET), and the
    // body must stay outboard of the spine; the inner shelf pushes into the
    // cavity for grip (negative = past the spine).
    expect(LID_CLICK_RAIL_OUT).toBeGreaterThan(LID_CLICK_RAIL_INSET);
    expect(LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET).toBeGreaterThan(0);
    expect(LID_CLICK_RAIL_INNER).toBeLessThan(0);
  });

  it('rejects a bump the fit clearance would swallow (sensitivity proof)', () => {
    // A 0.2mm bump against the 0.25mm clearance leaves a NEGATIVE catch — the lip
    // seats above the bump and the lid falls off. The budget must fail it, or it
    // isn't guarding the regression class it claims to.
    expect(catchDepth(0.2, LID_FIT_CLEARANCE)).toBeLessThan(MIN_CATCH);
  });
});
