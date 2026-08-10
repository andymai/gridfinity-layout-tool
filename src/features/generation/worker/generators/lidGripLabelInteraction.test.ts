/**
 * Grip relief vs label-tab segmentation (#3401).
 *
 * `splitRailsAroundGrip` matched a rail to its grip on exact centre equality.
 * That held only while every rail was centred on its wall. Once a rail is
 * clipped short of a label tab, or split into the gaps between tabs, its
 * centre moves and the match silently fails: the rail is passed through whole
 * and the grip's requested snap-softening does not happen.
 *
 * Nothing about the resulting lid looks wrong — it is a valid solid with a
 * relief and a rail, just a rail that was supposed to give way and does not.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { railPlacements, splitRailsAroundGrip } from './lidClickRail';
import { resolveLidInputs } from './lidInputs';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

/**
 * A lid whose grip relief is set to soften the snap, optionally with label
 * tabs. `binDip` is what gates `gripSoftensSnap`, so it has to be on.
 */
function makeParams(label: Partial<BinParams['label']> | null): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 4,
    depth: 3,
    height: 6,
    label: label
      ? { ...DEFAULT_BIN_PARAMS.label, enabled: true, depth: 12, ...label }
      : DEFAULT_BIN_PARAMS.label,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      clickRailCoverage: 100,
      grip: {
        ...DEFAULT_BIN_PARAMS.lid.grip,
        mode: 'scallop',
        sides: { front: true, back: false, left: false, right: false },
        binDip: true,
      },
    },
  };
}

/** Front-wall rails (rotation 180) after the grip pass. */
function frontRails(params: BinParams) {
  const inputs = resolveLidInputs(params);
  return splitRailsAroundGrip(railPlacements(inputs), inputs).filter((p) => p.rotationDeg === 180);
}

describe('grip relief interrupts rails that label tabs have moved', () => {
  it('splits the front rail on a bin with no label tabs', () => {
    // Baseline: a centred rail matches its grip and is interrupted.
    expect(frontRails(makeParams(null)).length).toBeGreaterThan(1);
  });

  it('still splits the front rail when a front tab has shortened it', () => {
    // A narrow front tab leaves stretches either side of itself, and the grip
    // sits on that same wall. Each surviving stretch that runs behind the grip
    // has to give way, exactly as the whole rail did.
    const rails = frontRails(makeParams({ edges: 'front', width: 40, alignment: 'center' }));
    expect(rails.length).toBeGreaterThan(0);
    const gripSpan = resolveLidInputs(
      makeParams({ edges: 'front', width: 40, alignment: 'center' })
    ).grip;
    expect(gripSpan.mode).toBe('scallop');
    // No surviving rail may straddle the wall centre, which is where the grip
    // is. A rail that skipped its split would.
    for (const r of rails) {
      const half = r.length / 2;
      expect(Math.abs(r.centerX) > half).toBe(true);
    }
  });

  it('still splits the side rails when a back tab has clipped them', () => {
    // The clip from #3404 alone moves a rail's centre, so this path is
    // reachable without partial rails at all.
    const params: BinParams = {
      ...makeParams({ edges: 'back', width: 100 }),
      lid: {
        ...makeParams({ edges: 'back', width: 100 }).lid,
        grip: {
          ...DEFAULT_BIN_PARAMS.lid.grip,
          mode: 'scallop',
          sides: { front: false, back: false, left: true, right: false },
          binDip: true,
        },
      },
    };
    const inputs = resolveLidInputs(params);
    const left = splitRailsAroundGrip(railPlacements(inputs), inputs).filter(
      (p) => p.rotationDeg === 90
    );
    expect(left.length).toBeGreaterThan(0);
    for (const r of left) {
      const half = r.length / 2;
      expect(Math.abs(r.centerY) > half).toBe(true);
    }
  });
});
