/**
 * GENERATE + GENERATE_BASEPLATE message handlers.
 */

import type { GenerateMessage, GenerateBaseplateMessage } from '../../bridge/types';
import { generateBin } from '../generators/binGenerator';
import { generateBaseplate } from '../generators/baseplateGenerator';
import { runGeneration, reportProgress, getActiveRequestId } from './workerContext';

export function handleGenerate(message: GenerateMessage): void {
  const { params, requestId } = message.payload;
  runGeneration(
    (signal) =>
      generateBin(
        params,
        (stage, progress) => {
          if (getActiveRequestId() !== requestId) return;
          reportProgress(requestId, stage as 'base' | 'shell' | 'features' | 'merge', progress);
        },
        false,
        signal
      ),
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
