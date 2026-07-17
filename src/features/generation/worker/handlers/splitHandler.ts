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
  classifyExportError,
} from './workerContext';
import { prepareMeshImprints } from '../generators/meshImprint';

/** Best-effort mesh-imprint pre-pass; a failure degrades to pocket-less pieces. */
async function prepareImprintsSafe(params: GenerateSplitPreviewMessage['payload']['params']) {
  try {
    await prepareMeshImprints(params);
  } catch (e) {
    console.warn('[Split] mesh imprint prepare failed; splitting without pockets:', e);
  }
}

export async function handleSplitPreview(message: GenerateSplitPreviewMessage): Promise<void> {
  const payload = message.payload;
  await prepareImprintsSafe(payload.params);
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
    extractMeshTransferBuffers,
    classifyExportError
  );
}

export async function handleSplitPreviewRange(
  message: GenerateSplitPreviewRangeMessage
): Promise<void> {
  const { requestId, params, cutPlanesX, cutPlanesY, pieceIndices, splitConnectorConfig } =
    message.payload;
  await prepareImprintsSafe(params);
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
    extractMeshTransferBuffers,
    classifyExportError
  );
}

export async function handleSplitExport(message: ExportSplitMessage): Promise<void> {
  const payload = message.payload;
  await prepareImprintsSafe(payload.params);
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
    extractExportTransferBuffers,
    classifyExportError
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
  await prepareImprintsSafe(params);
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
    extractExportTransferBuffers,
    classifyExportError
  );
}
