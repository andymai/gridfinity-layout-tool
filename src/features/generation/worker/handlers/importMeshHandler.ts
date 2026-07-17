/**
 * IMPORT_MESH handler — runs the STL → MeshAsset pipeline and posts the
 * result with the preview arrays transferred (not copied).
 *
 * Deliberately does not require the brepjs kernel: the pipeline runs on the
 * raw manifold-3d module, which loads independently, so imports work even
 * before (or without) kernel init.
 */

import { isErr } from '@/core/result';
import type { ImportMeshMessage, ImportMeshErrorResponse } from '../../bridge/types';
import { importMeshFromStl } from '../generators/meshImport';
import { formatError } from './workerContext';

export async function handleImportMesh(message: ImportMeshMessage): Promise<void> {
  const { requestId, buffer, fileName, flips } = message.payload;
  try {
    const result = await importMeshFromStl(buffer, fileName, flips);
    if (isErr(result)) {
      const response: ImportMeshErrorResponse = {
        type: 'IMPORT_MESH_ERROR',
        requestId,
        reason: result.error.reason,
        error: result.error.message,
      };
      self.postMessage(response);
      return;
    }
    const { asset, positions, indices, suggestedCutDepth } = result.value;
    self.postMessage(
      { type: 'IMPORT_MESH_RESULT', requestId, asset, positions, indices, suggestedCutDepth },
      { transfer: [positions.buffer, indices.buffer] }
    );
  } catch (e) {
    const response: ImportMeshErrorResponse = {
      type: 'IMPORT_MESH_ERROR',
      requestId,
      reason: 'parse_failed',
      error: formatError(e),
    };
    self.postMessage(response);
  }
}
