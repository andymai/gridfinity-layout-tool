/**
 * GENERATE + GENERATE_BASEPLATE message handlers.
 */

import type { GenerateMessage, GenerateBaseplateMessage, MeshData } from '../../bridge/types';
import { generateBin } from '../generators/binGenerator';
import { generateBaseplate } from '../generators/baseplateGenerator';
import { generateLid } from '../generators/lidOrchestrator';
import { runGeneration, reportProgress, getActiveRequestId } from './workerContext';

export function handleGenerate(message: GenerateMessage): void {
  const { params, requestId } = message.payload;
  runGeneration(
    (signal): MeshData => {
      const onProgress = (stage: string, progress: number) => {
        if (getActiveRequestId() !== requestId) return;
        reportProgress(requestId, stage as 'base' | 'shell' | 'features' | 'merge', progress);
      };
      const binMesh = generateBin(params, onProgress, false, signal);
      // Lid runs sequentially after the bin so a single abort cancels both.
      // Returns null when lid is disabled or the bin has no stacking lip.
      const lidMesh = generateLid(params, onProgress, false, signal);
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
