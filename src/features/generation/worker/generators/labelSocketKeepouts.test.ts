import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { LABEL_SOCKET_STACK_RELIEF_MM } from '@/shared/constants/labelPlates';
import { planLabelShelfKeepouts, planLabelSocketKeepouts } from './labelSocketKeepouts';
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

describe('planLabelShelfKeepouts', () => {
  const lipped = (label: Partial<BinParams['label']> = {}): BinParams => {
    const params = socketBin('clickIn');
    return {
      ...params,
      base: { ...params.base, stackingLip: true },
      label: { ...params.label, alignment: 'left', width: 50, ...label },
    };
  };
  const plan = (params: BinParams) =>
    planLabelShelfKeepouts(params, INNER_W, INNER_D, INTERIOR_H, 2);

  it("covers a click-in tab held below a lipped bin's ceiling, from its top", () => {
    const [box] = plan(lipped());
    expect(box.z0).toBeCloseTo(INTERIOR_H - LABEL_SOCKET_STACK_RELIEF_MM);
    expect(box.y0).toBeCloseTo(INNER_D / 2 - 14);
    expect(box.y1).toBeGreaterThan(INNER_D / 2);
    expect(box.x0).toBeLessThan(-INNER_W / 2);
  });

  it('stops at a tab end that shares nothing with a wall', () => {
    const [box] = plan(lipped());
    expect(box.x1).toBeCloseTo(-INNER_W / 2 + INNER_W * 0.5, 0);
    expect(box.x1).toBeLessThan(INNER_W / 2);
  });

  it('covers a tab anchored to the front wall from the other side', () => {
    const [box] = plan(lipped({ edges: 'front' }));
    expect(box.y0).toBeLessThan(-INNER_D / 2);
    expect(box.y1).toBeCloseTo(-INNER_D / 2 + 14);
  });

  it('covers a text tab sunk to make room for its rim', () => {
    const [box] = plan(lipped({ mode: 'text', lip: true, lipHeight: 1 }));
    expect(box.z0).toBeCloseTo(INTERIOR_H - 1);
  });

  it('leaves a tab that already reaches the ceiling alone', () => {
    const params = lipped();
    expect(plan({ ...params, base: { ...params.base, stackingLip: false } })).toEqual([]);
    expect(plan(lipped({ socketStyle: 'slideChannel' }))).toEqual([]);
  });

  it('leaves a tab the user lowered, whose corner keeps its rounding', () => {
    expect(plan(lipped({ height: 20 }))).toEqual([]);
  });

  it('plans nothing with tabs off, or on a custom footprint', () => {
    expect(plan(lipped({ enabled: false }))).toEqual([]);
    expect(
      plan({ ...lipped(), cellMask: { cols: 4, rows: 2, cells: [1, 1, 1, 1, 1, 1, 0, 0] } })
    ).toEqual([]);
  });
});
