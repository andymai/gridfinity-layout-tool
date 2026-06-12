// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveDefaultParams,
  loadDefaultParams,
  clearDefaultParams,
  hasCustomDefault,
} from './defaultParamsStorage';
import { DEFAULT_BIN_PARAMS, STYLE_DEFAULT_OMIT_KEYS } from '../constants';
import { expectOk } from '@/test/testUtils';
import type { BinParams } from '../types';

const KEY = 'gridfinity-designer-default-params-v1';

describe('defaultParamsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports no custom default and loads null when nothing is stored', () => {
    expect(hasCustomDefault()).toBe(false);
    expect(loadDefaultParams()).toBeNull();
  });

  it('round-trips style preferences through save → load', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 3,
      wallThickness: 2.4,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    };
    expectOk(saveDefaultParams(params));

    expect(hasCustomDefault()).toBe(true);
    const loaded = loadDefaultParams();
    expect(loaded).not.toBeNull();
    expect(loaded?.width).toBe(1);
    expect(loaded?.depth).toBe(3);
    expect(loaded?.wallThickness).toBe(2.4);
    expect(loaded?.scoop.enabled).toBe(true);
  });

  it('strips per-design geometry before persisting', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 2, rows: 2, thickness: 1.6, cells: [0, 1, 2, 3] },
      inserts: [],
      overhang: { left: 5, right: 5, front: 0, back: 0, feet: true },
    };
    expectOk(saveDefaultParams(params));

    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    for (const key of STYLE_DEFAULT_OMIT_KEYS) {
      expect(raw).not.toHaveProperty(key);
    }
  });

  it('backfills stripped geometry to factory defaults on load', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 3, rows: 1, thickness: 1.6, cells: [0, 1, 2] },
      overhang: { left: 9, right: 0, front: 0, back: 0, feet: false },
    };
    expectOk(saveDefaultParams(params));

    const loaded = loadDefaultParams();
    expect(loaded?.compartments).toEqual(DEFAULT_BIN_PARAMS.compartments);
    expect(loaded?.overhang).toEqual(DEFAULT_BIN_PARAMS.overhang);
    expect(loaded?.cellMask).toBeUndefined();
  });

  it('returns null for corrupt JSON', () => {
    localStorage.setItem(KEY, '{not valid json');
    expect(loadDefaultParams()).toBeNull();
  });

  it('drops a structurally-invalid cellMask from a tampered value', () => {
    // A partial mask whose cells length does not match cols*rows is invalid
    // and must be dropped back to the rectangle fast path on load.
    localStorage.setItem(
      KEY,
      JSON.stringify({ width: 2, depth: 2, cellMask: { cols: 4, rows: 4, cells: [1, 0, 1] } })
    );
    const loaded = loadDefaultParams();
    expect(loaded).not.toBeNull();
    expect(loaded?.cellMask).toBeUndefined();
  });

  it('clear removes the stored default', () => {
    expectOk(saveDefaultParams(DEFAULT_BIN_PARAMS));
    expect(hasCustomDefault()).toBe(true);
    clearDefaultParams();
    expect(hasCustomDefault()).toBe(false);
    expect(loadDefaultParams()).toBeNull();
  });
});
