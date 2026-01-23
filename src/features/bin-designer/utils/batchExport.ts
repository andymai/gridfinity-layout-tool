/**
 * Batch export utility for generating multiple STL files as a ZIP archive.
 *
 * Uses a single GenerationBridge instance to sequentially generate meshes
 * for each cart item, then packages them into a ZIP using fflate.
 */

import { zipSync, strToU8 } from 'fflate';
import { GenerationBridge } from '@/features/generation/bridge';
import { buildSTLBuffer } from '@/features/generation/export/stlExporter';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
import type { CartItem } from '../types';

/** Progress update during batch export */
export interface BatchProgress {
  /** Index of the item currently being generated (0-based) */
  readonly current: number;
  /** Total number of items to generate */
  readonly total: number;
  /** Name of the item being generated */
  readonly currentName: string;
  /** Phase of the current item */
  readonly phase: 'generating' | 'packaging';
}

/** Result of a batch export operation */
export interface BatchExportResult {
  /** The ZIP archive as a Blob */
  readonly blob: Blob;
  /** Total size of the ZIP in bytes */
  readonly sizeBytes: number;
  /** Number of STL files included */
  readonly fileCount: number;
  /** Any items that failed to generate (skipped) */
  readonly failed: ReadonlyArray<{ name: string; error: string }>;
}

/** Manifest entry for a single design in the ZIP */
interface ManifestEntry {
  readonly file: string;
  readonly name: string;
  readonly dimensions: string;
  readonly style: string;
  readonly estimates: {
    readonly filamentG: number;
    readonly printTimeMin: number;
  };
}

/**
 * Generate a ZIP archive containing STL files for all cart items.
 *
 * @param items - Cart items to export
 * @param onProgress - Optional progress callback
 * @param signal - Optional AbortSignal for cancellation
 * @returns ZIP blob with manifest
 */
export async function batchExport(
  items: readonly CartItem[],
  onProgress?: (progress: BatchProgress) => void,
  signal?: AbortSignal
): Promise<BatchExportResult> {
  if (items.length === 0) {
    throw new Error('No items to export');
  }

  const bridge = new GenerationBridge();
  const files: Record<string, Uint8Array> = {};
  const manifest: ManifestEntry[] = [];
  const failed: Array<{ name: string; error: string }> = [];

  try {
    await bridge.init();

    if (signal?.aborted) throw new Error('Export cancelled');

    for (let i = 0; i < items.length; i++) {
      if (signal?.aborted) throw new Error('Export cancelled');

      const item = items[i];
      const fileName = generateFileName(item.params, 'stl', 'descriptive');

      onProgress?.({
        current: i,
        total: items.length,
        currentName: item.name,
        phase: 'generating',
      });

      try {
        const result = await bridge.generateImmediate(item.params);

        // Build binary STL
        const stlBuffer = buildSTLBuffer(
          result.mesh.vertices,
          result.mesh.normals,
          item.name
        );

        files[fileName] = new Uint8Array(stlBuffer);

        // Add to manifest
        const estimates = estimatePrint(item.params);
        manifest.push({
          file: fileName,
          name: item.name,
          dimensions: `${item.params.width}x${item.params.depth}x${item.params.height}`,
          style: item.params.style,
          estimates: {
            filamentG: estimates.gramsFilament,
            printTimeMin: estimates.printTimeMinutes,
          },
        });
      } catch (e) {
        failed.push({
          name: item.name,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (signal?.aborted) throw new Error('Export cancelled');

    onProgress?.({
      current: items.length - 1,
      total: items.length,
      currentName: 'manifest',
      phase: 'packaging',
    });

    // Add manifest.json
    const manifestJson = JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      files: manifest,
      totalEstimates: {
        filamentG: manifest.reduce((sum, m) => sum + m.estimates.filamentG, 0),
        printTimeMin: manifest.reduce((sum, m) => sum + m.estimates.printTimeMin, 0),
      },
    }, null, 2);
    files['manifest.json'] = strToU8(manifestJson);

    // Create ZIP
    const zipData = zipSync(files);
    const blob = new Blob([zipData.buffer as ArrayBuffer], { type: 'application/zip' });

    return {
      blob,
      sizeBytes: zipData.byteLength,
      fileCount: manifest.length,
      failed,
    };
  } finally {
    bridge.destroy();
  }
}
