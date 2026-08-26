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
  ExportLabelFitSampleMessage,
  ExportSlideFitSampleMessage,
  ExportFitTestMessage,
  ExportDividersMessage,
  ExportCombinedMessage,
  CombinedExportPiece,
} from '../../bridge/types';
import { dividerInterior, slottedHasDividers } from '@/shared/utils/slotMath';
import { exportBin } from '../generators/binGenerator';
import { deriveDimensions } from '../generators/pipeline/context';
import { getLastSolid } from '../generators/shapeCache';
import { exportBaseplate, exportConnectorKey } from '../generators/baseplateGenerator';
import { exportMargin } from '../generators/baseplateMargin';
import { exportConnectorSample } from '../generators/connectorSample';
import { exportLabelPlates } from '../generators/labelPlateBuilder';
import { exportLabelFitSample } from '../generators/labelFitSample';
import { exportDividers, exportDividerPiecesSeparately } from '../generators/dividerExport';
import { buildUniqueDividerPieces } from '../generators/dividerBuilder';
import { exportLid, exportStackPlate } from '../generators/lidOrchestrator';
import { slideLidPlanForParams } from '@/shared/types/bin';
import {
  buildAssembledFeetSolids,
  exportDetachableFeet,
} from '../generators/detachableFeetOrchestrator';
import { exportSlideTray } from '../generators/slideOrchestrator';
import { buildKnifeRestSolid, exportKnifeRest } from '../generators/knifeRestBuilder';
import {
  knifeRestMatedOffset,
  planKnifeRest,
  shouldGenerateKnifeRest,
} from '@/shared/utils/knifeRestPlan';
import { exportSlideFitSample } from '../generators/slideFitSample';
import { exportFitTestSlice } from '../generators/fitTestSlice';
import { ensureFontsLoaded } from '../wasmInstantiator';
import type { FaceGroupData } from '@/shared/types/generation';
import { buildLid, buildStackPlate } from '../generators/lidBuilder';
import { lidAnchorZ } from '../generators/lidConstants';
import { LID_FIT_CLEARANCE, resolveLidCavityExtraMm } from '@/shared/types/bin';
import { hasDetachableFeet, shouldGenerateLid } from '@/shared/types/bin';
import {
  runExport,
  reportProgress,
  classifyExportError,
  extractExportTransferBuffers,
} from './workerContext';

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
  // INIT loads the eager set, but a font fetch that failed then is only retried
  // when the family is next requested — so re-ensure here, or a stale/missing
  // asset ships a textless tray with no recovery. Mirrors handleGenerate.
  await ensureFontsLoaded(['jetbrains-mono']);
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
      return {
        data: result.data,
        format: payload.format,
        fileName: result.fileName,
        faceGroups: result.faceGroups,
      };
    },
    'Label plate export failed',
    (p) => [p.data],
    classifyExportError
  );
}

export async function handleExportLabelFitSample(
  message: ExportLabelFitSampleMessage
): Promise<void> {
  const payload = message.payload;
  // Re-ensure the label font, same reason as handleExportConnectorSample.
  await ensureFontsLoaded(['jetbrains-mono']);
  await runExport(
    payload.requestId,
    'BASEPLATE_EXPORT_RESULT',
    async () => {
      const result = await exportLabelFitSample(payload.format, payload.nozzleSizeMm);
      return { data: result.data, format: payload.format, fileName: result.fileName };
    },
    'Label fit sample export failed',
    (p) => [p.data],
    classifyExportError
  );
}

export async function handleExportSlideFitSample(
  message: ExportSlideFitSampleMessage
): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'BASEPLATE_EXPORT_RESULT',
    async () => {
      const result = await exportSlideFitSample(payload.format, payload.slide);
      return { data: result.data, format: payload.format, fileName: result.fileName };
    },
    'Slide fit sample export failed',
    (p) => [p.data],
    classifyExportError
  );
}

/**
 * Export the cutout fit-test card. Runs a full export-quality generation (the
 * card is a slice of the real solid), so it takes the bin's own timeout rather
 * than the fixed coupon ceiling.
 */
