/**
 * Pure builder for baseplate export pieces.
 *
 * Produces the export buffers + print guide for a baseplate WITHOUT touching the
 * baseplate-page store or the live 3D preview, so it can run both from the
 * baseplate page (`useBaseplateExport`) and from the whole-layout batch export.
 * Tiling, stacking
 * towers, detached margin rails, dovetail/snap-clip connector keys, fingerprint
 * dedup and the cross-session export cache are all handled here; the caller owns
 * packaging (single download vs ZIP) and progress reset.
 */

import { export3MF, buildSTLBuffer } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { buildThreeMFPrintSettings, stlTo3MF } from '@/shared/generation/stlTo3mf';
import { FORMAT_EXTENSIONS } from '@/shared/generation/exportUtils';
import { isErr, getUserMessage } from '@/core/result';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { STACK_PRINT_DEFAULT_COPIES } from '@/core/types';
import type {
  DrawerOutline,
  MagnetAnchor,
  StackPrintParams,
  StoredBaseplateParams,
} from '@/core/types';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';
import type { GenerationBridge, WorkerPool, ExportFormat } from '@/shared/generation/bridge';
import { buildStackExportSoup } from './stackExport';
import { planPhysicalStacks, stackHeightCap, planPlateFlip, type PlateFlip } from './stackPrint';
import { buildFullParams } from './buildFullParams';
import { computeBaseplateTiling, bodyParamsForDetach } from './splitPlanner';
import { groupPiecesByFingerprint } from './pieceFingerprint';
import {
  buildExportCacheKey,
  getCachedExports,
  putCachedExports,
  getOrExport,
} from './exportCache';
import { assignGroupNames } from './pieceNaming';
import { countConnectorKeys } from './connectorKeys';
import { generatePrintGuide, generateStackPrintNote, generateMarginGuide } from './printGuide';
import { generateAssemblyMapImage } from './assemblyImage';
import { generateBaseplateFileName, toNamingParams } from './fileNaming';

/** Print settings the builder needs (subset of the global PrintSettings). */
export interface BaseplateExportPrintSettings {
  readonly nozzleSizeMm: number;
  readonly layerHeightMm: number;
  readonly infillPercent: number;
  readonly maxPrintHeightMm: number;
}

export interface BuildBaseplateExportInput {
  readonly baseplateParams: StoredBaseplateParams;
  readonly drawerWidth: number;
  readonly drawerDepth: number;
  /** Drawer's non-rectangular boundary — forwarded to buildFullParams, which
   * decides applicability (sync mode, stacking). */
  readonly drawerOutline?: DrawerOutline;
  readonly gridUnitMm: number;
  /** Depth-axis (Y) pitch for a non-square grid. Absent = square (equals gridUnitMm). */
  readonly gridUnitMmY?: number;
  /** Layout-scoped magnet anchor (default 'edge'). */
  readonly magnetAnchor?: MagnetAnchor;
  readonly fractionalEdgeX: 'start' | 'end';
  readonly fractionalEdgeY: 'start' | 'end';
  /** Manual grid shift within the perimeter (drawer.gridShiftX/Y). Default 0. */
  readonly gridShiftX?: number;
  readonly gridShiftY?: number;
  readonly printBedWidthMm: number;
  readonly printBedDepthMm: number;
  readonly format: ExportFileFormat;
  /** Split into print-bed-sized pieces when the plate exceeds the bed. Default true. */
  readonly splitEnabled?: boolean;
  readonly fileNameConfig: ExportFileNameConfig;
  readonly printSettings: BaseplateExportPrintSettings;
  readonly onProgress?: (progress: { current: number; total: number } | null) => void;
}

interface ExportPiece {
  data: ArrayBuffer;
  /** File-name suffix; empty for a single un-split plate (no suffix). */
  label: string;
}

