import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { planLabelSocketKeepouts } from './labelSocketKeepouts';
import { planLabelPlateSeats } from './labelTabBuilder';

const INNER_W = 79.5;
const INNER_D = 36.7;
const INTERIOR_H = 30;

const socketBin = (socketStyle: 'clickIn' | 'slideChannel'): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  wallThickness: 2,
  label: {
    ...DEFAULT_BIN_PARAMS.label,
    enabled: true,
    mode: 'socket',
    depth: 14,
    alignment: 'center',
    socketStyle,
  },
});

describe('planLabelSocketKeepouts', () => {
  it('covers a click-in pocket from its floor, centred on the seat', () => {
    const params = socketBin('clickIn');
    const [seat] = planLabelPlateSeats(params, INNER_W, INNER_D, INTERIOR_H, 2);
    const [box] = planLabelSocketKeepouts(params, INNER_W, INNER_D, INTERIOR_H, 2);
    expect(box.x1 - box.x0).toBeCloseTo(78.3);
    expect(box.y1 - box.y0).toBeCloseTo(11.3);
    expect((box.x0 + box.x1) / 2).toBeCloseTo(seat.x);
    expect((box.y0 + box.y1) / 2).toBeCloseTo(seat.y);
    expect(box.z0).toBeCloseTo(seat.z);
  });

  it('runs a slide channel out past the shelf edge by a plate depth', () => {
    const [box] = planLabelSocketKeepouts(
      socketBin('slideChannel'),
      INNER_W,
      INNER_D,
      INTERIOR_H,
      2
    );
    expect(box.y1).toBeCloseTo(INNER_D / 2 - 1);
    expect(box.y0).toBeCloseTo(INNER_D / 2 - 14 - 11.3);
  });

  it('plans nothing on a custom footprint, which builds no label tabs', () => {
    const params: BinParams = {
      ...socketBin('clickIn'),
      cellMask: { cols: 4, rows: 2, cells: [1, 1, 1, 1, 1, 1, 0, 0] },
    };
    expect(planLabelSocketKeepouts(params, INNER_W, INNER_D, INTERIOR_H, 2)).toEqual([]);
  });

  it('plans nothing for text-mode tabs', () => {
    const params = {
      ...socketBin('clickIn'),
      label: { ...socketBin('clickIn').label, mode: 'text' as const },
    };
    expect(planLabelSocketKeepouts(params, INNER_W, INNER_D, INTERIOR_H, 2)).toEqual([]);
  });
});
