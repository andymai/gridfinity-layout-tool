import { describe, it, expect } from 'vitest';
import { LRUCache } from './lruCache';

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
  });

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<number>(3);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts oldest entry when at capacity', () => {
    const cache = new LRUCache<number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // evicts 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
    expect(cache.size).toBe(3);
  });

  it('promotes accessed entries to newest position', () => {
    const cache = new LRUCache<number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Access 'a' to promote it
    cache.get('a');

    // Now 'b' is the oldest — should be evicted
    cache.set('d', 4);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
  });

  it('overwrites existing key and refreshes position', () => {
    const cache = new LRUCache<number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Overwrite 'a' — refreshes its position
    cache.set('a', 10);

    // 'b' is now oldest
    cache.set('d', 4);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(10);
    expect(cache.size).toBe(3);
  });

  it('tracks size correctly', () => {
    const cache = new LRUCache<string>(5);
    expect(cache.size).toBe(0);
    cache.set('a', 'x');
    expect(cache.size).toBe(1);
    cache.set('b', 'y');
    expect(cache.size).toBe(2);
  });

  it('clears all entries', () => {
    const cache = new LRUCache<number>(5);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('works with maxSize of 1', () => {
    const cache = new LRUCache<number>(1);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    cache.set('b', 2);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(1);
  });
});
