import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_TRAY_BOTTOM } from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';
import { getSlotFreeWalls, hasSlotFreeWall, isSlottedBody } from './slotFreeWalls';

function slotted(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, style: 'slotted', ...overrides };
}

function axes(x: boolean, y: boolean): BinParams['slotConfig'] {
  return {
    ...DEFAULT_BIN_PARAMS.slotConfig,
    x: { enabled: x, pitch: 20 },
    y: { enabled: y, pitch: 20 },
  };
}

describe('getSlotFreeWalls', () => {
  it('leaves every wall free on a non-slotted bin', () => {
    expect(getSlotFreeWalls(DEFAULT_BIN_PARAMS)).toEqual({
      front: true,
      back: true,
      left: true,
      right: true,
    });
  });

  it('gives the left and right walls to X-axis slots', () => {
    expect(getSlotFreeWalls(slotted({ slotConfig: axes(true, false) }))).toEqual({
      front: true,
      back: true,
      left: false,
      right: false,
    });
  });

  it('gives the front and back walls to Y-axis slots', () => {
    expect(getSlotFreeWalls(slotted({ slotConfig: axes(false, true) }))).toEqual({
      front: false,
      back: false,
      left: true,
      right: true,
    });
  });
});

describe('hasSlotFreeWall', () => {
  it('is false only when both axes claim their pair', () => {
    expect(hasSlotFreeWall(slotted({ slotConfig: axes(true, false) }))).toBe(true);
    expect(hasSlotFreeWall(slotted({ slotConfig: axes(false, true) }))).toBe(true);
    expect(hasSlotFreeWall(slotted({ slotConfig: axes(true, true) }))).toBe(false);
  });
});

describe('isSlottedBody', () => {
  it('holds for the slotted style', () => {
    expect(isSlottedBody(slotted())).toBe(true);
    expect(isSlottedBody(DEFAULT_BIN_PARAMS)).toBe(false);
  });

  it('refuses a nesting base, whose floor plane takes no slots', () => {
    const nesting = slotted({
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'lid',
        trayBottom: { ...DEFAULT_TRAY_BOTTOM, floorAtBed: true },
      },
    });
    expect(isSlottedBody(nesting)).toBe(false);
  });
});
