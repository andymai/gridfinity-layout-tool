/**
 * Rail splitting around a grip relief.
 *
 * Placement-level, so it runs without the WASM kernel: `resolveLidInputs` and
 * `railPlacements` are pure, and what matters here is arithmetic — how many
 * segments survive, how long they are, and where they sit.
 *
 * Worth stating plainly, because the geometry does not force it: a relief cuts
 * upward from `anchorZ` and a rail's top sits at `wallBottomZ`, BELOW it, so
 * the two never intersect. Splitting therefore fixes nothing — it trades snap
 * retention for an easier opening, which is why it is gated on `binDip` and
 * not on the relief alone.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { LID_MIN_RAIL_LENGTH, resolveLidGripSpanMm } from '@/shared/types/bin';
import type { BinParams, LidGripConfig } from '@/features/bin-designer/types';
import { resolveLidInputs } from './lidInputs';
import { railPlacements, splitRailsAroundGrip } from './lidClickRail';

function makeParams(grip: Partial<LidGripConfig>, over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 4,
    depth: 3,
    height: 4,
    ...over,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      clickRailCoverage: 100,
      // Splitting is gated on the bin dip, so every split case here opts in.
      grip: { ...DEFAULT_BIN_PARAMS.lid.grip, binDip: true, ...grip },
    },
  };
}

/** Rails as built, then as split — the pair every assertion below compares. */
function railsFor(params: BinParams) {
  const inputs = resolveLidInputs(params);
  const full = railPlacements(inputs);
  return { inputs, full, split: splitRailsAroundGrip(full, inputs) };
}

describe('splitRailsAroundGrip', () => {
  it('passes rails through untouched when there is no relief', () => {
    const { full, split } = railsFor(makeParams({ mode: 'none' }));
    expect(split).toEqual(full);
  });

  it('leaves rails whole for a relief without the bin dip', () => {
    // The relief alone is a seam treatment; it costs no snap strength. Only
    // opting into the dip trades retention for an easier opening.
    const { full, split } = railsFor(
      makeParams({
        mode: 'scallop',
        binDip: false,
        sides: { front: true, back: true, left: true, right: true },
      })
    );
    expect(split).toEqual(full);
  });

  it('splits only the walls that carry a relief', () => {
    const { split } = railsFor(
      makeParams({
        mode: 'scallop',
        sides: { front: true, back: true, left: false, right: false },
      })
    );
    expect(split.filter((r) => r.rotationDeg === 0)).toHaveLength(2);
    expect(split.filter((r) => r.rotationDeg === 180)).toHaveLength(2);
    expect(split.filter((r) => r.rotationDeg === 90)).toHaveLength(1);
    expect(split.filter((r) => r.rotationDeg === -90)).toHaveLength(1);
  });

  it('centres the gap on the wall and keeps the segments equal', () => {
    const params = makeParams({
      mode: 'scallop',
      sides: { front: false, back: true, left: false, right: false },
    });
    const { inputs, full, split } = railsFor(params);
    const original = full.find((r) => r.rotationDeg === 0);
    const segments = split.filter((r) => r.rotationDeg === 0);
    expect(original).toBeDefined();
    expect(segments).toHaveLength(2);

    expect(segments[0].length).toBeCloseTo(segments[1].length, 6);
    expect(segments[0].centerX + segments[1].centerX).toBeCloseTo(2 * (original?.centerX ?? 0), 6);

    // Neither segment reaches into the relief's span.
    const span = resolveLidGripSpanMm(
      inputs.lidOuterW - 2 * inputs.lidCornerR,
      inputs.grip.coverage
    );
    for (const seg of segments) {
      expect(Math.abs(seg.centerX) - seg.length / 2).toBeGreaterThan(span / 2);
    }
  });

  it('keeps both segments on the smallest lid that can carry them', () => {
    // A 1x1 wall still has room either side of a half-coverage relief. Guards
    // the opposite error from the drop case below: silently going friction-fit
    // on small lids, where the snap matters most.
    const { split } = railsFor(
      makeParams(
        { mode: 'scallop', sides: { front: true, back: true, left: true, right: true } },
        { width: 1, depth: 1 }
      )
    );
    expect(split).toHaveLength(8);
  });

  it('drops the rail entirely when the relief leaves no printable segment', () => {
    // A 1x1 wall's straight run is under the 40mm span cap, so full coverage
    // really does take all of it and leaves nothing either side. That wall
    // goes friction-fit rather than shipping two rail stubs. (On a larger lid
    // the cap keeps the relief well short of the wall, so 100% still splits.)
    const { split } = railsFor(
      makeParams(
        {
          mode: 'scallop',
          coverage: 100,
          sides: { front: true, back: true, left: true, right: true },
        },
        { width: 1, depth: 1 }
      )
    );
    expect(split).toHaveLength(0);
  });

  it('never emits a segment shorter than the printable minimum', () => {
    for (const size of [1, 2, 3, 4, 6]) {
      for (const coverage of [10, 50, 100]) {
        const { split } = railsFor(
          makeParams(
            {
              mode: 'scallop',
              coverage,
              sides: { front: true, back: true, left: true, right: true },
            },
            { width: size, depth: size }
          )
        );
        for (const seg of split) {
          expect(seg.length).toBeGreaterThanOrEqual(LID_MIN_RAIL_LENGTH);
        }
      }
    }
  });
});
