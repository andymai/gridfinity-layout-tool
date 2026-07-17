/**
 * GENERATE + GENERATE_BASEPLATE message handlers.
 */

import type {
  GenerateMessage,
  GenerateBaseplateMessage,
  GenerateBaseplateMarginMessage,
  WarmMessage,
  LidMeshData,
  MeshData,
} from '../../bridge/types';
import { generateBin } from '../generators/binGenerator';
import { generateBaseplate } from '../generators/baseplateGenerator';
import { generateMargin } from '../generators/baseplateMargin';
import { generateLid, generateStackPlate } from '../generators/lidOrchestrator';
import { isAbortError } from '../generators/utils/abort';
import { prepareMeshImprints } from '../generators/meshImprint';
import { runGeneration, runWarm, reportProgress, getActiveRequestId } from './workerContext';

/**
 * Decode any referenced mesh imprint assets before the synchronous pipeline
 * runs (the imprint stage consumes the prepared cache). Best-effort: on
 * failure the stage no-ops and the bin renders without pockets rather than
 * failing the whole generation.
 */
async function prepareImprintsSafe(params: GenerateMessage['payload']['params']): Promise<void> {
  try {
    await prepareMeshImprints(params);
  } catch (e) {
    console.warn('[BinGen] mesh imprint prepare failed; generating without pockets:', e);
  }
}

/**
 * Speculative idle warm: build the export-quality (fused) shell so the next
 * export skips the deferred socket↔body fuse. Best-effort, no mesh returned.
 */
export function handleWarm(message: WarmMessage): void {
  const { params, requestId } = message.payload;
  runWarm(requestId, (signal) => {
    generateBin(params, undefined, true, signal);
  });
}

export async function handleGenerate(message: GenerateMessage): Promise<void> {
  const { params, requestId } = message.payload;
  await prepareImprintsSafe(params);
  runGeneration(
    (signal, perf): MeshData => {
      const onProgress = (stage: string, progress: number) => {
        if (getActiveRequestId() !== requestId) return;
        reportProgress(requestId, stage as 'base' | 'shell' | 'features' | 'merge', progress);
      };
      const binMesh = generateBin(params, onProgress, false, signal, perf);
      // Lid runs sequentially after the bin so a single abort cancels both.
      // The lid is a SECONDARY feature: an OCCT exception during lid build
      // (e.g., on a degenerate polygon footprint) must not poison the
      // already-computed bin mesh. Wrap to fall back to bin-only output;
      // re-throw cancellations so abort still aborts the whole request.
      let lidMesh: LidMeshData | null = null;
      try {
        lidMesh = generateLid(params, onProgress, false, signal);
      } catch (e) {
        if (isAbortError(e)) throw e;

        console.warn('[BinGen] Lid generation failed; falling back to bin-only:', e);
      }
      if (!lidMesh) {
        // Lid generation failed (or is disabled) → bin-only. The baseplate is a
        // companion to the lid, so emitting it here would leave a lone
        // baseplate with no lid; skip it and degrade cleanly to bin-only.
        return binMesh;
      }
      let result: MeshData = { ...binMesh, lidMesh };
      // Separate stack-grid baseplate (glue-on companion). Same secondary-
      // feature contract as the lid: a build failure degrades to lid+bin, but
      // a cancellation still aborts the whole request.
      try {
        const stackPlateMesh = generateStackPlate(params, signal);
        if (stackPlateMesh) result = { ...result, stackPlateMesh };
      } catch (e) {
        if (isAbortError(e)) throw e;

        console.warn('[BinGen] Stack-plate generation failed; skipping baseplate:', e);
      }
      return result;
    },
    requestId,
    'BinGen',
    false
  );
}

export function handleGenerateBaseplate(message: GenerateBaseplateMessage): void {
  const { params, requestId } = message.payload;
  runGeneration(
    // Baseplate generation does not use the pipeline / PerfCollector path
    // (it has its own internal flow), so the collector here just stays empty
    // and produces a snapshot with only the totalMs filled in. The PerfOverlay
    // gracefully renders an empty per-stage breakdown.
    (signal) =>
      generateBaseplate(
        params,
        (stage, progress) => {
          if (getActiveRequestId() !== requestId) return;
          reportProgress(requestId, stage as 'base' | 'shell' | 'features' | 'merge', progress);
        },
        false,
        signal,
        // Full-quality preview (draft=false): run the underside lightweight floor
        // cut so the preview matches the exported STL (the hollowed material
        // "past the magnets" is visible when orbiting to the underside). Costs
        // ~⅓ more on magnet grids, but the mesh LRU caches it after the first
        // build. Baseplates have no separate procedural draft, so there's no pop.
        false
      ),
    requestId,
    'BaseplateGen',
    true
  );
}

export function handleGenerateBaseplateMargin(message: GenerateBaseplateMarginMessage): void {
  const { params, margin, requestId } = message.payload;
  // Rails are small and synchronous; `params` carries the full plate context so
  // the rail's over-tile pockets align with the body grid.
  runGeneration(() => generateMargin(params, margin, false), requestId, 'BaseplateMarginGen', true);
}
