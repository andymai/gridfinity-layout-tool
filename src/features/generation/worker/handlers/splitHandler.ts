/**
 * Split preview + split export message handlers.
 */

import type {
  GenerateSplitPreviewMessage,
  GenerateSplitPreviewRangeMessage,
  ExportSplitMessage,
  ExportSplitRangeMessage,
} from '../../bridge/types';
import {
  generateSplitPreview,
  generateSplitPreviewRange,
  exportSplitBin,
  exportSplitBinRange,
} from '../generators/binGenerator';
import {
  runExport,
  reportProgress,
  extractMeshTransferBuffers,
  extractExportTransferBuffers,
} from './workerContext';

export async function handleSplitPreview(message: GenerateSplitPreviewMessage): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'SPLIT_PREVIEW_RESULT',
    () => {
      reportProgress(payload.requestId, 'splitting', 0);
      const result = generateSplitPreview(
        payload.params,
        payload.cutPlanesX,
        payload.cutPlanesY,
        payload.splitConnectorConfig
      );
      reportProgress(payload.requestId, 'splitting', 1);
      return Promise.resolve({ pieces: result.pieces });
    },
    'Split preview failed',
    extractMeshTransferBuffers
  );
}

export async function handleSplitPreviewRange(
  message: GenerateSplitPreviewRangeMessage
): Promise<void> {
  const { requestId, params, cutPlanesX, cutPlanesY, pieceIndices, splitConnectorConfig } =
    message.payload;
  await runExport(
    requestId,
    'SPLIT_PREVIEW_RESULT',
    () => {
      reportProgress(requestId, 'splitting', 0);
      const result = generateSplitPreviewRange(
        params,
        cutPlanesX,
        cutPlanesY,
        pieceIndices,
        splitConnectorConfig
      );
      reportProgress(requestId, 'splitting', 1);
      return Promise.resolve({ pieces: result.pieces });
    },
    'Split preview range failed',
    extractMeshTransferBuffers
  );
}

export async function handleSplitExport(message: ExportSplitMessage): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'SPLIT_EXPORT_RESULT',
    async () => {
      reportProgress(payload.requestId, 'splitting', 0);
      const result = await exportSplitBin(
        payload.params,
        payload.cutPlanesX,
        payload.cutPlanesY,
        payload.tolerance,
        payload.angularTolerance,
        payload.splitConnectorConfig
      );
      reportProgress(payload.requestId, 'splitting', 1);
      return { pieces: result.pieces };
    },
    'Split export failed',
    extractExportTransferBuffers
  );
}

export async function handleSplitExportRange(message: ExportSplitRangeMessage): Promise<void> {
  const {
    requestId,
    params,
    cutPlanesX,
    cutPlanesY,
    pieceIndices,
    tolerance,
    angularTolerance,
    splitConnectorConfig,
  } = message.payload;
  await runExport(
    requestId,
    'SPLIT_EXPORT_RESULT',
    async () => {
      reportProgress(requestId, 'splitting', 0);
      const result = await exportSplitBinRange(
        params,
        cutPlanesX,
        cutPlanesY,
        pieceIndices,
        tolerance,
        angularTolerance,
        splitConnectorConfig
      );
      reportProgress(requestId, 'splitting', 1);
      return { pieces: result.pieces };
    },
    'Split export range failed',
    extractExportTransferBuffers
  );
}
