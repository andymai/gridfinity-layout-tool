import { describe, it, expect, vi } from 'vitest';
import { LRUCache } from './lruCache';

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<number>('test', 3);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
  });

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<number>('test', 3);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts oldest entry when at capacity', () => {
    const cache = new LRUCache<number>('test', 3);
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
    const cache = new LRUCache<number>('test', 3);
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
    const cache = new LRUCache<number>('test', 3);
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
    const cache = new LRUCache<string>('test', 5);
    expect(cache.size).toBe(0);
    cache.set('a', 'x');
    expect(cache.size).toBe(1);
    cache.set('b', 'y');
    expect(cache.size).toBe(2);
  });

  it('clears all entries', () => {
    const cache = new LRUCache<number>('test', 5);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('works with maxSize of 1', () => {
    const cache = new LRUCache<number>('test', 1);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    cache.set('b', 2);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(1);
  });

  describe('onEvict callback', () => {
    it('calls onEvict on capacity eviction', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<number>('test', 2, onEvict);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // evicts 'a'

      expect(onEvict).toHaveBeenCalledOnce();
      expect(onEvict).toHaveBeenCalledWith('a', 1);
    });

    it('calls onEvict on key overwrite with old value', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<number>('test', 3, onEvict);
      cache.set('a', 1);
      cache.set('a', 2); // overwrites 'a'

      expect(onEvict).toHaveBeenCalledOnce();
      expect(onEvict).toHaveBeenCalledWith('a', 1);
    });

    it('does not call onEvict when overwriting with same reference', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<object>('test', 3, onEvict);
      const obj = { value: 1 };
      cache.set('a', obj);
      cache.set('a', obj); // same reference

      expect(onEvict).not.toHaveBeenCalled();
    });

    it('dispose() calls onEvict for all entries then clears', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<number>('test', 5, onEvict);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.dispose();

      expect(onEvict).toHaveBeenCalledTimes(3);
      expect(onEvict).toHaveBeenCalledWith('a', 1);
      expect(onEvict).toHaveBeenCalledWith('b', 2);
      expect(onEvict).toHaveBeenCalledWith('c', 3);
      expect(cache.size).toBe(0);
    });

    it('dispose() is safe on empty cache', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<number>('test', 3, onEvict);

      cache.dispose();

      expect(onEvict).not.toHaveBeenCalled();
      expect(cache.size).toBe(0);
    });
  });

  describe('stats tracking', () => {
    it('tracks hits and misses', () => {
      const cache = new LRUCache<number>('stats-test', 3);
      cache.set('a', 1);
      cache.get('a'); // hit
      cache.get('b'); // miss
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.name).toBe('stats-test');
    });

    it('tracks evictions on capacity overflow', () => {
      const cache = new LRUCache<number>('evict-test', 2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // evicts 'a'
      expect(cache.getStats().evictions).toBe(1);
    });

    it('tracks evictions on value replacement', () => {
      const cache = new LRUCache<number>('replace-test', 3);
      cache.set('a', 1);
      cache.set('a', 2); // replaces with different value
      expect(cache.getStats().evictions).toBe(1);
    });

    it('does not count eviction when same value is set', () => {
      const cache = new LRUCache<number>('same-val-test', 3);
      cache.set('a', 1);
      cache.set('a', 1); // same value
      expect(cache.getStats().evictions).toBe(0);
    });

    it('resetStats zeroes all counters', () => {
      const cache = new LRUCache<number>('reset-test', 2);
      cache.set('a', 1);
      cache.get('a');
      cache.get('b');
      cache.set('c', 3); // evicts
      cache.resetStats();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });

    it('stats survive clear()', () => {
      const cache = new LRUCache<number>('clear-test', 3);
      cache.set('a', 1);
      cache.get('a');
      cache.clear();
      expect(cache.getStats().hits).toBe(1);
      expect(cache.getStats().size).toBe(0);
    });

    it('reports current size and maxSize', () => {
      const cache = new LRUCache<number>('size-test', 5);
      cache.set('a', 1);
      cache.set('b', 2);
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
    });
  });
});
