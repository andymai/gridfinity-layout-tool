/**
 * Helpers extracted from `useExport.ts` to keep the hook under the project's
 * 500-line cap. These are pure functions that translate between worker output
 * (STL ArrayBuffers + face groups) and concrete download formats (3MF, STEP,
 * STL ZIP). They have no dependency on React or store state — callers pass in
 * whatever they need.
 */

import { isErr, getUserMessage } from '@/core/result';
import { export3MF, export3MFMultiObject } from '@/shared/generation/export';
import { captureException } from '@/shared/analytics/posthog';
import {
  getActiveBridge,
  workerPoolManager,
  type SplitExportResult,
} from '@/shared/generation/bridge';
import type { SplitConnectorConfig } from '@/shared/types/bin';
import type {
  ThreeMFColorConfig,
  ThreeMFObject,
  ThreeMFPrintSettings,
} from '@/shared/generation/export';
import { parseSTLBinary } from '@/features/bin-designer/utils/stlParser';
import { isFeatureEnabled } from '@/shared/hooks/useFeatureFlag';
import { buildTriangleMaterialIndices } from '@/features/bin-designer/utils/materialMapping';
import { computeActiveZones } from '@/features/bin-designer/types/featureColors';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { FORMAT_MIME_TYPES } from '@/shared/generation/exportUtils';
import type { BinParams, ExportFileFormat } from '@/features/bin-designer/types';
import type { CombinedExportResult } from '@/shared/generation/bridge';

/**
 * Materialize the {@link ThreeMFPrintSettings} block from the live print
 * settings + estimates. Pulled out of the hook so the construction can be
 * reused between the regular and split download paths.
 */
export function buildThreeMFPrintSettings(
  printSettings: { layerHeightMm: number; infillPercent: number },
  estimates: { printTimeMinutes: number; gramsFilament: number }
): ThreeMFPrintSettings {
  return {
    layerHeight: printSettings.layerHeightMm,
    infillPercent: printSettings.infillPercent,
    material: 'PLA',
    supportRequired: false,
    estimatedMinutes: estimates.printTimeMinutes,
    estimatedGrams: estimates.gramsFilament,
  };
}

/** Map piece labels from the worker to descriptive display names for 3MF/STEP. */
export function formatPieceDisplayName(
  label: string,
  params: { width: number; depth: number; height: number }
): string {
  const dims = `${params.width}x${params.depth}x${params.height}`;
  switch (label) {
    case 'bin':
      return `Bin ${dims}`;
    case 'lid':
      return `Lid ${dims}`;
    case 'divider-horizontal':
      return 'Divider Horizontal';
    case 'divider-vertical':
      return 'Divider Vertical';
    case 'assembly':
      return `Bin ${dims} Assembly`;
    default:
      return label;
  }
}

/**
 * Build a GitHub issue URL with bin params + error class prefilled. Lets the
 * "Report issue" toast action drop users into a complete bug report instead
 * of asking them to copy/paste failure context.
 */
export function buildReportIssueUrl(
  params: BinParams,
  error: Error,
  format: ExportFileFormat
): string {
  const title = `Bin export failed: ${error.name || 'Error'}`;
  const body = [
    '**Format:** ' + format.toUpperCase(),
    '**Error:** ' + error.message,
    '',
    '**Bin params:**',
    '```json',
    JSON.stringify(
      {
        width: params.width,
        depth: params.depth,
        height: params.height,
        gridUnitMm: params.gridUnitMm,
        heightUnitMm: params.heightUnitMm,
        style: params.style,
        base: { style: params.base.style, stackingLip: params.base.stackingLip },
        wallPattern: params.wallPattern.enabled ? params.wallPattern.pattern : null,
        handles: params.handles.enabled,
        cutouts: params.cutouts.length,
        inserts: params.inserts.length,
      },
      null,
      2
    ),
    '```',
  ].join('\n');
  const url = new URL('https://github.com/andymai/gridfinity-layout-tool/issues/new');
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  url.searchParams.set('labels', 'bin-export-failure');
  return url.toString();
}

