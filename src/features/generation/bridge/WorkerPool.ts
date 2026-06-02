/**
 * Shared worker pool for parallel geometry generation.
 *
 * Manages multiple GenerationBridge instances (each wrapping its own Web Worker
 * with independent OpenCascade WASM), distributes work round-robin across them,
 * and collects results via Promise.all.
 *
 * Supports two operation modes:
 * 1. **Baseplate splits**: Each bridge generates a different piece (independent params)
 * 2. **Bin splits**: Each bridge regenerates the full solid, then processes only its
 *    assigned piece indices (same params, different pieceIndices)
 *
 * Lifecycle:
 * 1. ensureWorkers() — create and initialize N bridges in parallel (lazy)
 * 2. generateSplitPreview() / exportSplitBin() / generateBaseplates() / exportBaseplates()
 * 3. destroy() — terminate all workers
 */

import { GenerationBridge } from './GenerationBridge';
import type { GenerationResult, SplitPreviewResult, SplitExportResult } from './GenerationBridge';
import type { BinParams, BaseplateParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { ExportFormat, KernelName } from './types';

/** Maximum number of pool workers (caps memory usage from parallel WASM instances) */
const MAX_POOL_SIZE = 4;

/** Compute the default pool size based on hardware concurrency */
function defaultPoolSize(): number {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- navigator may be undefined in SSR/test contexts
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 2) : 2;
  return Math.max(1, Math.min(cores, MAX_POOL_SIZE));
}

/**
 * Distribute N items round-robin into `groupCount` groups.
 * Returns an array of arrays, where each sub-array contains the original indices.
 */
function distributeRoundRobin(itemCount: number, groupCount: number): number[][] {
  const groups: number[][] = Array.from({ length: groupCount }, () => []);
  for (let i = 0; i < itemCount; i++) {
    groups[i % groupCount].push(i);
  }
  return groups;
}

/**
 * Run task groups in parallel across bridges.
 * Tasks within a bridge run sequentially (a bridge handles one request at a time),
 * but different bridges run concurrently.
 */
async function runGrouped<T>(
  groups: Array<Array<() => Promise<T>>>,
  signal?: AbortSignal
): Promise<T[]> {
  const groupResults = await Promise.all(
    groups.map(async (group) => {
      const results: T[] = [];
      for (const task of group) {
        if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
        results.push(await task());
      }
      return results;
    })
  );

  return groupResults.flat();
}

export class WorkerPool {
  private bridges: GenerationBridge[] = [];
  private initPromise: Promise<void> | null = null;
  private destroyed = false;
  private poolSize: number;
  private readonly kernel: KernelName;

  constructor(poolSize?: number, kernel: KernelName = 'occt-wasm') {
    this.poolSize = poolSize ?? defaultPoolSize();
    this.kernel = kernel;
  }

  /**
   * Ensure workers are created and initialized.
   * Lazily creates bridges on first call. Safe to call multiple times.
   */
  async ensureWorkers(): Promise<void> {
    if (this.destroyed) throw new Error('Pool has been destroyed');

    if (this.initPromise) {
      return this.initPromise;
    }

    const size = Math.max(1, Math.min(this.poolSize, MAX_POOL_SIZE));
    this.bridges = Array.from({ length: size }, () => new GenerationBridge(this.kernel));
    this.initPromise = Promise.all(this.bridges.map((b) => b.init()))
      .then(() => undefined)
      .catch((error: unknown) => {
        // Clean up partially-initialized bridges so the pool can be retried
        for (const b of this.bridges) b.destroy();
        this.bridges = [];
        this.initPromise = null;
        throw error;
      });

    return this.initPromise;
  }
  /**
   * Generate split preview meshes in parallel across pool workers.
   *
   * Distributes piece indices across bridges. Each bridge independently
   * regenerates the solid and processes only its assigned pieces.
   */
  async generateSplitPreview(
    params: BinParams,
    cutPlanesX: readonly number[],
    cutPlanesY: readonly number[],
    totalPieceCount: number,
    options?: {
      splitConnectorConfig?: SplitConnectorConfig;
      onProgress?: (completed: number, total: number) => void;
      signal?: AbortSignal;
    }
  ): Promise<SplitPreviewResult> {
    await this.ensureWorkers();

    const groups = distributeRoundRobin(totalPieceCount, this.bridges.length);
    let completed = 0;

    const taskGroups = groups.map((pieceIndices, bridgeIdx) => {
      if (pieceIndices.length === 0) return [];
      const bridge = this.bridges[bridgeIdx];
      return [
        async (): Promise<SplitPreviewResult> => {
          const result = await bridge.generateSplitPreviewRange(
            params,
            cutPlanesX,
            cutPlanesY,
            pieceIndices,
            { splitConnectorConfig: options?.splitConnectorConfig }
          );
          completed += pieceIndices.length;
          options?.onProgress?.(completed, totalPieceCount);
          return result;
        },
      ];
    });

    const results = await runGrouped(taskGroups, options?.signal);

    // Merge and sort pieces back to col-major grid order for consistency
    // with the non-pool single-bridge path
    const allPieces = results.flatMap((r) => r.pieces);
    allPieces.sort((a, b) => a.col - b.col || a.row - b.row);
    return { pieces: allPieces };
  }

