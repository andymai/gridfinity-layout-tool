/**
 * Worker pool for parallel split baseplate piece generation.
 *
 * Spawns multiple GenerationBridge instances (each wrapping its own Web Worker
 * with independent OpenCascade WASM), distributes split pieces across them,
 * and collects results via Promise.all.
 *
 * Lifecycle:
 * 1. init(poolSize) — create and initialize N bridges in parallel
 * 2. generatePieces(pieces) — distribute pieces round-robin across bridges
 * 3. destroy() — terminate all workers
 */

import { GenerationBridge } from '@/shared/generation/bridge';
import type {
  GenerationResult,
  BaseplateExportResult,
  ExportFormat,
} from '@/shared/generation/bridge';
import type { BaseplateParams } from '@/shared/types/bin';

/** Maximum number of pool workers (caps memory usage from parallel WASM instances) */
const MAX_POOL_SIZE = 4;

export interface PieceGenerationResult {
  readonly index: number;
  readonly result: GenerationResult;
}

export class BaseplateWorkerPool {
  private bridges: GenerationBridge[] = [];
  private destroyed = false;

  /**
   * Initialize the pool with the given number of workers.
   * Each worker loads its own OpenCascade WASM instance.
   *
   * @param requestedSize - Desired pool size (capped to MAX_POOL_SIZE)
   */
  async init(requestedSize: number): Promise<void> {
    if (this.destroyed) throw new Error('Pool has been destroyed');
    if (this.bridges.length > 0) throw new Error('Pool already initialized');

    const size = Math.max(1, Math.min(requestedSize, MAX_POOL_SIZE));

    // Create and initialize all bridges in parallel
    this.bridges = Array.from({ length: size }, () => new GenerationBridge());
    await Promise.all(this.bridges.map((b) => b.init()));
  }

  /**
   * Generate multiple baseplate pieces in parallel across pool workers.
   * Distributes pieces round-robin and returns results in original order.
   *
   * @param pieces - Array of baseplate params for each piece
   * @param signal - Optional AbortSignal for cancellation
   * @returns Results in the same order as the input pieces array
   */
  async generatePieces(
    pieces: readonly BaseplateParams[],
    signal?: AbortSignal
  ): Promise<GenerationResult[]> {
    if (this.destroyed) throw new Error('Pool has been destroyed');
    if (this.bridges.length === 0) throw new Error('Pool not initialized');

    // Distribute pieces round-robin across available bridges
    const tasks = pieces.map((params, index) => {
      const bridge = this.bridges[index % this.bridges.length];
      return async (): Promise<PieceGenerationResult> => {
        if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
        const result = await bridge.generateBaseplateImmediate(params);
        return { index, result };
      };
    });

    // Run each bridge's tasks sequentially (a bridge can only handle one at a time)
    // but different bridges run in parallel
    const bridgeTaskGroups: Array<Array<() => Promise<PieceGenerationResult>>> = Array.from(
      { length: this.bridges.length },
      () => []
    );
    for (let i = 0; i < tasks.length; i++) {
      bridgeTaskGroups[i % this.bridges.length].push(tasks[i]);
    }

    const allResults: PieceGenerationResult[] = [];
    const groupPromises = bridgeTaskGroups.map(async (group) => {
      const results: PieceGenerationResult[] = [];
      for (const task of group) {
        if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
        results.push(await task());
      }
      return results;
    });

    const groupResults = await Promise.all(groupPromises);
    for (const group of groupResults) {
      allResults.push(...group);
    }

    // Sort back to original order
    allResults.sort((a, b) => a.index - b.index);
    return allResults.map((r) => r.result);
  }

  /**
   * Export multiple baseplate pieces in parallel across pool workers.
   * Same round-robin dispatch as generatePieces, but calls exportBaseplate per piece.
   *
   * @param pieces - Array of baseplate params for each piece
   * @param format - Export format ('stl' or 'step')
   * @param onProgress - Called after each piece completes
   * @param signal - Optional AbortSignal for cancellation
   */
  async exportPieces(
    pieces: readonly BaseplateParams[],
    format: ExportFormat,
    onProgress?: (completed: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<Array<{ data: ArrayBuffer; index: number }>> {
    if (this.destroyed) throw new Error('Pool has been destroyed');
    if (this.bridges.length === 0) throw new Error('Pool not initialized');

    const total = pieces.length;
    let completed = 0;

    interface ExportTask {
      index: number;
      fn: () => Promise<{ data: ArrayBuffer; index: number }>;
    }

    const tasks: ExportTask[] = pieces.map((params, index) => ({
      index,
      fn: async () => {
        if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
        const result: BaseplateExportResult = await this.bridges[
          index % this.bridges.length
        ].exportBaseplate(params, format);
        completed++;
        onProgress?.(completed, total);
        return { data: result.data, index };
      },
    }));

    // Group by bridge for sequential execution within each bridge
    const bridgeGroups: ExportTask[][] = Array.from({ length: this.bridges.length }, () => []);
    for (const task of tasks) {
      bridgeGroups[task.index % this.bridges.length].push(task);
    }

    const allResults: Array<{ data: ArrayBuffer; index: number }> = [];
    const groupPromises = bridgeGroups.map(async (group) => {
      const results: Array<{ data: ArrayBuffer; index: number }> = [];
      for (const task of group) {
        if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
        results.push(await task.fn());
      }
      return results;
    });

    const groupResults = await Promise.all(groupPromises);
    for (const group of groupResults) {
      allResults.push(...group);
    }

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
  }
}