/**
 * Convert a single STL piece into a 3MF Blob. Throws on malformed STL input
 * (the pipeline should never produce one — but the worker boundary is a real
 * place for shape drift, so the parse is checked).
 *
 * `applyMultiColor` controls whether multi-color material indices are
 * computed; callers want this on for the bin piece and off for ancillary
 * pieces (dividers, lid).
 */
export function buildSinglePiece3MF(
  pieceData: ArrayBuffer,
  faceGroups: CombinedExportResult['faceGroups'],
  params: BinParams,
  modelName: string,
  threeMFPrintSettings: ThreeMFPrintSettings,
  applyMultiColor: boolean
): Blob {
  const parseResult = parseSTLBinary(pieceData);
  if (isErr(parseResult)) {
    throw new Error(getUserMessage(parseResult.error));
  }
  const { vertices, normals } = parseResult.value;

  let colorConfig: ThreeMFColorConfig | undefined;
  /* eslint-disable @typescript-eslint/no-unnecessary-condition -- faceGroups and featureColors are typed non-null, but runtime guard is intentional belt-and-suspenders against shape drift in the generation pipeline */
  if (
    applyMultiColor &&
    isFeatureEnabled('multi_color_export') &&
    faceGroups &&
    params.featureColors
  ) {
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */
    const triangleCount = vertices.length / 9;
    colorConfig =
      buildTriangleMaterialIndices(
        faceGroups,
        params.featureColors,
        triangleCount,
        vertices,
        computeActiveZones(params)
      ) ?? undefined;
  }

  return export3MF(vertices, normals, {
    name: modelName,
    colorConfig,
    printSettings: threeMFPrintSettings,
  });
}

/**
 * Convert a multi-piece combined export into a single 3MF Blob with named
 * objects. The first piece (bin) gets multi-color material indices; companion
 * pieces (dividers, lid) ship as solid-color. This mirrors the previous
 * inline behaviour in `useExport.ts`.
 */
export function buildMultiObject3MF(
  pieces: CombinedExportResult['pieces'],
  faceGroups: CombinedExportResult['faceGroups'],
  params: BinParams,
  modelName: string,
  threeMFPrintSettings: ThreeMFPrintSettings
): Blob {
  const objects: ThreeMFObject[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const parseResult = parseSTLBinary(piece.data);
    if (isErr(parseResult)) {
      throw new Error(getUserMessage(parseResult.error));
    }

    let colorConfig: ThreeMFColorConfig | undefined;
    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- faceGroups and featureColors are typed non-null, but runtime guard mirrors the single-piece branch as belt-and-suspenders against pipeline shape drift */
    if (i === 0 && isFeatureEnabled('multi_color_export') && faceGroups && params.featureColors) {
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      const triangleCount = parseResult.value.vertices.length / 9;
      colorConfig =
        buildTriangleMaterialIndices(
          faceGroups,
          params.featureColors,
          triangleCount,
          parseResult.value.vertices,
          computeActiveZones(params)
        ) ?? undefined;
    }

    objects.push({
      vertices: parseResult.value.vertices,
      normals: parseResult.value.normals,
      name: formatPieceDisplayName(piece.label, params),
      colorConfig,
    });
  }

  return export3MFMultiObject(objects, {
    name: modelName,
    printSettings: threeMFPrintSettings,
  });
}

/**
 * Build a downloadable blob + filename for a combined-export result. STL
 * single-piece returns the raw STL; multi-piece returns a ZIP. STEP wraps
 * the single compound piece. 3MF is delegated to the dedicated builders.
 *
 * Pulled out of `useExport.ts` to keep that file under the 500-line cap.
 */
