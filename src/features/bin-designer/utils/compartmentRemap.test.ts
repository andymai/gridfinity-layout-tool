import { describe, it, expect } from 'vitest';
import { remapFloorRaises } from './compartmentRemap';
import { mergeCells } from './compartments';
import type { CompartmentConfig } from '../types';

describe('remapFloorRaises', () => {
  it('follows each raise to its compartment’s new id', () => {
    const remap = new Map([
      [0, 0],
      [2, 1],
    ]);
    expect(remapFloorRaises([5, 8, 12], remap)).toEqual([5, 12]);
  });

  it('drops raises of compartments that no longer exist and pads the rest with null', () => {
    const remap = new Map([
      [1, 0],
      [3, 1],
    ]);
    expect(remapFloorRaises([5, null, 8, 12], remap)).toEqual([null, 12]);
  });

  it('collapses to undefined when nothing survives', () => {
    expect(remapFloorRaises([5], new Map([[1, 0]]))).toBeUndefined();
    expect(remapFloorRaises(undefined, new Map())).toBeUndefined();
    expect(remapFloorRaises([], new Map())).toBeUndefined();
  });
});

describe('mergeCells keeps floor raises in lockstep', () => {
  it('moves a raise with its compartment when a merge renumbers the grid', () => {
    const config: CompartmentConfig = {
      cols: 3,
      rows: 1,
      thickness: 1.2,
      cells: [0, 1, 2],
      floorRaises: [null, null, 9],
    };
    const merged = mergeCells(config, [0, 1]);
    expect(merged?.cells).toEqual([0, 0, 1]);
    expect(merged?.floorRaises).toEqual([null, 9]);
  });
});
