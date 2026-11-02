import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { heightForCutDepth } from './heightForCutDepth';

// 3u on a 4.75mm socket holds 16.25mm; each extra unit adds 7mm.
describe('heightForCutDepth', () => {
  it('finds the shortest bin whose fill holds the depth', () => {
    expect(heightForCutDepth(DEFAULT_BIN_PARAMS, 17)).toBe(4);
    expect(heightForCutDepth(DEFAULT_BIN_PARAMS, 23.25)).toBe(4);
    expect(heightForCutDepth(DEFAULT_BIN_PARAMS, 23.3)).toBe(5);
  });

  it('accounts for a lowered fill', () => {
    const lowered = { ...DEFAULT_BIN_PARAMS, cutoutConfig: { topOffset: 5 } };
    expect(heightForCutDepth(lowered, 18.25)).toBe(4);
    expect(heightForCutDepth(lowered, 19)).toBe(5);
  });

  it('offers nothing when the fill is held to the floor', () => {
    const floored = {
      ...DEFAULT_BIN_PARAMS,
      cutoutConfig: { topOffset: 0, fillReference: 'floor' as const },
    };
    expect(heightForCutDepth(floored, 17)).toBeNull();
  });

  it('offers nothing past the tallest bin', () => {
    expect(heightForCutDepth(DEFAULT_BIN_PARAMS, 1000)).toBeNull();
  });
});
