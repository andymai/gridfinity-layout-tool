import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { binHasWallSlots } from './wallSlots';

const slotted = (over: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  style: 'slotted',
  ...over,
});
const axes = (pitch: number, y = false): BinParams['slotConfig'] => ({
  ...DEFAULT_BIN_PARAMS.slotConfig,
  x: { enabled: true, pitch },
  y: { enabled: y, pitch },
});

describe('binHasWallSlots', () => {
  it('finds slots when the spacing places a divider', () => {
    expect(binHasWallSlots(slotted({ width: 2, depth: 2, slotConfig: axes(20) }))).toBe(true);
  });

  it('finds none when an enabled axis places no divider', () => {
    expect(binHasWallSlots(slotted({ width: 1, depth: 1, slotConfig: axes(40) }))).toBe(false);
    expect(binHasWallSlots(slotted({ width: 1, depth: 1, slotConfig: axes(50, true) }))).toBe(
      false
    );
  });

  it('finds none on a bin without removable dividers or with walls too thin for slots', () => {
    expect(binHasWallSlots({ ...slotted({ slotConfig: axes(20) }), style: 'standard' })).toBe(
      false
    );
    expect(binHasWallSlots(slotted({ wallThickness: 0.4, slotConfig: axes(20) }))).toBe(false);
  });

  it('needs a custom-grid piece that reaches a wall', () => {
    const custom = (cells: number[]): BinParams =>
      slotted({
        width: 3,
        depth: 3,
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          layout: 'custom',
          customGrid: { cols: 3, rows: 3, cells },
        },
      });
    // Two columns split by a wall-to-wall divider.
    expect(binHasWallSlots(custom([0, 1, 1, 0, 1, 1, 0, 1, 1]))).toBe(true);
    // A closed square round the centre cell touches no bin wall.
    expect(binHasWallSlots(custom([0, 0, 0, 0, 1, 0, 0, 0, 0]))).toBe(false);
  });
});
