import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, CompartmentConfig } from '@/shared/types/bin';
import { DEFAULT_PULL_TAB } from './pullTabPlan';
import { pullTabCenterAxes, resolvePullTabCenter, wallToWallDividers } from './pullTabCenterPlan';

const grid = (cols: number, rows: number, cells?: number[]): CompartmentConfig => ({
  ...DEFAULT_BIN_PARAMS.compartments,
  cols,
  rows,
  cells: cells ?? Array.from({ length: cols * rows }, (_, i) => i),
});

const bin = (compartments: CompartmentConfig, more: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  compartments,
  pullTab: { ...DEFAULT_PULL_TAB, enabled: true, walls: ['center'] },
  ...more,
});

describe('wallToWallDividers', () => {
  it('finds row and column dividers, nearest the middle first', () => {
    expect(wallToWallDividers(grid(1, 2), 'width')).toEqual([0.5]);
    expect(wallToWallDividers(grid(1, 2), 'depth')).toEqual([]);
    expect(wallToWallDividers(grid(4, 1), 'depth')).toEqual([0.5, 0.25, 0.75]);
    expect(wallToWallDividers(grid(1, 3), 'width')).toEqual([1 / 3, 2 / 3]);
  });

  it('skips a line that merged cells interrupt', () => {
    // Cell 1 spans both rows, breaking the row divider in the middle column.
    const tall = grid(3, 2, [0, 1, 2, 3, 1, 5]);
    expect(wallToWallDividers(tall, 'width')).toEqual([]);
    expect(wallToWallDividers(tall, 'depth')).toEqual([1 / 3, 2 / 3]);
    // Cell 0 spans both columns, breaking the column divider in the front row.
    const wide = grid(2, 2, [0, 0, 1, 2]);
    expect(wallToWallDividers(wide, 'width')).toEqual([0.5]);
    expect(wallToWallDividers(wide, 'depth')).toEqual([]);
  });

  it('skips a divider that is tilted or shifted off its line', () => {
    const tilted: CompartmentConfig = {
      ...grid(2, 1),
      dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 2, offsetEnd: -2 }],
    };
    expect(wallToWallDividers(tilted, 'depth')).toEqual([]);
  });

  it('returns nothing for a malformed grid', () => {
    expect(wallToWallDividers({ ...grid(2, 2), cells: [0, 1] }, 'width')).toEqual([]);
  });
});

describe('resolvePullTabCenter', () => {
  // The height a full divider reaches in these fixtures.
  const INTERIOR = 15.3;
  const resolve = (p: BinParams) => resolvePullTabCenter(p, INTERIOR);

  it('takes the picked axis while it has a divider, else the only one that does', () => {
    const both = grid(2, 2);
    expect(resolve(bin(both)).divider).toEqual({ axis: 'width', at: 0.5 });
    const picked = bin(both, {
      pullTab: { ...DEFAULT_PULL_TAB, enabled: true, walls: ['center'], centerAxis: 'depth' },
    });
    expect(resolve(picked).divider).toEqual({ axis: 'depth', at: 0.5 });
    expect(resolve(bin(grid(3, 1))).divider).toEqual({ axis: 'depth', at: 1 / 3 });
    expect(pullTabCenterAxes(both)).toEqual(['width', 'depth']);
    expect(pullTabCenterAxes(grid(3, 1))).toEqual(['depth']);
  });

  it('explains why no divider can carry a tab', () => {
    expect(resolve(bin(grid(1, 1))).reason).toBe('binDesigner.pullTab.center.noDivider');
    expect(resolve(bin({ ...grid(2, 1), dividerHeight: 4 })).reason).toBe(
      'binDesigner.pullTab.center.lowDivider'
    );
    expect(resolve(bin(grid(2, 1), { extraWallHeightMm: 4 })).reason).toBe(
      'binDesigner.pullTab.center.collar'
    );
    expect(
      resolve(bin(grid(2, 1), { label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } })).reason
    ).toBe('binDesigner.pullTab.center.labelTabs');
  });

  it('blocks only a divider lowered below the interior, whatever form full height takes', () => {
    for (const dividerHeight of ['auto', undefined, INTERIOR, 40] as const) {
      expect(resolve(bin({ ...grid(2, 1), dividerHeight })).divider, String(dividerHeight)).toEqual(
        { axis: 'depth', at: 0.5 }
      );
    }
    expect(resolve(bin({ ...grid(2, 1), dividerHeight: INTERIOR - 0.1 })).reason).toBe(
      'binDesigner.pullTab.center.lowDivider'
    );
    expect(resolvePullTabCenter(bin({ ...grid(2, 1), dividerHeight: 4 }), null).divider).toEqual({
      axis: 'depth',
      at: 0.5,
    });
  });
});
