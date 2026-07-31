/**
 * Contract test: the editor's taper-band overlay must equal the taper the
 * generator pipeline actually clips cutouts against, so the hatched strip marks
 * exactly the material a full-depth pocket loses.
 *
 * Imports the real pipeline context builder rather than re-deriving, so any
 * future change to the overhang/taper resolution fails here instead of silently
 * drifting the overlay. Sibling of `cutoutInterior.contract.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { createInitialContext } from '@/features/generation/worker/generators/pipeline/context';
import { cutoutTaperBand } from './binDimensions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

const SOLID = { ...DEFAULT_BIN_PARAMS.base, solid: true };

function solidWith(overhang: BinParams['overhang'], extra: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, base: SOLID, overhang, ...extra };
}

function expectMatchesGenerator(params: BinParams): void {
  const { taper } = createInitialContext(params).dimensions.overhang;
  const band = cutoutTaperBand(params);
  if (!taper) {
    expect(band).toBeNull();
    return;
  }
  expect(band).toEqual({
    left: taper.left,
    right: taper.right,
    front: taper.front,
    back: taper.back,
  });
}

const taperOf = (sides: { left: number; right: number; front: number; back: number }) => ({
  enabled: true,
  profile: 'chamfer' as const,
  bandHeight: 8,
  ...sides,
});

describe('cutoutTaperBand matches the generator pipeline', () => {
  it('no overhang at all', () => {
    expectMatchesGenerator(solidWith(undefined));
  });

  it('overhang without a taper', () => {
    expectMatchesGenerator(solidWith({ left: 5, right: 5, front: 0, back: 0 }));
  });

  it('symmetric flare', () => {
    const s = { left: 4, right: 4, front: 4, back: 4 };
    expectMatchesGenerator(solidWith({ ...s, taper: taperOf(s) }));
  });

  it('asymmetric flare on the drawer-facing sides only', () => {
    expectMatchesGenerator(
      solidWith({
        left: 0,
        right: 9,
        front: 6,
        back: 0,
        taper: taperOf({ left: 0, right: 9, front: 6, back: 0 }),
      })
    );
  });

  it('a taper on a side with no overhang is clamped away by both', () => {
    // resolveTaper clamps per side against that side's overhang, so a flare with
    // no rim width behind it resolves to nothing rather than cutting below
    // nominal. The overlay must not draw a band there.
    expectMatchesGenerator(
      solidWith({
        left: 0,
        right: 0,
        front: 0,
        back: 0,
        taper: taperOf({ left: 7, right: 7, front: 7, back: 7 }),
      })
    );
  });

  it('an explicitly disabled overhang drops the taper with it', () => {
    expectMatchesGenerator(
      solidWith({
        enabled: false,
        left: 6,
        right: 6,
        front: 0,
        back: 0,
        taper: taperOf({ left: 6, right: 6, front: 0, back: 0 }),
      })
    );
  });

  it('a disabled taper under a live overhang draws no band', () => {
    expectMatchesGenerator(
      solidWith({
        left: 6,
        right: 6,
        front: 0,
        back: 0,
        taper: { ...taperOf({ left: 6, right: 6, front: 0, back: 0 }), enabled: false },
      })
    );
  });

  it('suppresses the band for a partial cell mask, matching the generator', () => {
    const cells = new Array(16).fill(1) as (0 | 1)[];
    cells[0] = 0;
    expectMatchesGenerator(
      solidWith(
        {
          left: 5,
          right: 5,
          front: 3,
          back: 3,
          taper: taperOf({ left: 5, right: 5, front: 3, back: 3 }),
        },
        { cellMask: { cols: 4, rows: 4, cells } }
      )
    );
  });
});
