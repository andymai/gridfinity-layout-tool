/**
 * Generic LRU (Least Recently Used) cache backed by a Map.
 *
 * Uses Map's insertion-order iteration: the first key is always the
 * least recently used. On `get`, the entry is moved to the newest
 * position (delete + re-insert). On `set`, the oldest entry is
 * evicted if the cache is at capacity.
 */
export class LRUCache<T> {
  private readonly map = new Map<string, T>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;

    // Move to newest position
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    // If key already exists, delete to refresh position
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // Evict oldest (first key in Map iteration order)
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
    this.map.set(key, value);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
