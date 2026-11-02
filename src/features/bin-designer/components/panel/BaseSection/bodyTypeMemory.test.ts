import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, BodyTypeMemory } from '@/features/bin-designer/types';
import { resolveConstraints } from '@/shared/constraints';
import type { FeatureKey } from '@/shared/constraints';
import { BODY_TYPES } from './bodyType';
import type { BodyType } from './bodyType';
import { switchBodyType } from './bodyTypeMemory';
import { heldCutoutFillMm } from '@/features/bin-designer/utils/cutoutFill';

/** A standard bin with every setting a body switch can clear turned on. */
function designedBin(): BinParams {
  let params: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    height: 6,
    extraWallHeightMm: 5,
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] },
  };
  const features: FeatureKey[] = ['base.magnet', 'scoop', 'label', 'wallPattern', 'handles'];
  for (const feature of features) {
    params = resolveConstraints(params, { feature, enabled: true }).params;
  }
  return params;
}

/** Equality the way the design is stored: an undefined key is an absent one. */
function stored(params: BinParams): unknown {
  return JSON.parse(JSON.stringify(params));
}

function walk(
  start: BinParams,
  path: readonly BodyType[]
): { params: BinParams; memory: BodyTypeMemory | null } {
  let state: { params: BinParams; memory: BodyTypeMemory | null } = {
    params: start,
    memory: null,
  };
  for (const next of path) state = switchBodyType(state.params, next, state.memory);
  return state;
}

