/**
 * Byte-budgeted LRU over completed generations, keyed by params fingerprint.
 *
 * This was a single slot holding only the most recent result, which made the
 * cache a debounce guard rather than a cache: every edit that returns to a
 * shape already built — toggle a feature on and back off, drag a slider home,
 * step a value up then down — evicted the mesh it was about to ask for and
 * re-ran the whole worker pipeline for it. The kernel is the slowest thing in
 * the app, so that is a 1-4s wait for geometry the tab computed seconds ago.
 *
 * Not a replacement for `meshPersistence` (IndexedDB, survives reload, strips
 * label plates because the layout planner shares those entries). This one is
 * in-memory, holds the exact result the designer asked for — plates included —
 * and dies with the bridge.
 *
 * Serving an entry twice is safe: the worker clones every buffer before
 * transfer, and nothing on the main thread ever transfers them onward, so a
 * cached result cannot be handed out detached. It does mean the worker's
 * `lastSolid` no longer corresponds to what was just returned, which is
 * already true of any cache hit — the export path re-checks the solid's
 * identity fingerprint rather than trusting recency.
 */

import { meshDataByteSize } from '@/shared/generation/meshBytes';
import type { GenerationResult } from './bridgeTypes';

/**
 * Byte budget for one cache.
 *
 * Measured preview meshes run 160KB (a 2x2x3 bin) to ~1.1MB (6x6), so this
 * holds tens of ordinary shapes and still several of the heaviest — far more
 * than the handful an edit realistically oscillates between. A bridge owns
 * three caches but a given route only fills one of them, so this is the
 * practical per-bridge ceiling, and it sits well under the undo history's own
 * 100MB mesh budget, which already holds most of the same meshes keyed by
 * history position rather than by params.
 */
export const RESULT_CACHE_MAX_BYTES = 16 * 1024 * 1024;

interface Entry {
  readonly result: GenerationResult;
  readonly byteSize: number;
}

export class GenerationResultCache {
  /** Insertion order IS recency order: a read re-inserts, so the oldest key is first. */
  private readonly entries = new Map<string, Entry>();
  private bytes = 0;
  /** Fingerprint of the in-flight request, held so its result can be keyed on arrival. */
  private pending: string | null = null;
  private readonly maxBytes: number;

  constructor(maxBytes: number = RESULT_CACHE_MAX_BYTES) {
    this.maxBytes = maxBytes;
  }

  /** The result for `fingerprint`, promoted to most-recently-used, or null. */
  get(fingerprint: string): GenerationResult | null {
    const entry = this.entries.get(fingerprint);
    if (!entry) return null;
    this.entries.delete(fingerprint);
    this.entries.set(fingerprint, entry);
    return entry.result;
  }

  /** Record which fingerprint the request now in flight was built from. */
  setPending(fingerprint: string): void {
    this.pending = fingerprint;
  }

  /** Drop the in-flight fingerprint without storing anything (cancel, error, teardown). */
  clearPending(): void {
    this.pending = null;
  }

  /**
   * Store `result` under the pending fingerprint, if this cache is the one
   * with a request in flight. A no-op otherwise — the three caches share one
   * request channel, so all three are offered every result and only the
   * originator claims it.
   */
  commit(result: GenerationResult): void {
    const fingerprint = this.pending;
    if (fingerprint === null) return;
    this.pending = null;

    const byteSize = meshDataByteSize(result.mesh);
    // A single result larger than the whole budget would evict everything and
    // then itself; keep it out rather than emptying the cache to hold nothing.
    if (byteSize > this.maxBytes) return;

    const existing = this.entries.get(fingerprint);
    if (existing) this.bytes -= existing.byteSize;
    this.entries.delete(fingerprint);
    this.entries.set(fingerprint, { result, byteSize });
    this.bytes += byteSize;

    for (const key of this.entries.keys()) {
      if (this.bytes <= this.maxBytes) break;
      const evicted = this.entries.get(key);
      if (evicted) this.bytes -= evicted.byteSize;
      this.entries.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
    this.bytes = 0;
    this.pending = null;
  }

  /** @internal — for tests and the dev perf overlay. */
  get stats(): { size: number; bytes: number } {
    return { size: this.entries.size, bytes: this.bytes };
  }
}