export async function handleExportFitTest(message: ExportFitTestMessage): Promise<void> {
  const payload = message.payload;
  await runExport(
    payload.requestId,
    'FIT_TEST_EXPORT_RESULT',
    async () => {
      reportProgress(payload.requestId, 'merge', 0);
      const result = await exportFitTestSlice(payload.params, payload.format, {
        thicknessMm: payload.thicknessMm,
        stamp: payload.stamp,
        bed: payload.bed,
      });
      reportProgress(payload.requestId, 'merge', 1);
      return {
        pieces: result.pieces,
        fileName: result.fileName,
        blockedSeams: result.blockedSeams,
      };
    },
    'Fit test export failed',
    extractExportTransferBuffers,
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
 * - STEP: single compound assembly piece, unless `separatePieces` asks for one
 *   file per part (a split export takes its companions this way)
 * - No dividers: single bin piece (same as regular export)
 */
export async function handleExportCombined(message: ExportCombinedMessage): Promise<void> {
  const { params, requestId, format, tolerance, angularTolerance, separatePieces } =
    message.payload;

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
      // Same gate as the dividers and the lid: left out, a plain bin with
      // detachable feet takes the bin-only early return and its feet are
      // silently dropped from the export.
      const hasFeet = hasDetachableFeet(params.base);
      // A knife block's handle rest is a second solid printed beside the block,
      // so it belongs in this gate for the same reason the feet do — without it
      // the block takes the bin-only return and the rest never ships.
      const hasKnifeRest = shouldGenerateKnifeRest(params);

      if (!hasDividers && !hasLid && !hasFeet && !hasKnifeRest) {
        reportProgress(requestId, 'merge', 1);
        return {
          pieces: [{ data: binResult.data, label: 'bin' }] as CombinedExportPiece[],
          format,
          faceGroups: binResult.faceGroups,
        };
      }

      if (format === 'step' && separatePieces !== true) {
        // STEP: create compound assembly of bin + divider solids + lid
        const binSolid = getLastSolid();
        if (!binSolid) throw new Error('Failed to get bin solid for compound assembly');

        const { innerW, innerD } = dividerInterior(params);
        const stepDims = deriveDimensions(params, true);
        const wallHeight = stepDims.wallHeight;
        const hasLip = params.base.stackingLip;

        const dividerSolids = hasDividers
          ? buildUniqueDividerPieces(params, innerW, innerD, wallHeight, hasLip).map((p) => p.shape)
          : [];
        // Lid is built in lid-local Z (Y=0 = lid floor top). Lift it so the
        // mating cavity (Y = anchorZ, negative) sits on the bin's stacking-lip
        // top, matching the preview's lidGroupZ. `lipTopZ` rather than a local
        // restatement of it: the bin's own magnet posts derive from the same
        // plane, so a second opinion here parts them.
        // try/finally releases divider + lid solids even if compound or
        // exportSTEP throws (binSolid is owned by shapeCache; don't free it).
        // A sliding lid does not mate onto the lip: it hangs in a channel a
        // fixed depth under the WALL top, which is the plane its whole plan is
        // stated against. Its XY placement is already baked into the plate, so
        // the assembly only has to seat it in Z.
        const slidePlan = slideLidPlanForParams(params).geometry;
        const lidZ = slidePlan
          ? stepDims.wallTopZ - slidePlan.plateTopBelowWallTopMm
          : stepDims.lipTopZ -
            lidAnchorZ(params.heightUnitMm, LID_FIT_CLEARANCE, resolveLidCavityExtraMm(params));
        let lidSolid = hasLid ? buildLid(params) : null;
        // Separate baseplate (glue-on) rides on top of the lid floor in the
        // assembly, at the same lift as the lid. buildStackPlate returns null
        // unless the lid opted into separateStackPlate.
        let stackPlateSolid = hasLid ? buildStackPlate(params) : null;
        // Separate solids inside the compound, never fused into the bin — they
        // are pressed on after printing.
        const feetSolids = buildAssembledFeetSolids(params) ?? [];
        // The rest is built in its own print frame, centred on itself, so the
        // assembly has to step it out past the exit wall — left where it is, it
        // would sit inside the block it stands next to.
        const restPlan = hasKnifeRest ? planKnifeRest(params) : null;
        let restSolid = restPlan ? buildKnifeRestSolid(params, restPlan, true) : null;
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
          if (restSolid && restPlan) {
            const offset = knifeRestMatedOffset(params, restPlan);
            const positioned = translate(restSolid, [offset.x, offset.y, 0]);
            restSolid.delete();
            restSolid = positioned;
          }
          const assembly = compound([
            binSolid,
            ...dividerSolids,
            ...(lidSolid ? [lidSolid] : []),
            ...(stackPlateSolid ? [stackPlateSolid] : []),
            ...feetSolids,
            ...(restSolid ? [restSolid] : []),
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
          for (const f of feetSolids) f.delete();
          lidSolid?.delete();
          stackPlateSolid?.delete();
          restSolid?.delete();
        }
      }

      // STL/3MF (and STEP under `separatePieces`): export bin + dividers + lid
      // as separate labeled pieces. Every companion exporter below already
      // takes the format, so STEP falls through with no special casing.
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
      let lidFaceGroups: readonly FaceGroupData[] | undefined;
      if (hasLid) {
        const lidExport = await exportLid(params, format, tolerance, angularTolerance);
        if (lidExport) {
          pieces.push({ data: lidExport.data, label: 'lid' });
          lidFaceGroups = lidExport.faceGroups;
        }
        // Separate stack-grid baseplate ships as its own piece; the lid piece
        // above already comes out grid-less because buildLid skips the fuse
        // when separateStackPlate is on. Returns null unless opted in.
        const plateExport = await exportStackPlate(params, format, tolerance, angularTolerance);
        if (plateExport) {
          pieces.push({ data: plateExport.data, label: 'lid-baseplate' });
        }
      }

      // Detachable feet ship as their own plate. Returns null unless the bin
      // actually has them, so no gate here either.
      const feetExport = await exportDetachableFeet(params, format, tolerance, angularTolerance);
      if (feetExport) {
        pieces.push({ data: feetExport.data, label: 'feet' });
      }

      // The sliding tray is the part that RIDES the rail the bin carries. It
      // returns null for every config the resolver rejects, so no gate here.
      const trayExport = await exportSlideTray(params, format, tolerance, angularTolerance);
      if (trayExport) {
        pieces.push({ data: trayExport.data, label: 'slide-tray' });
      }

      // The knife block's handle rest, in its own print frame. Returns null for
      // every design without a companion rest, so no gate here either.
      const restExport = await exportKnifeRest(params, format, tolerance, angularTolerance);
      if (restExport) {
        pieces.push({ data: restExport.data, label: 'knife-rest' });
      }

      reportProgress(requestId, 'merge', 1);
      return { pieces, format, faceGroups: binResult.faceGroups, lidFaceGroups };
    },
    'Combined export failed',
    (p) => p.pieces.map((piece: CombinedExportPiece) => piece.data),
    classifyExportError
  );
}
