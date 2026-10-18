/**
 * The adapter both threads reach the sliding-lid plan through.
 *
 * `resolveSlideLidPlan` is tested exhaustively beside itself; what is worth
 * pinning here is the translation — that a non-slide design is refused rather
 * than answered, and that overhang reaches the plan as a moved cavity rather
 * than being dropped. A plate sized against the nominal footprint on an
 * overhung bin is a millimetre proud of the face it should finish flush with,
 * and nothing about either solid would say so.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants';
import { DEFAULT_LID_SLIDE_CONFIG } from '../types/lid';
import type { BinParams, LidSlideConfig } from '../types';
import { CUTOUT_FILL_STEP_MM } from './cutoutFill';
import { slideLidFillOffsetMm, slideLidPlanForParams } from './slideLidPlanForParams';

function slideParams(
  overrides: Partial<BinParams> = {},
  slide: Partial<LidSlideConfig> = {}
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 6,
    ...overrides,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      ...overrides.lid,
      enabled: true,
      attachment: 'slide',
      slide: { ...DEFAULT_LID_SLIDE_CONFIG, ...slide },
    },
  };
}

describe('slideLidPlanForParams', () => {
  it('refuses any other attachment rather than answering for it', () => {
    // Callers ask unconditionally, so the rejection has to be a real answer.
    for (const attachment of ['friction', 'clickRails', 'magnetic'] as const) {
      const plan = slideLidPlanForParams({
        ...DEFAULT_BIN_PARAMS,
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment },
      });
      expect(plan).toEqual({ geometry: null, rejection: 'not-slide' });
    }
  });

  it('resolves a plan for a plain sliding design', () => {
    const { geometry, rejection } = slideLidPlanForParams(slideParams());
    expect(rejection).toBeNull();
    expect(geometry).not.toBeNull();
  });

  it('works from a design that stores no slide config at all', () => {
    // `lid.slide` is absent on anything that has never used the feature, so the
    // adapter has to resolve the factory config rather than read undefined.
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 6,
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'slide', slide: undefined },
    };
    const { geometry } = slideLidPlanForParams(params);
    expect(geometry?.entrySide).toBe(DEFAULT_LID_SLIDE_CONFIG.entrySide);
  });

  it('grows the plate when overhang grows the bin', () => {
    const plain = slideLidPlanForParams(slideParams());
    const overhung = slideLidPlanForParams(
      slideParams({
        overhang: { enabled: true, left: 4, right: 4, front: 0, back: 0 },
      })
    );
    // Front entry, so the plate spans X — which is the axis the overhang grew.
    expect(overhung.geometry?.plate.spanMm).toBeCloseTo((plain.geometry?.plate.spanMm ?? 0) + 8, 6);
  });

  it('measures the entry wall on the side asymmetric overhang thickened', () => {
    // The plate finishes flush with the entry wall's OUTER face, and overhang
    // makes that wall thicker on one side only. Entering from the back, the
    // back wall carries the growth.
    const asymmetric = slideParams(
      { overhang: { enabled: true, left: 0, right: 0, front: 0, back: 6 } },
      { entrySide: 'back' }
    );
    const plain = slideParams({}, { entrySide: 'back' });
    const grown = slideLidPlanForParams(asymmetric).geometry;
    const flat = slideLidPlanForParams(plain).geometry;
    expect(grown?.plate.lengthMm).toBeGreaterThan(flat?.plate.lengthMm ?? 0);
  });

  it('cuts a thin wall’s lining back from a cutout on the far wall only', () => {
    const cut = (side: 'back' | 'left'): BinParams['walls'] => ({
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      [side]: { ...DEFAULT_BIN_PARAMS.walls[side], enabled: true, width: 50, depth: 30 },
    });
    const far = slideLidPlanForParams(slideParams({ wallThickness: 0.8, walls: cut('back') }));
    const openings = far.geometry?.wallLining?.openings ?? [];
    expect(openings).toHaveLength(1);
    expect(openings[0].yMin).toBeLessThan(0);
    expect(openings[0].yMax).toBeGreaterThan(0);

    const channel = slideLidPlanForParams(slideParams({ wallThickness: 0.8, walls: cut('left') }));
    expect(channel.geometry?.wallLining?.openings).toEqual([]);
  });

  it('refuses a custom shape, which has no polygon-edge mapping', () => {
    const masked = slideParams({ cellMask: { cols: 3, rows: 2, cells: [1, 1, 1, 1, 1, 0] } });
    expect(slideLidPlanForParams(masked).rejection).toBe('unsupported-shape');
  });
});

/** A 1x2x5 solid cutout bin whose fill sits `topOffset` below the rim. */
function solidParams(topOffset: number, overrides: Partial<BinParams> = {}): BinParams {
  return slideParams({
    width: 1,
    depth: 2,
    height: 5,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutoutConfig: { ...DEFAULT_BIN_PARAMS.cutoutConfig, topOffset },
    ...overrides,
  });
}

