import { afterEach, describe, expect, it } from 'vitest';
import {
  socketMeshKey,
  getSocketMesh,
  setSocketMesh,
  clearSocketMeshCache,
  getSocketMeshCacheStats,
  type CachedSocketMesh,
} from './socketMeshCache';

const fakeEntry = (): CachedSocketMesh => ({
  mesh: {
    vertices: new Float32Array([0, 0, 0]),
    normals: new Float32Array([0, 0, 1]),
    uvs: new Float32Array([0, 0]),
    triangles: new Uint32Array([0, 0, 0]),
    faceGroups: [],
  },
  edgeLines: new Float32Array([0, 0, 0, 1, 1, 1]),
});

afterEach(() => {
  clearSocketMeshCache();
});

describe('socketMeshKey', () => {
  it('changes with tolerance, angular tolerance, and extractor model', () => {
    const base = socketMeshKey('geo', 0.1, 8, false);
    expect(socketMeshKey('geo', 0.2, 8, false)).not.toBe(base);
    expect(socketMeshKey('geo', 0.1, 12, false)).not.toBe(base);
    expect(socketMeshKey('geo', 0.1, 8, true)).not.toBe(base);
  });

  it('changes with the geometry key', () => {
    expect(socketMeshKey('geoA', 0.1, 8, false)).not.toBe(socketMeshKey('geoB', 0.1, 8, false));
  });

  it('is stable for identical inputs', () => {
    expect(socketMeshKey('geo', 0.1, 8, false)).toBe(socketMeshKey('geo', 0.1, 8, false));
  });
});

describe('socket mesh cache', () => {
  it('returns null on miss and the stored entry on hit', () => {
    const key = socketMeshKey('geo', 0.1, 8, false);
    expect(getSocketMesh(key)).toBeNull();

    const entry = fakeEntry();
    setSocketMesh(key, entry);
    expect(getSocketMesh(key)).toBe(entry);
  });

  it('isolates entries by key', () => {
    const a = socketMeshKey('geoA', 0.1, 8, false);
    const b = socketMeshKey('geoB', 0.1, 8, false);
    const entry = fakeEntry();
    setSocketMesh(a, entry);
    expect(getSocketMesh(b)).toBeNull();
  });

  it('clears on clearSocketMeshCache (kernel switch)', () => {
    const key = socketMeshKey('geo', 0.1, 8, false);
    setSocketMesh(key, fakeEntry());
    expect(getSocketMesh(key)).not.toBeNull();

    clearSocketMeshCache();
    expect(getSocketMesh(key)).toBeNull();
    expect(getSocketMeshCacheStats().size).toBe(0);
  });

  it('resets hit/miss counters on clear (no stale cross-kernel totals)', () => {
    const key = socketMeshKey('geo', 0.1, 8, false);
    setSocketMesh(key, fakeEntry());
    getSocketMesh(key); // hit
    getSocketMesh(socketMeshKey('absent', 0.1, 8, false)); // miss
    expect(getSocketMeshCacheStats().hits + getSocketMeshCacheStats().misses).toBeGreaterThan(0);

    clearSocketMeshCache();
    const stats = getSocketMeshCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.evictions).toBe(0);
  });
});
