/**
 * Generic LRU (Least Recently Used) cache backed by a Map.
 *
 * Uses Map's insertion-order iteration: the first key is always the
 * least recently used. On `get`, the entry is moved to the newest
 * position (delete + re-insert). On `set`, the oldest entries are
 * evicted until the new one fits.
 *
 * Capacity counts entries, or with `weigh` the summed weight of the entries
 * (a set-valued cache weighs each set by its length). An entry heavier than
 * the whole budget is still kept, alone.
 */

export interface CacheStats {
  readonly name: string;
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly size: number;
  readonly maxSize: number;
}

export class LRUCache<T> {
  private readonly map = new Map<string, T>();
  private readonly name: string;
  private readonly maxSize: number;
  private readonly onEvict?: (key: string, value: T) => void;
  private readonly weigh: (value: T) => number;
  private totalWeight = 0;

  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;

  constructor(
    name: string,
    maxSize: number,
    onEvict?: (key: string, value: T) => void,
    weigh: (value: T) => number = () => 1
  ) {
    this.name = name;
    this.maxSize = maxSize;
    this.onEvict = onEvict;
    this.weigh = weigh;
  }

  get(key: string): T | undefined {
    const value = this.map.get(key);
    if (value === undefined) {
      this._misses++;
      return undefined;
    }

    this._hits++;
    // Move to newest position
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    const existing = this.map.get(key);
    if (existing !== undefined) {
      // Key exists — delete to refresh position
      this.map.delete(key);
      this.totalWeight -= this.weigh(existing);
      if (existing !== value) {
        this._evictions++;
        this.onEvict?.(key, existing);
      }
    }
    const weight = this.weigh(value);
    // Evict oldest (first key in Map iteration order) until the new entry fits.
    for (const [oldestKey, evicted] of this.map) {
      if (this.totalWeight + weight <= this.maxSize) break;
      this.map.delete(oldestKey);
      this.totalWeight -= this.weigh(evicted);
      this._evictions++;
      this.onEvict?.(oldestKey, evicted);
    }
    this.map.set(key, value);
    this.totalWeight += weight;
  }

  get size(): number {
    return this.map.size;
  }

  getStats(): CacheStats {
    return {
      name: this.name,
      hits: this._hits,
      misses: this._misses,
      evictions: this._evictions,
      size: this.map.size,
      maxSize: this.maxSize,
    };
  }

  resetStats(): void {
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
  }

  clear(): void {
    this.map.clear();
    this.totalWeight = 0;
  }

  /** Calls onEvict for every entry, then clears the cache. */
  dispose(): void {
    if (this.onEvict) {
      for (const [key, value] of this.map) {
        this.onEvict(key, value);
      }
    }
    this.map.clear();
    this.totalWeight = 0;
  }
}
