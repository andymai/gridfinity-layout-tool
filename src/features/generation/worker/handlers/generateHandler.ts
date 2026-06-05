/**
 * GENERATE + GENERATE_BASEPLATE message handlers.
 */

import type {
  GenerateMessage,
  GenerateBaseplateMessage,
  WarmMessage,
  LidMeshData,
  MeshData,
} from '../../bridge/types';
import { generateBin } from '../generators/binGenerator';
import { generateBaseplate } from '../generators/baseplateGenerator';
import { generateLid } from '../generators/lidOrchestrator';
import { isAbortError } from '../generators/utils/abort';
import { runGeneration, runWarm, reportProgress, getActiveRequestId } from './workerContext';

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

export function handleGenerate(message: GenerateMessage): void {
  const { params, requestId } = message.payload;
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
      return lidMesh ? { ...binMesh, lidMesh } : binMesh;
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
        signal
      ),
    requestId,
    'BaseplateGen',
    true
  );
}
