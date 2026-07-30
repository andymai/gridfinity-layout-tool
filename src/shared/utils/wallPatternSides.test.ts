import { describe, it, expect } from 'vitest';
import { resolveWallPatternSides, hasAnyPatternedWall } from './wallPatternSides';
import type { WallPatternConfig } from '@/shared/types/bin';

const base: WallPatternConfig = { enabled: true, pattern: 'honeycomb' };

describe('resolveWallPatternSides', () => {
  it('treats a missing config as all four walls (pre-#2966 designs)', () => {
    expect(resolveWallPatternSides(base)).toEqual({
      left: true,
      right: true,
      front: true,
      back: true,
    });
  });

  it('passes an explicit selection through', () => {
    expect(
      resolveWallPatternSides({
        ...base,
        sides: { left: false, right: false, front: true, back: false },
      })
    ).toEqual({ left: false, right: false, front: true, back: false });
  });

  it('reads a side missing from a partial persisted object as ON', () => {
    // Only `false` turns a wall off, so a payload written by an older client
    // (or one key short) can never silently blank a wall that used to pattern.
    const partial = { ...base, sides: { front: false } as WallPatternConfig['sides'] };
    expect(resolveWallPatternSides(partial)).toEqual({
      left: true,
      right: true,
      front: false,
      back: true,
    });
  });
});

describe('hasAnyPatternedWall', () => {
  it('is true for a default config', () => {
    expect(hasAnyPatternedWall(base)).toBe(true);
  });

  it('is true when a single wall survives', () => {
    expect(
      hasAnyPatternedWall({
        ...base,
        sides: { left: false, right: true, front: false, back: false },
      })
    ).toBe(true);
  });

  it('is false when every wall is deselected', () => {
    expect(
      hasAnyPatternedWall({
        ...base,
        sides: { left: false, right: false, front: false, back: false },
      })
    ).toBe(false);
  });
});
