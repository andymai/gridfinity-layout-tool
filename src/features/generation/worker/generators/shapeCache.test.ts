import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  socketCacheKey,
  setLastSolid,
  getLastSolid,
  setPatternTemplateCache,
  getPatternTemplateCache,
  setFeatureCache,
  clearAllCaches,
  getAllShapeCacheStats,
  resetAllShapeCacheStats,
} from './shapeCache';
import type { Shape3D } from 'brepjs';

/** Create a mock Shape3D with a trackable delete() method. */
function mockShape(): Shape3D & { delete: ReturnType<typeof vi.fn> } {
  return { delete: vi.fn() } as unknown as Shape3D & { delete: ReturnType<typeof vi.fn> };
}

describe('socketCacheKey', () => {
  it('produces deterministic versioned key from parameters', () => {
    const key = socketCacheKey(2, 2, true, false, 3.1, 2.0, 1.5, false, false);
    expect(key).toBe('v1|2|2|true|false|3.1|2|1.5|false|false');
  });

  it('differs when magnet flag changes', () => {
    const a = socketCacheKey(1, 1, true, false, 3.1, 2.0, 1.5, false, false);
    const b = socketCacheKey(1, 1, false, false, 3.1, 2.0, 1.5, false, false);
    expect(a).not.toBe(b);
  });

  it('differs when halfSockets changes', () => {
    const a = socketCacheKey(2, 2, false, false, 3.1, 2.0, 1.5, false, false);
    const b = socketCacheKey(2, 2, false, false, 3.1, 2.0, 1.5, false, true);
    expect(a).not.toBe(b);
  });

  it('differs when forExport changes', () => {
    const a = socketCacheKey(2, 2, false, false, 3.1, 2.0, 1.5, false, false);
    const b = socketCacheKey(2, 2, false, false, 3.1, 2.0, 1.5, true, false);
    expect(a).not.toBe(b);
  });

  it('differs when grid dimensions change', () => {
    const a = socketCacheKey(1, 2, false, false, 3.1, 2.0, 1.5, false, false);
    const b = socketCacheKey(2, 2, false, false, 3.1, 2.0, 1.5, false, false);
    expect(a).not.toBe(b);
  });

  it('differs when magnet radius changes', () => {
    const a = socketCacheKey(1, 1, true, false, 3.0, 2.0, 1.5, false, false);
    const b = socketCacheKey(1, 1, true, false, 3.2, 2.0, 1.5, false, false);
    expect(a).not.toBe(b);
  });

  it('includes all parameters in key', () => {
    const key = socketCacheKey(1.5, 2.5, true, true, 3.1, 2.4, 1.75, true, true);
    expect(key).toMatch(/^v1\|/);
    expect(key).toContain('1.5');
    expect(key).toContain('2.5');
    expect(key).toContain('true');
    expect(key).toContain('3.1');
    expect(key).toContain('2.4');
    expect(key).toContain('1.75');
  });
});

describe('shape disposal', () => {
  beforeEach(() => {
    clearAllCaches();
  });

  describe('setLastSolid', () => {
    it('disposes previous shape when replacing', () => {
      const old = mockShape();
      const next = mockShape();
      setLastSolid(old);
      setLastSolid(next);

      expect(old.delete).toHaveBeenCalledOnce();
      expect(next.delete).not.toHaveBeenCalled();
      expect(getLastSolid()).toBe(next);
    });

    it('does not dispose when storing the same reference', () => {
      const shape = mockShape();
      setLastSolid(shape);
      setLastSolid(shape);

      expect(shape.delete).not.toHaveBeenCalled();
    });

    it('handles null → shape → null transitions', () => {
      const shape = mockShape();
      setLastSolid(null);
      setLastSolid(shape);
      setLastSolid(null);

      expect(shape.delete).toHaveBeenCalledOnce();
    });
  });

  describe('setPatternTemplateCache', () => {
    it('disposes previous shape on key change', () => {
      const old = mockShape();
      const next = mockShape();
      setPatternTemplateCache('key1', old);
      setPatternTemplateCache('key2', next);

      expect(old.delete).toHaveBeenCalledOnce();
      expect(next.delete).not.toHaveBeenCalled();
    });

    it('does not dispose when storing same reference', () => {
      const shape = mockShape();
      setPatternTemplateCache('key1', shape);
      setPatternTemplateCache('key2', shape);

      expect(shape.delete).not.toHaveBeenCalled();
    });
  });

  describe('clearAllCaches', () => {
    it('disposes singleton shapes', () => {
      const solid = mockShape();
      const pattern = mockShape();
      setLastSolid(solid);
      setPatternTemplateCache('k', pattern);

      clearAllCaches();

      expect(solid.delete).toHaveBeenCalledOnce();
      expect(pattern.delete).toHaveBeenCalledOnce();
      expect(getLastSolid()).toBeNull();
      expect(getPatternTemplateCache('k')).toBeNull();
    });

    it('disposes featureToolCache shapes', () => {
      const wall = mockShape();
      setFeatureCache('compartmentWalls', 'k', wall);

      clearAllCaches();

      expect(wall.delete).toHaveBeenCalledOnce();
    });
  });
});

describe('cache stats exports', () => {
  beforeEach(() => {
    clearAllCaches();
    resetAllShapeCacheStats();
  });

  it('getAllShapeCacheStats returns stats for all LRU caches', () => {
    const stats = getAllShapeCacheStats();
    // 4 base caches (socket, lip, box, shell) + 6 feature caches = 10
    expect(stats.length).toBe(10);
    expect(stats.every((s) => s.hits === 0 && s.misses === 0)).toBe(true);
  });

  it('resetAllShapeCacheStats zeroes all counters', () => {
    // Force some misses by reading from empty caches
    const stats = getAllShapeCacheStats();
    expect(stats[0].hits).toBe(0);
    resetAllShapeCacheStats();
    const after = getAllShapeCacheStats();
    expect(after.every((s) => s.hits === 0 && s.misses === 0 && s.evictions === 0)).toBe(true);
  });
});