  /**
   * Export split bin pieces in parallel across pool workers.
   *
   * Distributes piece indices across bridges. Each bridge independently
   * regenerates the solid and exports only its assigned pieces.
   */
  async exportSplitBin(
    params: BinParams,
    cutPlanesX: readonly number[],
    cutPlanesY: readonly number[],
    totalPieceCount: number,
    options?: {
      tolerance?: number;
      angularTolerance?: number;
      splitConnectorConfig?: SplitConnectorConfig;
      onProgress?: (completed: number, total: number) => void;
      signal?: AbortSignal;
    }
  ): Promise<SplitExportResult> {
    await this.ensureWorkers();

    const groups = distributeRoundRobin(totalPieceCount, this.bridges.length);
    let completed = 0;

    const taskGroups = groups.map((pieceIndices, bridgeIdx) => {
      if (pieceIndices.length === 0) return [];
      const bridge = this.bridges[bridgeIdx];
      return [
        async (): Promise<SplitExportResult> => {
          const result = await bridge.exportSplitBinRange(
            params,
            cutPlanesX,
            cutPlanesY,
            pieceIndices,
            {
              tolerance: options?.tolerance,
              angularTolerance: options?.angularTolerance,
              splitConnectorConfig: options?.splitConnectorConfig,
            }
          );
          completed += pieceIndices.length;
          options?.onProgress?.(completed, totalPieceCount);
          return result;
        },
      ];
    });

    const results = await runGrouped(taskGroups, options?.signal);

    // Merge and sort pieces back to col-major grid order
    const allPieces = results.flatMap((r) => r.pieces);
    allPieces.sort((a, b) => a.col - b.col || a.row - b.row);
    return { pieces: allPieces };
  }
  /**
   * Generate multiple baseplate pieces in parallel across pool workers.
   * Distributes pieces round-robin and returns results in original order.
   */
  async generateBaseplates(
    pieces: readonly BaseplateParams[],
    onProgress?: (completed: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<GenerationResult[]> {
    await this.ensureWorkers();

    const total = pieces.length;
    let completed = 0;

    const indexGroups = distributeRoundRobin(total, this.bridges.length);

    const taskGroups = indexGroups.map((indices, bridgeIdx) => {
      const bridge = this.bridges[bridgeIdx];
      return indices.map(
        (pieceIdx) => async (): Promise<{ index: number; result: GenerationResult }> => {
          if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
          const result = await bridge.generateBaseplateImmediate(pieces[pieceIdx]);
          completed++;
          onProgress?.(completed, total);
          return { index: pieceIdx, result };
        }
      );
    });

    const allResults = await runGrouped(taskGroups, signal);

    // Sort back to original order
    allResults.sort((a, b) => a.index - b.index);
    return allResults.map((r) => r.result);
  }

  /**
   * Export multiple baseplate pieces in parallel across pool workers.
   * Same round-robin dispatch as generateBaseplates.
   */
  async exportBaseplates(
    pieces: readonly BaseplateParams[],
    format: ExportFormat,
    onProgress?: (completed: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<Array<{ data: ArrayBuffer; index: number }>> {
    await this.ensureWorkers();

    const total = pieces.length;
    let completed = 0;

    const indexGroups = distributeRoundRobin(total, this.bridges.length);

    const taskGroups = indexGroups.map((indices, bridgeIdx) => {
      const bridge = this.bridges[bridgeIdx];
      return indices.map((pieceIdx) => async (): Promise<{ data: ArrayBuffer; index: number }> => {
        if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
        const result = await bridge.exportBaseplate(pieces[pieceIdx], format);
        completed++;
        onProgress?.(completed, total);
        return { data: result.data, index: pieceIdx };
      });
    });

    const allResults = await runGrouped(taskGroups, signal);

    allResults.sort((a, b) => a.index - b.index);
    return allResults;
  }
  /** Number of active workers in the pool */
  get size(): number {
    return this.bridges.length;
  }

  /** Whether the pool has been destroyed */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /** Terminate all workers and clean up */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const bridge of this.bridges) {
      bridge.destroy();
    }
    this.bridges = [];
    this.initPromise = null;
  }
}
