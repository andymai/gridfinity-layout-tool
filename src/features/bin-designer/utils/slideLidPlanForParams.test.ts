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
import { slideLidPlanForParams } from './slideLidPlanForParams';

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

  it('refuses a custom shape, which has no polygon-edge mapping', () => {
    const masked = slideParams({ cellMask: { cols: 3, rows: 2, cells: [1, 1, 1, 1, 1, 0] } });
    expect(slideLidPlanForParams(masked).rejection).toBe('unsupported-shape');
  });
});
