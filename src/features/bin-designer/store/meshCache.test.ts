import { describe, it, expect } from 'vitest';
import { meshByteSize, createCachedMesh, evictIfNeeded } from './meshCacheManager';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { HistoryEntry } from '../types';

function makeEntry(meshSize: number | null): HistoryEntry {
  if (meshSize === null) {
    return { params: { ...DEFAULT_BIN_PARAMS }, mesh: null };
  }
  // Each float = 4 bytes, meshSize = total bytes, so floats = meshSize / 4
  // Split evenly between vertices and normals
  const floatCount = meshSize / 8; // half for each array
  const vertices = new Float32Array(floatCount);
  const normals = new Float32Array(floatCount);
  return {
    params: { ...DEFAULT_BIN_PARAMS },
    mesh: createCachedMesh(vertices, normals, Math.floor(floatCount / 3)),
  };
}

describe('meshByteSize', () => {
  it('should calculate total byte size of vertices + normals', () => {
    const vertices = new Float32Array(300); // 300 * 4 = 1200 bytes
    const normals = new Float32Array(300); // 300 * 4 = 1200 bytes
    expect(meshByteSize(vertices, normals)).toBe(2400);
  });

  it('should return 0 for empty arrays', () => {
    expect(meshByteSize(new Float32Array(0), new Float32Array(0))).toBe(0);
  });
});

describe('createCachedMesh', () => {
  it('should create a CachedMesh with correct byteSize', () => {
    const vertices = new Float32Array(90);
    const normals = new Float32Array(90);
    const result = createCachedMesh(vertices, normals, 30);
    expect(result.triangleCount).toBe(30);
    expect(result.byteSize).toBe(720); // 90*4 * 2
    expect(result.vertices).toBe(vertices);
    expect(result.normals).toBe(normals);
  });
});

describe('evictIfNeeded', () => {
  it('should not modify entries when under budget', () => {
    const past: HistoryEntry[] = [makeEntry(1024), makeEntry(2048)];
    const future: HistoryEntry[] = [makeEntry(1024)];
    const result = evictIfNeeded(past, future);
    expect(result.past).toBe(past); // Same reference = no change
    expect(result.future).toBe(future);
  });

  it('should evict oldest past entries first when over budget', () => {
    // Create entries that exceed 100MB total
    const MB = 1024 * 1024;
    const past: HistoryEntry[] = [
      makeEntry(40 * MB), // oldest — evict first
      makeEntry(40 * MB),
      makeEntry(30 * MB), // keep
    ];
    const future: HistoryEntry[] = [];

    // Total = 110MB > 100MB, need to evict ~10MB
    const result = evictIfNeeded(past, future);
    // First entry should be evicted (mesh null)
    expect(result.past[0].mesh).toBeNull();
    // Remaining should still have meshes (70MB < 100MB)
    expect(result.past[1].mesh).not.toBeNull();
    expect(result.past[2].mesh).not.toBeNull();
  });

  it('should evict future entries (from end) if past eviction insufficient', () => {
    const MB = 1024 * 1024;
    const past: HistoryEntry[] = [makeEntry(60 * MB)];
    const future: HistoryEntry[] = [
      makeEntry(30 * MB), // keep (newer)
      makeEntry(30 * MB), // evict first (oldest in future = last element)
    ];

    // Total = 120MB > 100MB, evict past[0] → 60MB gone → now 60MB ≤ 100MB
    const result = evictIfNeeded(past, future);
    expect(result.past[0].mesh).toBeNull();
    expect(result.future[0].mesh).not.toBeNull();
    expect(result.future[1].mesh).not.toBeNull();
  });

  it('should handle all-null entries gracefully', () => {
    const past: HistoryEntry[] = [makeEntry(null), makeEntry(null)];
    const future: HistoryEntry[] = [makeEntry(null)];
    const result = evictIfNeeded(past, future);
    expect(result.past).toBe(past);
    expect(result.future).toBe(future);
  });

  it('should preserve params when evicting mesh', () => {
    const MB = 1024 * 1024;
    const customParams = { ...DEFAULT_BIN_PARAMS, width: 5, depth: 3 };
    const entry: HistoryEntry = {
      params: customParams,
      mesh: createCachedMesh(
        new Float32Array((60 * MB) / 8),
        new Float32Array((60 * MB) / 8),
        1000
      ),
    };
    const past: HistoryEntry[] = [entry, makeEntry(60 * MB)];
    const result = evictIfNeeded(past, []);
    expect(result.past[0].params).toEqual(customParams);
    expect(result.past[0].mesh).toBeNull();
  });
});