describe('a solid bin', () => {
  it('carries the channel in the recess above its fill', () => {
    const { geometry, rejection } = slideLidPlanForParams(solidParams(10));
    expect(rejection).toBeNull();
    expect(geometry).not.toBeNull();
  });

  it('refuses a fill flush with the rim, which leaves no cavity', () => {
    expect(slideLidPlanForParams(solidParams(0)).rejection).toBe('no-cavity');
  });

  it('refuses a recess shallower than the joint', () => {
    expect(slideLidPlanForParams(solidParams(5)).rejection).toBe('bin-too-shallow');
  });

  it('counts only the recess above a tapered wall’s band', () => {
    // The band clips the recess inside it to a wall narrower than the
    // rim-sized plate; above it the recess keeps its full width. The fill tops
    // out at 20.25mm and the wall at 30.25mm.
    const taper = (bandHeight: number): BinParams['overhang'] => ({
      enabled: true,
      left: 10,
      right: 0,
      front: 0,
      back: 0,
      taper: {
        enabled: true,
        profile: 'chamfer',
        bandHeight,
        left: 10,
        right: 0,
        front: 0,
        back: 0,
      },
    });
    const plan = (bandHeight: number) =>
      slideLidPlanForParams(solidParams(10, { overhang: taper(bandHeight) }));
    expect(plan(15).geometry).not.toBeNull();
    // Into the band, with 9.25mm of full-width recess still above it.
    expect(plan(21).geometry).not.toBeNull();
    // 0.25mm above the band.
    expect(plan(30).rejection).toBe('bin-too-shallow');
  });

  it('finds no recess in a tapered bin whose offset outlived a taller one', () => {
    // The tapered body keeps its whole loft once the fill is gone.
    const tapered = solidParams(40, {
      height: 3,
      overhang: {
        enabled: true,
        left: 10,
        right: 0,
        front: 0,
        back: 0,
        taper: {
          enabled: true,
          profile: 'chamfer',
          bandHeight: 20,
          left: 10,
          right: 0,
          front: 0,
          back: 0,
        },
      },
    });
    expect(slideLidPlanForParams(tapered).rejection).toBe('no-cavity');
    expect(slideLidFillOffsetMm(tapered)).toBeNull();
  });

  it('measures no deeper than the bin when the offset outlived a taller one', () => {
    // A rim-anchored offset survives a height cut, and past the floor the shell
    // drops the fill, so the bin has only its own cavity to offer.
    const outlived = solidParams(20, { height: 2 });
    const hollow = slideParams({ width: 1, depth: 2, height: 2 });
    expect(slideLidPlanForParams(hollow).rejection).toBe('bin-too-shallow');
    expect(slideLidPlanForParams(outlived).rejection).toBe('bin-too-shallow');
  });
});

describe('slideLidFillOffsetMm', () => {
  it('names the shallowest fill step that gets the channel built', () => {
    const offset = slideLidFillOffsetMm(solidParams(0));
    expect(offset).not.toBeNull();
    const lowered = offset ?? 0;
    expect(Number.isInteger(lowered / CUTOUT_FILL_STEP_MM)).toBe(true);
    expect(slideLidPlanForParams(solidParams(lowered)).geometry).not.toBeNull();
    expect(slideLidPlanForParams(solidParams(lowered - CUTOUT_FILL_STEP_MM)).geometry).toBeNull();
  });

  it('asks less of a lipless bin, whose channel sits higher', () => {
    const lipless = solidParams(0, {
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
    });
    expect(slideLidFillOffsetMm(lipless) ?? Infinity).toBeLessThan(
      slideLidFillOffsetMm(solidParams(0)) ?? 0
    );
  });

  it('has no answer when the bin is too short for any fill to clear the joint', () => {
    expect(slideLidFillOffsetMm(solidParams(0, { height: 1 }))).toBeNull();
  });

  it('has no answer when the plan refuses for a reason the fill does not touch', () => {
    const masked = solidParams(0, {
      width: 3,
      cellMask: { cols: 3, rows: 2, cells: [1, 1, 1, 1, 1, 0] },
    });
    expect(slideLidFillOffsetMm(masked)).toBeNull();
  });

  it('has no answer for a hollow bin', () => {
    expect(slideLidFillOffsetMm(slideParams())).toBeNull();
  });
});
