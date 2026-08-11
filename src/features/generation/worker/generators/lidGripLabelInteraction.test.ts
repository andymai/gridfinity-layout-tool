/**
 * Grip relief vs label-tab segmentation (#3401).
 *
 * `splitRailsAroundGrip` matched a rail to its grip on exact centre equality.
 * That held only while every rail was centred on its wall. Once a rail is
 * clipped short of a label tab, or split into the gaps between tabs, its
 * centre moves and the match silently fails: the rail is passed through whole
 * and the grip's requested snap-softening does not happen.
 *
 * Nothing about the resulting lid looks wrong: it is a valid solid with a
 * relief and a rail, just a rail that was supposed to give way and does not.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { railPlacements, splitRailsAroundGrip } from './lidClickRail';
import { resolveLidInputs } from './lidInputs';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';

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

describe('grip reliefs stay on their own wall', () => {
  /**
   * 3x3 U opening toward +Y: the centre-top unit is removed, so the notch is
   * bounded by two edges that face the same way as two outer edges. A matcher
   * keyed on orientation and along-overlap alone lets one prong's relief cut
   * the other prong's rail.
   */
  const U_SHAPE: CellMask = {
    cols: 6,
    rows: 6,
    // Rows run bottom-to-top; the top two rows lose their middle two columns.
    cells: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1,
      1, 0, 0, 1, 1,
    ],
  };

  function uParams(): BinParams {
    return {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 3,
      height: 6,
      cellMask: U_SHAPE,
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        enabled: true,
        attachment: 'clickRails',
        clickRails: { front: true, back: true, left: true, right: true },
        clickRailCoverage: 100,
        grip: {
          ...DEFAULT_BIN_PARAMS.lid.grip,
          mode: 'scallop',
          sides: { front: false, back: false, left: false, right: true },
          binDip: true,
        },
      },
    };
  }

  it('does not let one right-facing edge relief cut a parallel one', () => {
    // `grip.sides.right` gives EVERY right-facing edge its own relief, so both
    // lines are legitimately interrupted. The tell for aliasing is how many
    // times a single line gets cut: one grip on a line can split its rail into
    // at most two pieces, so a third piece means a relief from the other,
    // parallel line reached across and cut it too.
    const inputs = resolveLidInputs(uParams());
    const before = railPlacements(inputs).filter((p) => p.rotationDeg === -90);
    const after = splitRailsAroundGrip(before, inputs).filter((p) => p.rotationDeg === -90);

    // More than one right-facing edge is what makes the aliasing reachable.
    expect(new Set(before.map((r) => r.centerX.toFixed(3))).size).toBeGreaterThan(1);

    const perLine = new Map<string, number>();
    for (const r of after) {
      const key = r.centerX.toFixed(3);
      perLine.set(key, (perLine.get(key) ?? 0) + 1);
    }
    for (const [line, count] of perLine) {
      expect({ line, count }).toEqual({ line, count: Math.min(count, 2) });
    }
  });
});
