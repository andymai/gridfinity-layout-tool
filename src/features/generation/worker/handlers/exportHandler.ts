/**
 * EXPORT, EXPORT_BASEPLATE, EXPORT_DIVIDERS, and EXPORT_COMBINED message handlers.
 */

import { unwrap, compound, exportSTEP, translate } from 'brepjs';
import type {
  ExportMessage,
  ExportBaseplateMessage,
  ExportBaseplateMarginMessage,
  ExportConnectorKeyMessage,
  ExportConnectorSampleMessage,
  ExportLabelPlatesMessage,
  ExportDividersMessage,
  ExportCombinedMessage,
  CombinedExportPiece,
} from '../../bridge/types';
import { slottedHasDividers } from '@/shared/utils/slotMath';
import { exportBin } from '../generators/binGenerator';
import { getLastSolid } from '../generators/shapeCache';
import { exportBaseplate, exportConnectorKey } from '../generators/baseplateGenerator';
import { exportMargin } from '../generators/baseplateMargin';
import { exportConnectorSample } from '../generators/connectorSample';
import { exportLabelPlates } from '../generators/labelPlateBuilder';
import { exportDividers, exportDividerPiecesSeparately } from '../generators/dividerExport';
import { buildUniqueDividerPieces } from '../generators/dividerBuilder';
import { pitchFromParams } from '../generators/gridPitch';
import { exportLid, exportStackPlate } from '../generators/lidOrchestrator';
import { buildLid, buildStackPlate } from '../generators/lidBuilder';
import { lidAnchorZ } from '../generators/lidConstants';
import { GRIDFINITY } from '@/shared/constants/bin';
import { LID_FIT_CLEARANCE } from '@/shared/types/bin';
import { shouldGenerateLid } from '@/shared/types/bin';
import { runExport, reportProgress, classifyExportError } from './workerContext';

export async function handleExport(message: ExportMessage): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'EXPORT_RESULT',
    async () => {
      const result = await exportBin(payload.params, payload.format, (p) =>
        reportProgress(payload.requestId, 'merge', p)
      );
      return {
        data: result.data,
        format: payload.format,
        fileName: result.fileName,
        faceGroups: result.faceGroups,
      };
    },
    'Export failed',
    (p) => [p.data],
    classifyExportError
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
    (p) => [p.data],
    classifyExportError
  );
}

export async function handleExportBaseplateMargin(
  message: ExportBaseplateMarginMessage
): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'BASEPLATE_EXPORT_RESULT',
    async () => {
      const result = await exportMargin(
        payload.params,
        payload.margin,
        payload.format,
        payload.tolerance,
        payload.angularTolerance
      );
      return { data: result.data, format: payload.format, fileName: result.fileName };
    },
    'Margin rail export failed',
    (p) => [p.data],
    classifyExportError
  );
}

export async function handleExportConnectorKey(message: ExportConnectorKeyMessage): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'BASEPLATE_EXPORT_RESULT',
    async () => {
      const result = await exportConnectorKey(
        payload.params,
        payload.format,
        payload.tolerance,
        payload.angularTolerance
      );
      return { data: result.data, format: payload.format, fileName: result.fileName };
    },
    'Connector key export failed',
    (p) => [p.data],
    classifyExportError
  );
}

export async function handleExportConnectorSample(
  message: ExportConnectorSampleMessage
): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'BASEPLATE_EXPORT_RESULT',
    async () => {
      const result = await exportConnectorSample(
        payload.params,
        payload.format,
        payload.tolerance,
        payload.angularTolerance
      );
      return { data: result.data, format: payload.format, fileName: result.fileName };
    },
    'Connector sample export failed',
    (p) => [p.data],
    classifyExportError
  );
}

