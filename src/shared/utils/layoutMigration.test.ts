import { describe, it, expect } from 'vitest';
import { CONSTRAINTS } from '@/core/constants';
import { migrateLayoutFields } from './layoutMigration';

const migrate = (data: Record<string, unknown>): Record<string, unknown> =>
  migrateLayoutFields(data) as Record<string, unknown>;

describe('migrateLayoutFields', () => {
  it('fills the unit and print bed sizes when absent', () => {
    expect(migrate({ name: 'x' })).toEqual({
      name: 'x',
      gridUnitMm: CONSTRAINTS.GRID_UNIT_MM_DEFAULT,
      heightUnitMm: CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT,
      printBedSize: CONSTRAINTS.PRINT_BED_MM_DEFAULT,
    });
  });

  it('treats null sizes as absent', () => {
    const result = migrate({ gridUnitMm: null, heightUnitMm: null, printBedSize: null });

    expect(result.gridUnitMm).toBe(CONSTRAINTS.GRID_UNIT_MM_DEFAULT);
    expect(result.heightUnitMm).toBe(CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT);
    expect(result.printBedSize).toBe(CONSTRAINTS.PRINT_BED_MM_DEFAULT);
  });

  it('converts a legacy maxPrintSize in grid units to a printBedSize in mm', () => {
    const result = migrate({ maxPrintSize: 10 });

    expect(result.printBedSize).toBe(420);
    expect(result).not.toHaveProperty('maxPrintSize');
  });

  it('scales a legacy maxPrintSize by the layout grid unit', () => {
    expect(migrate({ maxPrintSize: 5, gridUnitMm: 40 }).printBedSize).toBe(200);
  });

  it('prefers printBedSize over a leftover maxPrintSize', () => {
    const result = migrate({ printBedSize: 300, maxPrintSize: 10 });

    expect(result.printBedSize).toBe(300);
    expect(result).not.toHaveProperty('maxPrintSize');
  });

  it('reads a printBedSize under the mm minimum as grid units', () => {
    expect(migrate({ printBedSize: 6 }).printBedSize).toBe(252);
  });

  it('keeps provided sizes and leaves the input untouched', () => {
    const input = { gridUnitMm: 40, heightUnitMm: 6, printBedSize: 180, maxPrintSize: 3 };

    const result = migrate(input);

    expect(result).toEqual({ gridUnitMm: 40, heightUnitMm: 6, printBedSize: 180 });
    expect(input).toHaveProperty('maxPrintSize', 3);
  });

  it('sanitizes bin items and leaves bins without them untouched', () => {
    const plain = { id: 'b0', label: 'x' };
    const result = migrate({
      bins: [plain, { id: 'b1', items: [{ id: 'i1', name: 'Screws' }, { id: '' }] }],
    });
    const bins = result.bins as Record<string, unknown>[];
    expect(bins[0]).toBe(plain);
    expect(bins[1].items).toEqual([{ id: 'i1', name: 'Screws' }]);
  });
});