export async function buildBinDownloadPayload(
  format: ExportFileFormat,
  result: CombinedExportResult,
  params: BinParams,
  fileName: string,
  threeMFContext: { modelName: string; threeMFPrintSettings: ThreeMFPrintSettings } | null
): Promise<{ blob: Blob; downloadName: string }> {
  if (format === '3mf') {
    if (!threeMFContext) throw new Error('3MF context required for 3MF export');
    if (result.pieces.length === 1) {
      const blob = buildSinglePiece3MF(
        result.pieces[0].data,
        result.faceGroups,
        params,
        threeMFContext.modelName,
        threeMFContext.threeMFPrintSettings,
        true
      );
      return { blob, downloadName: fileName };
    }
    const blob = buildMultiObject3MF(
      result.pieces,
      result.faceGroups,
      params,
      threeMFContext.modelName,
      threeMFContext.threeMFPrintSettings
    );
    return { blob, downloadName: fileName };
  }

  if (format === 'step') {
    const blob = new Blob([result.pieces[0].data], { type: FORMAT_MIME_TYPES.step });
    return { blob, downloadName: fileName };
  }

  // STL
  if (result.pieces.length === 1) {
    const blob = new Blob([result.pieces[0].data], { type: FORMAT_MIME_TYPES.stl });
    return { blob, downloadName: fileName };
  }
  const baseName = fileName.replace(/\.stl$/, '');
  const zip = await packagePiecesAsZip(
    result.pieces.map((p: { data: ArrayBuffer; label: string }) => ({
      data: p.data,
      label: p.label,
    })),
    baseName,
    '.stl'
  );
  return { blob: zip, downloadName: `${baseName}.zip` };
}

/**
 * Run a split-bin export through the worker pool when available, falling
 * back to the single bridge if the pool can't be acquired or fails. The
 * fallback path used to be a bare swallowed catch (#1339); errors now feed
 * `captureException` so pool regressions are visible in telemetry.
 *
 * The function is `async` and treated as one operation by `exportWithResilience`
 * — pool fallback happens inside a single attempt, not across attempts.
 */
export async function runSplitBinExport(
  params: BinParams,
  cutPlanesX: number[],
  cutPlanesY: number[],
  totalPieceCount: number,
  connectorConfig: SplitConnectorConfig,
  format: ExportFileFormat
): Promise<SplitExportResult> {
  let poolAcquired = false;
  try {
    const pool = await workerPoolManager.acquire();
    poolAcquired = true;
    if (pool.size > 1) {
      const result = await pool.exportSplitBin(params, cutPlanesX, cutPlanesY, totalPieceCount, {
        splitConnectorConfig: connectorConfig,
      });
      workerPoolManager.release();
      poolAcquired = false;
      return result;
    }
    workerPoolManager.release();
    poolAcquired = false;
    const bridge = getActiveBridge();
    if (!bridge) throw new Error('Bridge not available');
    return await bridge.exportSplitBin(params, cutPlanesX, cutPlanesY, {
      splitConnectorConfig: connectorConfig,
    });
  } catch (poolErr) {
    captureException(poolErr instanceof Error ? poolErr : new Error(String(poolErr)), {
      source: 'bin_export_pool_fallback',
      export_format: format,
    });
    if (poolAcquired) {
      workerPoolManager.release();
      poolAcquired = false;
    }
    const bridge = getActiveBridge();
    if (!bridge) throw new Error('Bridge not available', { cause: poolErr });
    return await bridge.exportSplitBin(params, cutPlanesX, cutPlanesY, {
      splitConnectorConfig: connectorConfig,
    });
  } finally {
    if (poolAcquired) workerPoolManager.release();
  }
}

/**
 * Convert each piece of a split export (plus companion pieces) into a 3MF
 * blob. Returns ArrayBuffers paired with their labels so the caller can ZIP
 * them in one step. Multi-color is intentionally NOT propagated — split +
 * multi-color is a known gap.
 */
export async function buildSplit3MFPieces(
  pieces: ReadonlyArray<{ data: ArrayBuffer; label: string }>,
  baseName: string,
  threeMFPrintSettings: ThreeMFPrintSettings
): Promise<{ data: ArrayBuffer; label: string }[]> {
  const convertedPieces: { data: ArrayBuffer; label: string }[] = [];
  for (const piece of pieces) {
    const parseResult = parseSTLBinary(piece.data);
    if (isErr(parseResult)) {
      throw new Error(getUserMessage(parseResult.error));
    }
    const { vertices, normals } = parseResult.value;
    const blob = export3MF(vertices, normals, {
      name: `${baseName}_${piece.label}`,
      printSettings: threeMFPrintSettings,
    });
    convertedPieces.push({ data: await blob.arrayBuffer(), label: piece.label });
  }
  return convertedPieces;
}
