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
import { DEFAULT_LID_HINGE_CONFIG } from '@/features/bin-designer/types';
import { MASK_CELLS_PER_UNIT } from './cellMask';
import type { BinParams, LidGripConfig } from '@/features/bin-designer/types';
import { resolveLidInputs } from './lidInputs';
import {
  binDipEasesRails,
  railPlacements,
  railSidesLostToBinDip,
  splitRailsAroundGrip,
} from './lidRailPlan';

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

describe('hinged snap behind a dipped grip', () => {
  // The default grip (50%, centred) is wider than the snap (40%, centred) and
  // both sit on the free edge, so splitting would leave the lid with no catch.
  const hinged: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'hinge',
      hinge: { ...DEFAULT_LID_HINGE_CONFIG, side: 'back', catchMode: 'detent' },
      grip: {
        ...DEFAULT_BIN_PARAMS.lid.grip,
        mode: 'scallop',
        binDip: true,
        sides: { front: true, back: false, left: false, right: false },
      },
    },
  };

  it('keeps the snap whole', () => {
    const { full, split } = railsFor(hinged);
    expect(full).toHaveLength(1);
    expect(full[0].side).toBe('front');
    expect(split).toEqual(full);
  });

  it('reports no wall as lost', () => {
    expect(railSidesLostToBinDip(hinged)).toEqual([]);
  });
});

describe('binDipEasesRails', () => {
  const frontGrip = {
    mode: 'scallop',
    sides: { front: true, back: false, left: false, right: false },
  } as const;
  const noRails = { front: false, back: false, left: false, right: false };

  it('is true when a rail runs behind the grip', () => {
    expect(binDipEasesRails(makeParams(frontGrip))).toBe(true);
  });

  it('answers for the dip while the toggle is still off', () => {
    expect(binDipEasesRails(makeParams({ ...frontGrip, binDip: false }))).toBe(true);
  });

  it('is false when every click rail is off', () => {
    const params = makeParams(frontGrip);
    expect(binDipEasesRails({ ...params, lid: { ...params.lid, clickRails: noRails } })).toBe(
      false
    );
  });

  it('is false when the rails are only on walls without a grip', () => {
    const params = makeParams(frontGrip);
    expect(
      binDipEasesRails({
        ...params,
        lid: { ...params.lid, clickRails: { ...noRails, back: true, left: true } },
      })
    ).toBe(false);
  });

  it('is false for a hinged lid, whose snap the dip never splits', () => {
    const params = makeParams(frontGrip);
    expect(
      binDipEasesRails({
        ...params,
        lid: {
          ...params.lid,
          attachment: 'hinge',
          hinge: { ...DEFAULT_LID_HINGE_CONFIG, side: 'back', catchMode: 'detent' },
        },
      })
    ).toBe(false);
  });

  it('is false with no grip to dip under', () => {
    expect(binDipEasesRails(makeParams({ mode: 'none' }))).toBe(false);
  });
});

describe('railSidesLostToBinDip', () => {
  it('names a wall whose whole rail sits behind the grip', () => {
    // Half-coverage rails on a 2x2 lid are shorter than a half-coverage grip
    // plus its quiet zone, so the front rail has nothing left either side.
    const params = makeParams(
      { mode: 'scallop', sides: { front: true, back: false, left: false, right: false } },
      { width: 2, depth: 2 }
    );
    const lost = railSidesLostToBinDip({
      ...params,
      lid: { ...params.lid, clickRailCoverage: 50 },
    });
    expect(lost).toEqual(['front']);
  });

  it('stays quiet when the split leaves a segment on the wall', () => {
    const params = makeParams({
      mode: 'scallop',
      sides: { front: true, back: true, left: true, right: true },
    });
    expect(railSidesLostToBinDip(params)).toEqual([]);
  });

  it('stays quiet without the dip', () => {
    const params = makeParams(
      { mode: 'scallop', binDip: false, coverage: 100 },
      { width: 1, depth: 1 }
    );
    expect(railSidesLostToBinDip(params)).toEqual([]);
  });

  it('tells apart two walls that face the same way along one line', () => {
    // The 4.5x2 U: its back-facing arms are 1u and 1.5u wide and share a line.
    // A full-width grip clears the short arm's rail and leaves the long arm
    // two segments, which must not stand in for the short arm.
    const cols = 4.5 * MASK_CELLS_PER_UNIT;
    const rows = 2 * MASK_CELLS_PER_UNIT;
    const cells = new Array<0 | 1>(cols * rows).fill(1);
    for (let r = MASK_CELLS_PER_UNIT; r < rows; r++) {
      for (let c = MASK_CELLS_PER_UNIT; c < 3 * MASK_CELLS_PER_UNIT; c++) cells[r * cols + c] = 0;
    }
    const params = makeParams(
      {
        mode: 'scallop',
        coverage: 100,
        sides: { front: false, back: true, left: false, right: false },
      },
      { width: 4.5, depth: 2, cellMask: { cols, rows, cells } }
    );
    const { split } = railsFor(params);
    expect(split.some((rail) => rail.side === 'back')).toBe(true);
    expect(railSidesLostToBinDip(params)).toEqual(['back']);
  });

  it('names every wall a full-width grip clears on a 1x1 lid', () => {
    const params = makeParams(
      {
        mode: 'scallop',
        coverage: 100,
        sides: { front: true, back: true, left: true, right: true },
      },
      { width: 1, depth: 1 }
    );
    expect([...railSidesLostToBinDip(params)].sort()).toEqual(['back', 'front', 'left', 'right']);
  });
});
