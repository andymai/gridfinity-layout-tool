/**
 * EXPORT, EXPORT_BASEPLATE, EXPORT_DIVIDERS, and EXPORT_COMBINED message handlers.
 */

import { unwrap, compound, exportSTEP } from 'brepjs';
import type {
  ExportMessage,
  ExportBaseplateMessage,
  ExportDividersMessage,
  ExportCombinedMessage,
  CombinedExportPiece,
} from '../../bridge/types';
import { exportBin } from '../generators/binGenerator';
import { getLastSolid } from '../generators/shapeCache';
import { exportBaseplate } from '../generators/baseplateGenerator';
import { exportDividers, exportDividerPiecesSeparately } from '../generators/dividerExport';
import { buildUniqueDividerPieces } from '../generators/dividerBuilder';
import { GRIDFINITY } from '@/shared/constants/bin';
import { runExport } from './workerContext';

export async function handleExport(message: ExportMessage): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'EXPORT_RESULT',
    async () => {
      const result = await exportBin(
        payload.params,
        payload.format,
        payload.tolerance,
        payload.angularTolerance
      );
      return {
        data: result.data,
        format: payload.format,
        fileName: result.fileName,
        faceGroups: result.faceGroups,
      };
    },
    'Export failed',
    (p) => [p.data]
  );
}

export async function handleExportBaseplate(message: ExportBaseplateMessage): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'BASEPLATE_EXPORT_RESULT',
    async () => {
      const result = await exportBaseplate(
        payload.params,
        payload.format,
        payload.tolerance,
        payload.angularTolerance
      );
      return { data: result.data, format: payload.format, fileName: result.fileName };
    },
    'Baseplate export failed',
    (p) => [p.data]
  );
}

export async function handleExportDividers(message: ExportDividersMessage): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'DIVIDERS_EXPORT_RESULT',
    async () => {
      const result = await exportDividers(payload.params);
      return { data: result.data, fileName: result.fileName };
    },
    'Divider export failed',
    (p) => [p.data]
  );
}

/**
 * Combined bin + dividers export.
 *
 * Returns labeled pieces for the main thread to package per format:
 * - STL: multiple pieces (bin + divider per axis) → main thread ZIPs them
 * - STEP: single compound assembly piece
 * - No dividers: single bin piece (same as regular export)
 */
export async function handleExportCombined(message: ExportCombinedMessage): Promise<void> {
  const { params, requestId, format, tolerance, angularTolerance } = message.payload;

  await runExport(
    requestId,
    'COMBINED_EXPORT_RESULT',
    async () => {
      // Export the bin first (regenerates solid if needed)
      const binResult = await exportBin(params, format, tolerance, angularTolerance);

      const hasDividers =
        params.style === 'slotted' && (params.slotConfig.x.enabled || params.slotConfig.y.enabled);

      if (!hasDividers) {
        return {
          pieces: [{ data: binResult.data, label: 'bin' }] as CombinedExportPiece[],
          format,
          faceGroups: binResult.faceGroups,
        };
      }

      if (format === 'step') {
        // STEP: create compound assembly of bin + divider solids
        const binSolid = getLastSolid();
        if (!binSolid) throw new Error('Failed to get bin solid for compound assembly');

        // gridUnitMm is typed required, but persisted configs predating the
        // field may not have it; preserve the runtime fallback.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const gridUnitMm = params.gridUnitMm ?? GRIDFINITY.GRID_SIZE;
        const outerW = params.width * gridUnitMm - GRIDFINITY.TOLERANCE;
        const outerD = params.depth * gridUnitMm - GRIDFINITY.TOLERANCE;
        const innerW = outerW - 2 * params.wallThickness;
        const innerD = outerD - 2 * params.wallThickness;
        const totalHeight = params.height * params.heightUnitMm;
        const isFlat = params.base.style === 'flat';
        const wallHeight = isFlat ? totalHeight : totalHeight - GRIDFINITY.SOCKET_HEIGHT;
        const hasLip = params.base.stackingLip;

        const dividerSolids = buildUniqueDividerPieces(params, innerW, innerD, wallHeight, hasLip);
        const assembly = compound([binSolid, ...dividerSolids]);
        const blob = unwrap(exportSTEP(assembly));

        return {
          pieces: [{ data: await blob.arrayBuffer(), label: 'assembly' }] as CombinedExportPiece[],
          format,
        };
      }

      // STL: export bin + each divider piece separately
      const pieces: CombinedExportPiece[] = [{ data: binResult.data, label: 'bin' }];
      const dividerPieces = await exportDividerPiecesSeparately(
        params,
        format,
        tolerance,
        angularTolerance
      );
      pieces.push(...dividerPieces);

      return { pieces, format, faceGroups: binResult.faceGroups };
    },
    'Combined export failed',
    (p) => p.pieces.map((piece: CombinedExportPiece) => piece.data)
  );
}