export interface BaseplateExportPieces {
  readonly pieces: ExportPiece[];
  /** Print guide text; empty when a single file downloads directly (no guide). */
  readonly guideText: string;
  /**
   * Top-view assembly-map PNG bytes for the split path — a visual companion to
   * the guide's ASCII grid map. Absent when the plate isn't split or a canvas
   * encoder is unavailable (callers ship the text guide alone).
   */
  readonly assemblyImage?: ArrayBuffer;
  readonly baseNameNoExt: string;
  readonly extension: string;
  /** Present only for the split path, so callers can word a dedup/split toast. */
  readonly splitStats?: {
    readonly uniqueCount: number;
    readonly totalPieces: number;
    readonly stackEnabled: boolean;
  };
}

/** Parse a binary STL into a triangle soup, or throw a user-facing error. */
function parseStlSoup(stlData: ArrayBuffer): { vertices: Float32Array; normals: Float32Array } {
  const parseResult = parseSTLBinary(stlData);
  if (isErr(parseResult)) {
    throw new Error(getUserMessage(parseResult.error));
  }
  return parseResult.value;
}

/**
 * Build a stacked file from an already-parsed single-plate soup: bakes `copies`
 * plates (bottom upright, the rest flipped, separated by an air gap) into real
 * geometry. Single-material in both STL and 3MF.
 */
function buildStackedFileBlob(
  source: { vertices: Float32Array; normals: Float32Array },
  name: string,
  copies: number,
  format: 'stl' | '3mf',
  stack: StackPrintParams,
  flip: PlateFlip,
  settings: BaseplateExportPrintSettings
): Blob {
  const { vertices, normals } = source;
  const soup = buildStackExportSoup(vertices, normals, copies, stack, flip);

  if (format === 'stl') {
    return new Blob([buildSTLBuffer(soup.vertices, soup.normals, name)], {
      type: 'application/sla',
    });
  }

  return export3MF(soup.vertices, soup.normals, {
    name,
    printSettings: buildThreeMFPrintSettings(settings),
  });
}

/**
 * Thrown when a piece would print larger than the configured bed — reachable
 * only under a user-drawn split plan, since the planner's own search
 * never emits one. Carries the offending labels so a caller can name them; the
 * baseplate page instead prevents the export from starting at all.
 */
export class BaseplateBedOverageError extends Error {
  readonly pieceLabels: readonly string[];

  constructor(pieceLabels: readonly string[]) {
    super(`Baseplate pieces exceed the print bed: ${pieceLabels.join(', ')}`);
    this.name = 'BaseplateBedOverageError';
    this.pieceLabels = pieceLabels;
  }
}

