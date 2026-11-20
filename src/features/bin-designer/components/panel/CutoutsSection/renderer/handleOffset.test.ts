import { describe, it, expect } from 'vitest';
import { CORNER_HANDLE_SIZE } from './constants';
import { smallCutoutHandleOffsetPx } from './handleOffset';

describe('smallCutoutHandleOffsetPx', () => {
  it('moves the handles of a cutout under three handles across', () => {
    expect(smallCutoutHandleOffsetPx(2, 10, 4)).toBe(CORNER_HANDLE_SIZE);
  });

  it('leaves the handles of a larger cutout on its edges', () => {
    expect(smallCutoutHandleOffsetPx(10, 10, 4)).toBe(0);
  });
});
