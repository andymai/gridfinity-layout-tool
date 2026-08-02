import { describe, expect, it } from 'vitest';

import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

import { deriveTechniques } from './communityTechniques';

describe('deriveTechniques', () => {
  it('returns no techniques for DEFAULT_BIN_PARAMS', () => {
    expect(deriveTechniques(DEFAULT_BIN_PARAMS)).toEqual([]);
  });

  it('tags compartments when cells contain more than one distinct id', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] },
    };
    expect(deriveTechniques(params)).toEqual(['compartments']);
  });

  it('does not tag compartments when every cell shares one id, even with cols/rows > 1', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 2, cells: [0, 0, 0, 0] },
    };
    expect(deriveTechniques(params)).toEqual([]);
  });

  it('does not tag wallCutouts from the default per-side left/right enabled trap', () => {
    // DEFAULT_BIN_PARAMS.walls has enabled: false at the master level but
    // left/right sub-objects individually enabled: true.
    expect(DEFAULT_BIN_PARAMS.walls.enabled).toBe(false);
    expect(DEFAULT_BIN_PARAMS.walls.left.enabled).toBe(true);
    expect(deriveTechniques(DEFAULT_BIN_PARAMS)).not.toContain('wallCutouts');
  });

  it('tags wallCutouts when the master walls.enabled flag is true', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
    };
    expect(deriveTechniques(params)).toEqual(['wallCutouts']);
  });

  it('tags scoop when scoop.enabled is true', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    };
    expect(deriveTechniques(params)).toEqual(['scoop']);
  });

  it('tags labelTab when label.enabled is true', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    };
    expect(deriveTechniques(params)).toEqual(['labelTab']);
  });

  it('tags slotted from params.style alone, not slotConfig', () => {
    // DEFAULT_SLOT_CONFIG ships x.enabled: true even for a standard bin.
    expect(DEFAULT_BIN_PARAMS.slotConfig.x.enabled).toBe(true);
    expect(DEFAULT_BIN_PARAMS.style).toBe('standard');
    expect(deriveTechniques(DEFAULT_BIN_PARAMS)).not.toContain('slotted');

    const params: BinParams = { ...DEFAULT_BIN_PARAMS, style: 'slotted' };
    expect(deriveTechniques(params)).toEqual(['slotted']);
  });

  it('tags lid when lid.enabled is true', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
    };
    expect(deriveTechniques(params)).toEqual(['lid']);
  });

  it('does not tag handles from the default per-side front/left/right enabled trap', () => {
    expect(DEFAULT_BIN_PARAMS.handles.enabled).toBe(false);
    expect(DEFAULT_BIN_PARAMS.handles.front.enabled).toBe(true);
    expect(deriveTechniques(DEFAULT_BIN_PARAMS)).not.toContain('handles');
  });

  it('tags handles when the master handles.enabled flag is true', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true },
    };
    expect(deriveTechniques(params)).toEqual(['handles']);
  });

  it('tags customShape for a partial cellMask but not an all-filled one', () => {
    const partial: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] },
    };
    expect(deriveTechniques(partial)).toEqual(['customShape']);

    const allFilled: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 1] },
    };
    expect(deriveTechniques(allFilled)).toEqual([]);
  });

  it('tags wallPattern when wallPattern.enabled is true', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
    };
    expect(deriveTechniques(params)).toEqual(['wallPattern']);
  });

  it('returns multiple techniques in union declaration order when several are active', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    };
    expect(deriveTechniques(params)).toEqual(['compartments', 'scoop', 'labelTab']);
  });
});
