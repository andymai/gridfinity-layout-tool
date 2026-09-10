import { describe, it, expect } from 'vitest';
import { remapFloorRaises, renumberCompartments } from './compartmentRemap';
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

describe('renumberCompartments', () => {
  const base = {
    cols: 2,
    rows: 2,
    thickness: 1.2,
    cells: [3, 3, 7, 7],
    compartmentTexts: ['', '', '', 'top', '', '', '', 'bottom'],
    backgroundIds: [7],
  } as unknown as Parameters<typeof renumberCompartments>[0];

  it('normalises ids and carries every id-keyed array through the same remap', () => {
    const { config, remap } = renumberCompartments(base, [...base.cells]);
    expect(config.cells).toEqual([0, 0, 1, 1]);
    expect(config.compartmentTexts).toEqual(['top', 'bottom']);
    expect(config.backgroundIds).toEqual([1]);
    expect(remap.get(3)).toBe(0);
    expect(remap.get(7)).toBe(1);
  });

  it('remaps a caller-supplied background set instead of the config own', () => {
    const { config } = renumberCompartments(base, [...base.cells], [3]);
    expect(config.backgroundIds).toEqual([0]);
  });
});
