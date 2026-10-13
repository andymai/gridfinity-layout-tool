/**
 * Contract test: the Dimensions panel's inside size must equal the cavity the
 * generator pipeline builds. Reads the real context builder rather than
 * re-deriving, so a change to the floor or wall-top rules fails here instead of
 * leaving the readout a few millimetres off.
 */

import { describe, it, expect } from 'vitest';
import { createInitialContext } from '@/features/generation/worker/generators/pipeline/context';
import { resolveTrayBottomInputs } from '@/features/generation/worker/generators/trayBottomInputs';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { DEFAULT_TRAY_BOTTOM } from '@/features/bin-designer/types';
import type { BaseConfig, BinParams } from '@/features/bin-designer/types';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { isNestingBase } from '@/shared/types/bin';
import { binInteriorDimensions } from './interiorDimensions';

function withBase(base: Partial<BaseConfig>, rest: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...rest, base: { ...DEFAULT_BIN_PARAMS.base, ...base } };
}

function nesting(attachment: 'friction' | 'magnetic'): BinParams {
  return withBase({
    style: 'lid',
    trayBottom: {
      ...DEFAULT_TRAY_BOTTOM,
      floorAtBed: true,
      attachment,
      retentionMagnet: DEFAULT_BIN_PARAMS.lid.retentionMagnet,
    },
  });
}

describe('binInteriorDimensions matches the generator pipeline', () => {
  const cases: Array<[string, BinParams]> = [
    ['default socketed bin with a lip', DEFAULT_BIN_PARAMS],
    ['no stacking lip', withBase({ stackingLip: false })],
    ['flat base', withBase({ style: 'flat' })],
    ['flat base with a divider floor groove', withBase({ style: 'flat' }, { style: 'slotted' })],
    ['tray base', withBase({ style: 'lid' })],
    ['nesting body, friction fit', nesting('friction')],
    ['nesting body, magnets', nesting('magnetic')],
    [
      'nesting body with an overhang',
      {
        ...nesting('friction'),
        overhang: { left: 3, right: 5, front: 2, back: 4, feet: false },
      },
    ],
    ['low-profile feet', withBase({ lowProfile: true })],
    ['detachable feet', withBase({ feet: 'detachable' })],
    ['exterior-wall collar', { ...DEFAULT_BIN_PARAMS, extraWallHeightMm: 8 }],
    ['wall thicker than the spec floor', { ...DEFAULT_BIN_PARAMS, wallThickness: 3 }],
    ['taller height unit', { ...DEFAULT_BIN_PARAMS, heightUnitMm: 10, height: 5 }],
    ['half-bin footprint', { ...DEFAULT_BIN_PARAMS, width: 1.5, depth: 2.5 }],
  ];

  it.each(cases)('%s', (_name, params) => {
    const dim = createInitialContext(params).dimensions;
    const inside = binInteriorDimensions(params);

    // A nesting body opens its floor through a mouth cut into the lid-mating plug.
    const mouth = isNestingBase(params.base) ? resolveTrayBottomInputs(params) : null;
    const mouthW = mouth ? mouth.lidOuterW - 2 * mouth.cavityInset : Infinity;
    const mouthD = mouth ? mouth.lidOuterD - 2 * mouth.cavityInset : Infinity;

    // The narrowest cavity is the one without an overhang's extra width.
    const nominal = createInitialContext({
      ...params,
      overhang: DEFAULT_BIN_PARAMS.overhang,
    }).dimensions;

    expect(inside).not.toBeNull();
    expect(inside?.widthMm).toBeCloseTo(Math.min(nominal.innerW, mouthW), 6);
    expect(inside?.depthMm).toBeCloseTo(Math.min(nominal.innerD, mouthD), 6);
    // A nesting body's floor sits on the bed, not on the skirt the others seat on.
    const floorTopZ = isNestingBase(params.base)
      ? dim.floorThickness
      : dim.baseOffsetZ + dim.floorThickness;
    expect(inside?.heightMm).toBeCloseTo(dim.wallTopZ - floorTopZ, 6);
  });

  it('gives a nesting body the skirt depth back that a raised tray floor gives up', () => {
    const raised = binInteriorDimensions(withBase({ style: 'lid' }));
    const lowered = binInteriorDimensions(nesting('friction'));
    expect(lowered?.heightMm).toBeGreaterThan(raised?.heightMm ?? Infinity);
  });

  it('reads (height - 1) units for a plain socketed bin, as the spec says', () => {
    const inside = binInteriorDimensions(withBase({ stackingLip: false }));
    expect(inside?.heightMm).toBeCloseTo(
      DEFAULT_BIN_PARAMS.height * DEFAULT_BIN_PARAMS.heightUnitMm - GRIDFINITY.BASE_HEIGHT,
      6
    );
  });

  it('gives a flat base more room than a socketed one at the same height', () => {
    const socketed = binInteriorDimensions(DEFAULT_BIN_PARAMS);
    const flat = binInteriorDimensions(withBase({ style: 'flat' }));
    expect(flat?.heightMm).toBeGreaterThan(socketed?.heightMm ?? Infinity);
  });

  it('reports the narrowest cavity when an overhang widens the upper body', () => {
    const plain = binInteriorDimensions(DEFAULT_BIN_PARAMS);
    const flared = binInteriorDimensions({
      ...DEFAULT_BIN_PARAMS,
      overhang: { left: 4, right: 4, front: 2, back: 2, feet: false },
    });
    expect(flared).toEqual(plain);
  });

  describe('has no single cavity to report', () => {
    it('for a solid block', () => {
      const params = withBase({ solid: true });
      expect(createInitialContext(params).dimensions.solid).toBe(true);
      expect(binInteriorDimensions(params)).toBeNull();
    });

    it('for a base-only plate', () => {
      const params = withBase({ tile: true });
      expect(createInitialContext(params).dimensions.isTile).toBe(true);
      expect(binInteriorDimensions(params)).toBeNull();
    });

    it('for a floorless spacer', () => {
      const params = withBase({ spacer: true });
      expect(createInitialContext(params).dimensions.liteFloorOpen).toBe(true);
      expect(binInteriorDimensions(params)).toBeNull();
    });

    it('for a lightweight open floor', () => {
      const params = withBase({ lightweight: true });
      expect(createInitialContext(params).dimensions.liteFloorOpen).toBe(true);
      expect(binInteriorDimensions(params)).toBeNull();
    });

    it('for a non-rectangular footprint', () => {
      const cells = new Array(16).fill(1) as (0 | 1)[];
      cells[0] = 0;
      expect(
        binInteriorDimensions({ ...DEFAULT_BIN_PARAMS, cellMask: { cols: 4, rows: 4, cells } })
      ).toBeNull();
    });
  });
});