describe('switchBodyType', () => {
  it('gives back the height, collar and wall features Base only took away', () => {
    const start = designedBin();
    const tile = walk(start, ['tile']);
    expect(tile.params.height).toBe(1);
    expect(tile.params.wallPattern.enabled).toBe(false);

    const back = switchBodyType(tile.params, 'standard', tile.memory);
    expect(back.params.height).toBe(6);
    expect(back.params.extraWallHeightMm).toBe(5);
    expect(stored(back.params)).toEqual(stored(start));
    expect(back.memory).toBeNull();
  });

  it.each(BODY_TYPES.filter((type) => type !== 'standard'))(
    'a visit to %s leaves a designed bin as it was',
    (type) => {
      const start = designedBin();
      expect(stored(walk(start, [type, 'standard']).params)).toEqual(stored(start));
    }
  );

  it('holds what the next body still blocks until a later one can carry it', () => {
    const start = designedBin();
    // Spacer can hold the height and the wall pattern again, not the label.
    const spacer = walk(start, ['tile', 'spacer']);
    expect(spacer.params.height).toBe(6);
    expect(spacer.params.wallPattern.enabled).toBe(true);
    expect(spacer.params.label.enabled).toBe(false);

    const back = switchBodyType(spacer.params, 'standard', spacer.memory);
    expect(stored(back.params)).toEqual(stored(start));
  });

  it('carries magnets through a body that cannot hold them without changing that body', () => {
    const start = designedBin();
    const flat = walk(start, ['tray', 'flat']);
    expect(flat.params.base.style).toBe('flat');

    const back = switchBodyType(flat.params, 'standard', flat.memory);
    expect(back.params.base.style).toBe(start.base.style);
  });

  it('survives repeated visits without recording the pinned values as the user’s', () => {
    const start = designedBin();
    const end = walk(start, ['tile', 'standard', 'tile', 'standard']);
    expect(stored(end.params)).toEqual(stored(start));
  });

  it('leaves alone a setting edited since the switch cleared it', () => {
    const tile = walk(designedBin(), ['tile']);
    const edited: BinParams = { ...tile.params, label: { ...tile.params.label, inset: 3 } };

    const back = switchBodyType(edited, 'standard', tile.memory);
    expect(back.params.label).toEqual(edited.label);
    expect(back.params.height).toBe(6);
  });

  it('ignores memory made for a different body type', () => {
    const tile = walk(designedBin(), ['tile']);
    const flatOnly: BinParams = {
      ...tile.params,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    };

    const back = switchBodyType(flatOnly, 'standard', tile.memory);
    expect(back.params.wallPattern.enabled).toBe(false);
    expect(back.params.height).not.toBe(6);
  });

  it('keeps Nesting magnets through a body that cannot hold them', () => {
    const nesting = walk(designedBin(), ['nesting']);
    expect(nesting.params.base.trayBottom?.attachment).toBe('magnetic');

    const back = walk(designedBin(), ['nesting', 'flat', 'nesting']);
    expect(back.params.base.trayBottom?.attachment).toBe('magnetic');
  });

  it('gives magnets back in the encoding of the body it lands on', () => {
    const nesting = walk(designedBin(), ['spacer', 'nesting']);
    expect(nesting.params.base.trayBottom?.attachment).toBe('magnetic');
  });

  it('holds a height the next body would only floor, for one that keeps it', () => {
    const spacer: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      height: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, spacer: true },
    };
    const end = walk(spacer, ['standard', 'flat', 'spacer']);
    expect(end.params.height).toBe(1);
  });

  it('holds a grid that no longer fits instead of refusing the switch', () => {
    const eightCols: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 4,
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 8,
        rows: 1,
        cells: [0, 1, 2, 3, 4, 5, 6, 7],
      },
    };
    const tile = walk(eightCols, ['tile']);
    const narrow = switchBodyType({ ...tile.params, width: 1 }, 'standard', tile.memory);
    expect(narrow.params.compartments.cols).toBe(1);

    const wide = switchBodyType({ ...narrow.params, width: 4 }, 'flat', narrow.memory);
    expect(wide.params.compartments.cols).toBe(8);
  });

  it('gives screws back alongside magnets turned on since', () => {
    const screws: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'screw' },
    };
    const nesting = walk(screws, ['nesting']);
    const magnetic = resolveConstraints(nesting.params, {
      feature: 'base.magnet',
      enabled: true,
    }).params;

    const back = switchBodyType(magnetic, 'standard', nesting.memory);
    expect(back.params.base.style).toBe('magnet_and_screw');
  });

  it('does not bring back magnets turned off since', () => {
    const both: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw' },
    };
    const nesting = walk(both, ['nesting']);
    const plain = resolveConstraints(nesting.params, {
      feature: 'base.magnet',
      enabled: false,
    }).params;

    const back = switchBodyType(plain, 'standard', nesting.memory);
    expect(back.params.base.style).toBe('screw');
  });

  it('keeps a 1u spacer height through a body that pins it to the same value', () => {
    const spacer: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      height: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, spacer: true },
    };
    const end = walk(spacer, ['standard', 'tile', 'spacer']);
    expect(end.params.height).toBe(1);
  });

  it('gives a floor-referenced solid fill back after Base only clamps it', () => {
    const solid: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      height: 6,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutoutConfig: { ...DEFAULT_BIN_PARAMS.cutoutConfig, fillReference: 'floor', topOffset: 4 },
    };
    const tile = walk(solid, ['tile']);
    expect(tile.params.cutoutConfig.topOffset).not.toBe(4);

    const back = switchBodyType(tile.params, 'standard', tile.memory);
    expect(back.params.cutoutConfig.topOffset).toBe(4);
    expect(back.params.style).toBe('solid');
  });

  it('holds the fill height in mm across bodies with different walls', () => {
    const solid: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      height: 6,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutoutConfig: { ...DEFAULT_BIN_PARAMS.cutoutConfig, fillReference: 'floor', topOffset: 4 },
    };
    const fill = heldCutoutFillMm(solid);
    const flat = walk(solid, ['flat']);
    expect(heldCutoutFillMm(flat.params)).toBe(fill);

    const tray = switchBodyType(flat.params, 'tray', flat.memory);
    expect(heldCutoutFillMm(tray.params)).toBe(fill);
    const back = switchBodyType(tray.params, 'standard', tray.memory);
    expect(back.params.cutoutConfig.topOffset).toBe(4);
  });

  it('keeps a clamped fill held until a body has room for it', () => {
    const solid: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      height: 6,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutoutConfig: { ...DEFAULT_BIN_PARAMS.cutoutConfig, fillReference: 'floor', topOffset: 4 },
    };
    const end = walk(solid, ['tile', 'spacer', 'standard']);
    expect(end.params.cutoutConfig.topOffset).toBe(4);
  });

  it('refuses a restore that would turn off something enabled since', () => {
    const flatWithPattern = resolveConstraints(
      { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } },
      { feature: 'wallPattern', enabled: true }
    ).params;
    // A solid bin has no wall to perforate, so giving the style back would
    // silently clear the pattern the user turned on.
    const memory: BodyTypeMemory = {
      bodyType: 'flat',
      cleared: [
        { feature: 'style.solid', original: { style: 'solid' }, left: { style: 'standard' } },
      ],
    };

    const back = switchBodyType(flatWithPattern, 'standard', memory);
    expect(back.params.style).toBe('standard');
    expect(back.params.wallPattern.enabled).toBe(true);
    expect(back.memory?.cleared).toHaveLength(1);
  });
});