export async function buildBaseplateExportPieces(
  bridge: GenerationBridge,
  pool: WorkerPool | null,
  input: BuildBaseplateExportInput
): Promise<BaseplateExportPieces> {
  const {
    baseplateParams,
    drawerWidth,
    drawerDepth,
    drawerOutline,
    gridUnitMm,
    gridUnitMmY,
    magnetAnchor,
    fractionalEdgeX,
    fractionalEdgeY,
    printBedWidthMm,
    printBedDepthMm,
    format,
    fileNameConfig,
    printSettings,
    onProgress,
  } = input;
  const splitEnabled = input.splitEnabled ?? true;
  const gridShiftX = input.gridShiftX ?? 0;
  const gridShiftY = input.gridShiftY ?? 0;
  const nozzleMm = printSettings.nozzleSizeMm;

  // Tiling mirrors what the preview computed from the stored params (not the
  // STEP-stripped variant) — footprint splitting is independent of the magnets/
  // connectors/corners that STEP/stack stripping removes.
  const previewParams = buildFullParams(
    baseplateParams,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    nozzleMm,
    drawerOutline,
    magnetAnchor,
    gridUnitMmY,
    gridShiftX,
    gridShiftY
  );
  const tiling = computeBaseplateTiling(previewParams, printBedWidthMm, printBedDepthMm);

  // The bed-fit gate lives HERE, not in the callers: this builder is the single
  // choke point every export path runs through, and the baseplate page's
  // `canExport` only disables its own button — the whole-layout ZIP calls
  // straight through and would otherwise ship the same oversized pieces.
  if (tiling.bedOverages.length > 0) {
    throw new BaseplateBedOverageError(tiling.bedOverages.map((o) => o.label));
  }

  const stack = baseplateParams.stackPrint;
  const stackEnabled = stack?.enabled === true && format !== 'step';
  const copies = Math.max(1, Math.floor(stack?.copies ?? STACK_PRINT_DEFAULT_COPIES));
  const stackCap = stackHeightCap(
    printSettings.maxPrintHeightMm,
    GRIDFINITY_SPEC.SOCKET_HEIGHT,
    stack?.gapMm ?? 0.2
  );

  // STEP never stacks; clearing stackPrint keeps the feature-stripping logic
  // single-sourced in buildFullParams (mirrors useBaseplateExport).
  const exportStored =
    format === 'step' ? { ...baseplateParams, stackPrint: undefined } : baseplateParams;
  const fullParams = buildFullParams(
    exportStored,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    nozzleMm,
    drawerOutline,
    magnetAnchor,
    gridUnitMmY,
    gridShiftX,
    gridShiftY
  );

  const baseName = generateBaseplateFileName(toNamingParams(fullParams), format, fileNameConfig);
  const baseNameNoExt = baseName.replace(/\.[^.]+$/, '');
  const extension = FORMAT_EXTENSIONS[format];

  // Detached margin rails. They also ship alongside stacked
  // towers — rails never stack, they print flat as separate pieces.
  const railMargins = fullParams.detachMargins ? tiling.margins : [];
  const exportRailPieces = async (): Promise<ExportPiece[]> => {
    const out: ExportPiece[] = [];
    for (const m of railMargins) {
      if (format === 'step') {
        const r = await bridge.exportMargin(fullParams, m, 'step');
        out.push({ data: r.data, label: m.id });
      } else {
        const r = await bridge.exportMargin(fullParams, m, 'stl');
        if (format === '3mf') {
          const blob = stlTo3MF(r.data, printSettings, { name: `${baseNameNoExt}_${m.id}` });
          out.push({ data: await blob.arrayBuffer(), label: m.id });
        } else {
          out.push({ data: r.data, label: m.id });
        }
      }
    }
    return out;
  };
  // Body exports padding-free on detached sides (the rails carry that margin).
  const bodyExportParams = bodyParamsForDetach(fullParams);
  const marginGuideInfo = railMargins.map((m) => ({
    fileName: `${baseNameNoExt}_${m.id}${extension}`,
    side: m.side,
    lengthMm: m.lengthMm,
    bandThicknessMm: m.bandThicknessMm,
  }));

  // Seated connector parts (dovetail key / snap clip). A keyed margin seam adds
  // junctions of its own, so an UNSPLIT plate can need keys too — the
  // single-body paths below have to ship them or the seam grooves are unusable.
  const keyCount = countConnectorKeys(tiling, fullParams);
  const exportConnectorKeyPiece = async (): Promise<ExportPiece[]> => {
    if (keyCount === 0) return [];
    const bridgeFormat: ExportFormat = format === '3mf' ? 'stl' : format;
    let keyData = await getOrExport(
      `connkey|${buildExportCacheKey(fullParams, bridgeFormat, nozzleMm)}`,
      () => bridge.exportConnectorKey(fullParams, bridgeFormat).then((r) => r.data)
    );
    if (format === '3mf') {
      const blob = stlTo3MF(keyData, printSettings, { name: `${baseNameNoExt}_key` });
      keyData = await blob.arrayBuffer();
    }
    return [{ data: keyData, label: 'key' }];
  };
  const keyNote =
    keyCount > 0
      ? {
          key: { fileName: `${baseNameNoExt}_key${extension}`, count: keyCount },
          params: fullParams,
        }
      : undefined;

  if (tiling.isSplit && splitEnabled) {
    const bridgeFormat: ExportFormat = format === '3mf' ? 'stl' : format;

    const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
    const groupNames = assignGroupNames(groups, tiling.pieces);
    const uniqueGroups = [...groups.entries()];
    const uniqueCount = uniqueGroups.length;
    const totalPieces = tiling.pieces.length;

    onProgress?.({ current: 0, total: uniqueCount });

    const uniqueParams = uniqueGroups.map(([, g]) => g.params);

    // Cross-session cache: skip rebuilding pieces whose identical bytes are
    // already persisted. Only the misses go to the worker pool.
    const cacheKeys = uniqueParams.map((p) => buildExportCacheKey(p, bridgeFormat, nozzleMm));
    const cached = await getCachedExports(cacheKeys);
    const missIndices: number[] = [];
    for (let i = 0; i < cached.length; i++) {
      if (cached[i] === undefined) missIndices.push(i);
    }
    const cachedCount = uniqueCount - missIndices.length;
    onProgress?.({ current: cachedCount, total: uniqueCount });

    const freshByIndex = new Map<number, ArrayBuffer>();
    const toPersist: { key: string; data: ArrayBuffer }[] = [];
    if (missIndices.length > 0) {
      const missParams = missIndices.map((i) => uniqueParams[i]);
      if (pool && !pool.isDestroyed && pool.size > 1) {
        const results = await pool.exportBaseplates(missParams, bridgeFormat, (completed) =>
          onProgress?.({ current: cachedCount + completed, total: uniqueCount })
        );
        results.forEach((r, j) => {
          const idx = missIndices[j];
          freshByIndex.set(idx, r.data);
          toPersist.push({ key: cacheKeys[idx], data: r.data });
        });
      } else {
        for (let j = 0; j < missParams.length; j++) {
          onProgress?.({ current: cachedCount + j + 1, total: uniqueCount });
          const result = await bridge.exportBaseplate(missParams[j], bridgeFormat);
          const idx = missIndices[j];
          freshByIndex.set(idx, result.data);
          toPersist.push({ key: cacheKeys[idx], data: result.data });
        }
      }
      void putCachedExports(toPersist);
    }

    const uniqueExports: ArrayBuffer[] = cacheKeys.map((_, i) => {
      const data = cached[i] ?? freshByIndex.get(i);
      if (data === undefined) throw new Error('Baseplate export piece missing after generation');
      return data;
    });

    const pieces: ExportPiece[] = [];
    for (let i = 0; i < uniqueGroups.length; i++) {
      const [fp, group] = uniqueGroups[i];
      const name = groupNames.get(fp) ?? 'unknown';
      const stlData = uniqueExports[i];

      if (stack && stackEnabled) {
        const source = parseStlSoup(stlData);
        const groupFlip = planPlateFlip(group.params);
        const towers = planPhysicalStacks(
          [{ label: name, quantity: group.indices.length * copies }],
          stackCap
        );
        for (let s = 0; s < towers.length; s++) {
          const label = towers.length > 1 ? `${name}_${s + 1}` : name;
          const blob = buildStackedFileBlob(
            source,
            `${baseNameNoExt}_${label}`,
            towers[s].copies,
            format,
            stack,
            groupFlip,
            printSettings
          );
          pieces.push({ data: await blob.arrayBuffer(), label });
        }
        continue;
      }

      if (format === '3mf') {
        const soup = parseStlSoup(stlData);
        for (const idx of group.indices) {
          const label = tiling.pieces[idx].label;
          const blob = export3MF(soup.vertices, soup.normals, {
            name: `${baseNameNoExt}_${label}`,
            printSettings: buildThreeMFPrintSettings(printSettings),
          });
          pieces.push({ data: await blob.arrayBuffer(), label });
        }
      } else {
        for (const idx of group.indices) {
          pieces.push({ data: stlData, label: tiling.pieces[idx].label });
        }
      }
    }

    pieces.push(...(await exportConnectorKeyPiece()));
    pieces.push(...(await exportRailPieces()));

    const guideText = generatePrintGuide({
      tiling,
      groups,
      groupNames,
      parentParams: fullParams,
      fileExtension: extension,
      baseFileName: baseNameNoExt,
      connectorKey: keyNote?.key,
      margins: marginGuideInfo.length > 0 ? marginGuideInfo : undefined,
      stackPrint: stackEnabled ? stack : undefined,
      stackCap,
      copies: stackEnabled ? copies : 1,
    });

    // Visual assembly reference alongside the ASCII map. Failure to render
    // (no canvas encoder) degrades to the text guide rather than aborting.
    const assemblyImage = (await generateAssemblyMapImage(tiling).catch(() => null)) ?? undefined;

    return {
      pieces,
      guideText,
      assemblyImage,
      baseNameNoExt,
      extension,
      splitStats: { uniqueCount, totalPieces, stackEnabled },
    };
  }

  if (format === 'step') {
    const data = await getOrExport(buildExportCacheKey(bodyExportParams, 'step', nozzleMm), () =>
      bridge.exportBaseplate(bodyExportParams, 'step').then((r) => r.data)
    );
    if (railMargins.length > 0) {
      return {
        pieces: [
          { data, label: 'body' },
          ...(await exportConnectorKeyPiece()),
          ...(await exportRailPieces()),
        ],
        guideText: generateMarginGuide(marginGuideInfo, keyNote),
        baseNameNoExt,
        extension,
      };
    }
    return { pieces: [{ data, label: '' }], guideText: '', baseNameNoExt, extension };
  }

  if (stack && stackEnabled) {
    // The towers stack the BODY mesh — padding-free on detached sides, with the
    // rails shipping as separate flat pieces alongside. The flip must be
    // planned from the same params the mesh was generated with, or the flipped
    // copies re-seat off-axis by the removed padding.
    const stlData = await getOrExport(buildExportCacheKey(bodyExportParams, 'stl', nozzleMm), () =>
      bridge.exportBaseplate(bodyExportParams, 'stl').then((r) => r.data)
    );
    const source = parseStlSoup(stlData);
    const singleFlip = planPlateFlip(bodyExportParams);
    const towers = planPhysicalStacks([{ label: 'plate', quantity: copies }], stackCap);
    const hasRails = railMargins.length > 0;
    const multiTower = towers.length > 1;

    let guideText = '';
    if (hasRails) guideText = generateStackPrintNote(stack, marginGuideInfo, copies, keyNote);
    else if (multiTower) guideText = generateStackPrintNote(stack);

    const pieces: ExportPiece[] = [];
    for (let s = 0; s < towers.length; s++) {
      // Split towers carry a numeric suffix. A lone tower keeps the base name for
      // a direct download, unless rails force a ZIP — then it takes the 'body'
      // suffix to match the unstacked detach path.
      let label: string;
      if (multiTower) label = `${s + 1}`;
      else if (hasRails) label = 'body';
      else label = '';
      const fileName = label ? `${baseNameNoExt}_${label}` : baseNameNoExt;
      const blob = buildStackedFileBlob(
        source,
        fileName,
        towers[s].copies,
        format,
        stack,
        singleFlip,
        printSettings
      );
      pieces.push({ data: await blob.arrayBuffer(), label });
    }
    pieces.push(...(await exportConnectorKeyPiece()));
    pieces.push(...(await exportRailPieces()));
    return { pieces, guideText, baseNameNoExt, extension };
  }

  if (railMargins.length > 0) {
    const stlData = await getOrExport(buildExportCacheKey(bodyExportParams, 'stl', nozzleMm), () =>
      bridge.exportBaseplate(bodyExportParams, 'stl').then((r) => r.data)
    );
    const bodyData =
      format === '3mf'
        ? await stlTo3MF(stlData, printSettings, { name: `${baseNameNoExt}_body` }).arrayBuffer()
        : stlData;
    return {
      pieces: [
        { data: bodyData, label: 'body' },
        ...(await exportConnectorKeyPiece()),
        ...(await exportRailPieces()),
      ],
      guideText: generateMarginGuide(marginGuideInfo, keyNote),
      baseNameNoExt,
      extension,
    };
  }

  // Single piece, unstacked, STL or 3MF.
  const stlData = await getOrExport(buildExportCacheKey(fullParams, 'stl', nozzleMm), () =>
    bridge.exportBaseplate(fullParams, 'stl').then((r) => r.data)
  );
  const data =
    format === '3mf'
      ? await stlTo3MF(stlData, printSettings, { name: baseNameNoExt }).arrayBuffer()
      : stlData;
  return { pieces: [{ data, label: '' }], guideText: '', baseNameNoExt, extension };
}