export async function handleExportLabelPlates(message: ExportLabelPlatesMessage): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'BASEPLATE_EXPORT_RESULT',
    async () => {
      const result = await exportLabelPlates(payload.plates, payload.options, payload.format);
      return { data: result.data, format: payload.format, fileName: result.fileName };
    },
    'Label plate export failed',
    (p) => [p.data],
    classifyExportError
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
    (p) => [p.data],
    classifyExportError
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
      // Export the bin first (regenerates solid if needed). exportBin runs
      // at the fixed export tolerance; the explicit `tolerance` /
      // `angularTolerance` from the payload still flow into divider and lid
      // exports below which carry their own tessellation knobs. The bin is the
      // bulk of the work, so map its progress to 0–95% and report 100% once the
      // (fast) divider/lid pieces finish below.
      const binResult = await exportBin(params, format, (p) =>
        reportProgress(requestId, 'merge', p * 0.95)
      );

      const hasDividers = params.style === 'slotted' && slottedHasDividers(params.slotConfig);
      // Lid emits a separate solid alongside the bin; included as its own
      // labeled piece for STL/3MF and folded into the STEP compound below.
      const hasLid = shouldGenerateLid(params);

      if (!hasDividers && !hasLid) {
        reportProgress(requestId, 'merge', 1);
        return {
          pieces: [{ data: binResult.data, label: 'bin' }] as CombinedExportPiece[],
          format,
          faceGroups: binResult.faceGroups,
        };
      }

      if (format === 'step') {
        // STEP: create compound assembly of bin + divider solids + lid
        const binSolid = getLastSolid();
        if (!binSolid) throw new Error('Failed to get bin solid for compound assembly');

        // Y axis uses gridUnitMmY when set (non-square grid); equal to X for
        // square grids — matches the STL divider path in dividerExport.ts.
        const { x: unitX, y: unitY } = pitchFromParams(params);
        const outerW = params.width * unitX - GRIDFINITY.TOLERANCE;
        const outerD = params.depth * unitY - GRIDFINITY.TOLERANCE;
        const innerW = outerW - 2 * params.wallThickness;
        const innerD = outerD - 2 * params.wallThickness;
        const totalHeight = params.height * params.heightUnitMm;
        const isFlat = params.base.style === 'flat';
        const wallHeight = isFlat ? totalHeight : totalHeight - GRIDFINITY.SOCKET_HEIGHT;
        const hasLip = params.base.stackingLip;

        const dividerSolids = hasDividers
          ? buildUniqueDividerPieces(params, innerW, innerD, wallHeight, hasLip).map((p) => p.shape)
          : [];
        // Lid is built in lid-local Z (Y=0 = lid floor top). Lift it so the
        // mating cavity (Y = anchorZ, negative) sits at world Z = totalHeight
        // (the bin's stacking lip top), matching the preview's lidGroupZ.
        // try/finally releases divider + lid solids even if compound or
        // exportSTEP throws (binSolid is owned by shapeCache; don't free it).
        const lidZ =
          totalHeight -
          lidAnchorZ(params.heightUnitMm, LID_FIT_CLEARANCE, params.lid.extraHeightMm);
        let lidSolid = hasLid ? buildLid(params) : null;
        // Separate baseplate (glue-on) rides on top of the lid floor in the
        // assembly, at the same lift as the lid. buildStackPlate returns null
        // unless the lid opted into separateStackPlate.
        let stackPlateSolid = hasLid ? buildStackPlate(params) : null;
        try {
          if (lidSolid) {
            const positioned = translate(lidSolid, [0, 0, lidZ]);
            lidSolid.delete();
            lidSolid = positioned;
          }
          if (stackPlateSolid) {
            const positioned = translate(stackPlateSolid, [0, 0, lidZ]);
            stackPlateSolid.delete();
            stackPlateSolid = positioned;
          }
          const assembly = compound([
            binSolid,
            ...dividerSolids,
            ...(lidSolid ? [lidSolid] : []),
            ...(stackPlateSolid ? [stackPlateSolid] : []),
          ]);
          const blob = unwrap(exportSTEP(assembly));

          reportProgress(requestId, 'merge', 1);
          return {
            pieces: [
              { data: await blob.arrayBuffer(), label: 'assembly' },
            ] as CombinedExportPiece[],
            format,
          };
        } finally {
          for (const d of dividerSolids) d.delete();
          lidSolid?.delete();
          stackPlateSolid?.delete();
        }
      }

      // STL/3MF: export bin + dividers + lid as separate labeled pieces
      const pieces: CombinedExportPiece[] = [{ data: binResult.data, label: 'bin' }];
      if (hasDividers) {
        const dividerPieces = await exportDividerPiecesSeparately(
          params,
          format,
          tolerance,
          angularTolerance
        );
        pieces.push(...dividerPieces);
      }
      if (hasLid) {
        const lidExport = await exportLid(params, format, tolerance, angularTolerance);
        if (lidExport) {
          pieces.push({ data: lidExport.data, label: 'lid' });
        }
        // Separate stack-grid baseplate ships as its own piece; the lid piece
        // above already comes out grid-less because buildLid skips the fuse
        // when separateStackPlate is on. Returns null unless opted in.
        const plateExport = await exportStackPlate(params, format, tolerance, angularTolerance);
        if (plateExport) {
          pieces.push({ data: plateExport.data, label: 'lid-baseplate' });
        }
      }

      reportProgress(requestId, 'merge', 1);
      return { pieces, format, faceGroups: binResult.faceGroups };
    },
    'Combined export failed',
    (p) => p.pieces.map((piece: CombinedExportPiece) => piece.data),
    classifyExportError
  );
}
