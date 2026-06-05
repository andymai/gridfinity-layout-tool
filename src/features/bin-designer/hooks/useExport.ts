/**
 * Export hook for the bin designer.
 *
 * Manages export lifecycle: generates high-quality mesh via worker,
 * triggers browser download, and computes live print estimates.
 *
 * Supports STL (binary mesh), STEP (exact BREP), and 3MF (mesh + metadata).
 * When a bin has removable dividers, they are automatically included:
 * - 3MF: multiple named objects (bin + per-axis dividers) in one file
 * - STEP: compound assembly with bin + divider parts
 * - STL: ZIP archive with separate files per piece
 *
 * Resilience layer (added in #harden-bin-export):
 * - Bridge calls run through `exportWithResilience` so transient WASM/BREP
 *   wobble retries automatically (and the worker is refreshed once before
 *   final failure).
 * - All worker errors funnel through a single catch that fires telemetry
 *   and surfaces a toast with Retry + Report-issue affordances. The previous
 *   bare `try { } finally { setIsExportingBin(false) }` swallowed errors as
 *   unhandled rejections.
 * - Clicks made before the engine is ready are queued and dispatched once
 *   `bridgeManager.subscribe` reports readiness, instead of silently no-oping.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { calcMaxGridUnits } from '@/core/constants';
import { getActiveBridge, bridgeManager } from '@/shared/generation/bridge';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
import { getSplitPieceCount, getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import { packagePiecesAsZip } from '@/shared/generation/zipExport';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { ExportFileNameConfig, ExportFileFormat } from '@/features/bin-designer/types';
import type { PrintEstimate } from '@/features/bin-designer/utils/printEstimates';
import { shouldGenerateLid } from '@/features/bin-designer/utils/lidCompatibility';
import { exportWithResilience } from '@/features/bin-designer/utils/exportWithResilience';
import {
  buildBinDownloadPayload,
  buildReportIssueUrl,
  buildThreeMFPrintSettings,
  buildSplit3MFPieces,
  runSplitBinExport,
} from '@/features/bin-designer/utils/binDownloadHelpers';
import {
  trackBinExportFailure,
  trackBinExportSucceeded,
  captureException,
} from '@/shared/analytics/posthog';
import { useTranslation } from '@/i18n';

interface UseExportReturn {
  /** Whether a main bin or split export is currently in progress */
  readonly isExportingBin: boolean;
  /** Whether any export is currently in progress */
  readonly isExporting: boolean;
  /** Export progress in [0, 1] while exporting (for a determinate progress bar). */
  readonly exportProgress: number;
  /** Whether mesh data is available for export (bridge active + mesh exists) */
  readonly canExport: boolean;
  /** Whether the geometry engine is ready to handle export requests */
  readonly engineReady: boolean;
  /** Current print estimates based on params */
  readonly estimates: PrintEstimate;
  /**
   * Download bin (and dividers if present) in the specified format.
   *
   * Resolves to `true` when a file was triggered for download, `false` if the
   * export was queued for engine warmup or failed (in which case an error toast
   * has already been shown via the hook's own error path). Callers should gate
   * any post-success UX (success toast, dialog close) on the boolean result —
   * **never** assume resolution implies success, since errors are caught
   * internally to fire telemetry + the Retry/Report-issue toast.
   */
  readonly downloadBin: (
    format: ExportFileFormat,
    config: ExportFileNameConfig,
    designName?: string
  ) => Promise<boolean>;
  /** Whether the bin has exportable dividers (used for display extension) */
  readonly hasDividers: boolean;
  /** Whether the bin exceeds print bed and needs splitting */
  readonly needsSplit: boolean;
  /** Number of pieces the bin would be split into */
  readonly splitPieceCount: number;
  /** Maximum grid units that fit on the print bed */
  readonly maxGridUnits: { width: number; depth: number };
  /**
   * Trigger split export download as ZIP via worker bridge.
   *
   * Same boolean contract as {@link downloadBin}: `true` on completed download,
   * `false` on queue-for-warmup, format mismatch, or caught failure.
   */
  readonly downloadSplit: (
    format: ExportFileFormat,
    config: ExportFileNameConfig,
    designName?: string
  ) => Promise<boolean>;
}

/** Args of the most recent export click — replayed when the engine becomes ready. */
interface QueuedExport {
  kind: 'bin' | 'split';
  format: ExportFileFormat;
  config: ExportFileNameConfig;
  designName?: string;
}

export function useExport(): UseExportReturn {
  const t = useTranslation();
  const { params, mesh } = useDesignerStore(
    useShallow((state) => ({
      params: state.params,
      mesh: state.generation.mesh,
    }))
  );

  const { printSettings, defaultPrintBedSize, defaultPrintBedDepth } = useSettingsStore(
    useShallow((s) => ({
      printSettings: s.settings.printSettings,
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultPrintBedDepth: s.settings.defaultPrintBedDepth,
    }))
  );

  const addToast = useToastStore((s) => s.addToast);

  const [isExportingBin, setIsExportingBin] = useState(false);
  const isExporting = isExportingBin;
  // 0–1 export progress for the determinate progress bar (worker-reported).
  const [exportProgress, setExportProgress] = useState(0);

  // Track engine readiness via bridgeManager subscription. `subscribe()` fires
  // synchronously with the current state, so the initial value is correct.
  const [engineReady, setEngineReady] = useState(() => bridgeManager.engineReady);
  useEffect(() => {
    const unsubscribe = bridgeManager.subscribe(setEngineReady);
    return unsubscribe;
  }, []);

  // Export requires both a preview mesh (to show UI) and an active bridge (to regenerate)
  const canExport =
    mesh !== null && mesh.vertices !== null && mesh.error === null && getActiveBridge() !== null;

  const hasDividers =
    params.style === 'slotted' && (params.slotConfig.x.enabled || params.slotConfig.y.enabled);
  const hasLid = shouldGenerateLid(params);

  const estimates = useMemo(() => estimatePrint(params, printSettings), [params, printSettings]);

  // Split detection — use params.gridUnitMm (the bin's actual grid unit)
  // rather than defaultGridUnitMm from settings, which may be stale
  const maxGrid = useMemo(
    () => calcMaxGridUnits(defaultPrintBedSize, params.gridUnitMm, defaultPrintBedDepth),
    [defaultPrintBedSize, defaultPrintBedDepth, params.gridUnitMm]
  );

  const needsSplit = params.width > maxGrid.width || params.depth > maxGrid.depth;

  const splitPieceCount = useMemo(
    () =>
      needsSplit ? getSplitPieceCount(params.width, params.depth, maxGrid.width, maxGrid.depth) : 1,
    [params.width, params.depth, maxGrid.width, maxGrid.depth, needsSplit]
  );

  // Forward declarations so the queued-export effect can call the downloads.
  const downloadBinRef = useRef<UseExportReturn['downloadBin'] | null>(null);
  const downloadSplitRef = useRef<UseExportReturn['downloadSplit'] | null>(null);

  // Most recent queued click (made while the engine was still warming up).
  // Only the latest click is replayed — earlier ones are superseded.
  const pendingExportRef = useRef<QueuedExport | null>(null);

  // Whenever the engine comes online, replay any queued click.
  useEffect(() => {
    if (!engineReady) return;
    const queued = pendingExportRef.current;
    if (!queued) return;
    pendingExportRef.current = null;
    if (queued.kind === 'bin') {
      void downloadBinRef.current?.(queued.format, queued.config, queued.designName);
    } else {
      void downloadSplitRef.current?.(queued.format, queued.config, queued.designName);
    }
  }, [engineReady]);

  /**
   * Build the property block shared by success and failure telemetry.
   * Reads at the call site so reactive captures don't go stale.
   */
  const buildExportTelemetry = useCallback(
    (
      format: ExportFileFormat,
      durationMs: number,
      retryCount: number,
      restartCount: number,
      isSplit: boolean
    ) => ({
      format,
      duration_ms: durationMs,
      retry_count: retryCount,
      restart_count: restartCount,
      bin_width: params.width,
      bin_depth: params.depth,
      bin_height: params.height,
      bin_style: params.style,
      has_dividers: hasDividers,
      has_lid: hasLid,
      needs_split: isSplit,
    }),
    [params, hasDividers, hasLid]
  );

  /**
   * Fire the failure toast with Retry + Report issue actions, and capture
   * telemetry. Centralized here so both download paths share identical UX.
   */
  const handleExportError = useCallback(
    (
      err: unknown,
      format: ExportFileFormat,
      retry: () => void,
      durationMs: number,
      retryCount: number,
      restartCount: number,
      isSplit: boolean
    ) => {
      const error = err instanceof Error ? err : new Error(String(err));
      const maybeCode = (error as unknown as { code?: unknown }).code;
      const errorCode = typeof maybeCode === 'string' ? maybeCode : 'UNKNOWN';

      trackBinExportFailure({
        ...buildExportTelemetry(format, durationMs, retryCount, restartCount, isSplit),
        error_code: errorCode,
        error_message: error.message,
        error_stack: error.stack ?? '',
      });

      // Mirror to the existing exception channel so PostHog session-replays
      // still surface the failure with stack context. The rich bin-config
      // payload here used to live in ExportDialog's catch block — it was
      // moved into the hook so it still fires now that the hook owns
      // export-error handling end-to-end (the dialog catch became dead code
      // for WASM errors once downloadBin/Split started returning a boolean
      // instead of re-throwing).
      captureException(error, {
        source: 'bin_export',
        export_format: format,
        is_split_export: isSplit,
        bin_width: params.width,
        bin_depth: params.depth,
        bin_height: params.height,
        bin_style: params.style,
        grid_unit_mm: params.gridUnitMm,
        has_lip: params.base.stackingLip,
        base_style: params.base.style,
        magnet_diameter: params.base.magnetDiameter,
        screw_diameter: params.base.screwDiameter,
        solid_fill: params.base.solid,
        half_sockets: params.base.halfSockets,
        wall_pattern_enabled: params.wallPattern.enabled,
        wall_pattern: params.wallPattern.pattern,
        handles_enabled: params.handles.enabled,
        cutout_count: params.cutouts.length,
        insert_count: params.inserts.length,
        // Original error chain — binExporter's retry path attaches `cause`
        // to the first-attempt error, which is invaluable when the surfaced
        // error masks a more diagnostic earlier failure.
        first_attempt_message: error.cause instanceof Error ? error.cause.message : undefined,
        retry_count: retryCount,
        restart_count: restartCount,
      });

      const issueUrl = buildReportIssueUrl(params, error, format);
      const message =
        errorCode === 'TIMEOUT'
          ? t('binDesigner.export.error.timeout')
          : t('binDesigner.export.error.body');
      addToast({
        message,
        type: 'error',
        duration: 8000,
        action: {
          label: t('binDesigner.export.error.retry'),
          onClick: retry,
        },
        secondaryAction: {
          label: t('binDesigner.export.error.report'),
          onClick: () => {
            window.open(issueUrl, '_blank', 'noopener,noreferrer');
          },
        },
      });
    },
    [buildExportTelemetry, params, addToast, t]
  );

  /**
   * Download bin + dividers (if present) in the specified format.
   *
   * Uses the combined export worker message to get all pieces in one call.
   * Packaging varies by format:
   * - 3MF: multi-object file with named pieces
   * - STEP: compound assembly (single file)
   * - STL + no dividers: plain .stl
   * - STL + dividers: .zip with separate .stl files
   */
  const downloadBin = useCallback(
    async (
      format: ExportFileFormat,
      config: ExportFileNameConfig,
      designName?: string
    ): Promise<boolean> => {
      // Engine not ready: queue the click and bail. The readiness effect above
      // will replay it once `engineReady` flips. Returning `false` lets the
      // caller (ExportDialog) skip its success path; the queued replay will
      // surface its own success/failure when it eventually fires.
      if (!engineReady || !getActiveBridge()) {
        pendingExportRef.current = { kind: 'bin', format, config, designName };
        return false;
      }

      setIsExportingBin(true);
      setExportProgress(0);
      const startTime = performance.now();
      let retryCount = 0;
      let restartCount = 0;

      try {
        const fileName = generateFileName(params, format, config, designName);
        // Worker exports BREP only as 'stl' or 'step'; 3MF is packaged on the
        // main thread from the STL output.
        const workerFormat = format === 'step' ? 'step' : 'stl';
        const exportResult = await exportWithResilience(() => {
          const bridge = getActiveBridge();
          if (!bridge) throw new Error('Bridge not available');
          // Reset per attempt so a resilience retry restarts the bar at 0
          // rather than jumping backwards from where the failed attempt left off.
          setExportProgress(0);
          return bridge.exportCombined(params, workerFormat, { onProgress: setExportProgress });
        });
        retryCount = exportResult.retryCount;
        restartCount = exportResult.restartCount;

        let threeMFContext: {
          modelName: string;
          threeMFPrintSettings: ReturnType<typeof buildThreeMFPrintSettings>;
        } | null = null;
        if (format === '3mf') {
          // Read print settings at call time to avoid capturing reactive values
          const currentPrintSettings = useSettingsStore.getState().settings.printSettings;
          const currentEstimates = estimatePrint(params, currentPrintSettings);
          threeMFContext = {
            modelName: designName ?? `gridfinity-${params.width}x${params.depth}x${params.height}`,
            threeMFPrintSettings: buildThreeMFPrintSettings(currentPrintSettings, currentEstimates),
          };
        }

        const { blob, downloadName } = buildBinDownloadPayload(
          format,
          exportResult.result,
          params,
          fileName,
          threeMFContext
        );
        triggerDownload(blob, downloadName);

        trackBinExportSucceeded(
          buildExportTelemetry(
            format,
            performance.now() - startTime,
            retryCount,
            restartCount,
            false
          )
        );
        return true;
      } catch (err) {
        handleExportError(
          err,
          format,
          () => {
            void downloadBinRef.current?.(format, config, designName);
          },
          performance.now() - startTime,
          retryCount,
          restartCount,
          false
        );
        return false;
      } finally {
        setIsExportingBin(false);
      }
    },
    [params, engineReady, buildExportTelemetry, handleExportError]
  );

  /**
   * Download split export as ZIP via worker bridge.
   * Computes cut planes, sends to worker for boolean splitting,
   * then packages results into a ZIP archive.
   * When dividers are present, includes divider pieces in the ZIP.
   * Uses worker pool for parallel export when available.
   * Supports STL and 3MF formats (STEP is not supported for split export).
   * NOTE: Multi-color data is NOT propagated to split pieces — each piece
   * exports as single-color. Split + multi-color is a known gap.
   */
  const downloadSplit = useCallback(
    async (
      format: ExportFileFormat,
      config: ExportFileNameConfig,
      designName?: string
    ): Promise<boolean> => {
      if (format === 'step') return false; // STEP does not support split export

      if (!engineReady || !getActiveBridge()) {
        pendingExportRef.current = { kind: 'split', format, config, designName };
        return false;
      }

      setIsExportingBin(true);
      const startTime = performance.now();
      let retryCount = 0;
      let restartCount = 0;

      try {
        const gridSizeMm = params.gridUnitMm;
        const cutPlanesX = getSplitPlanePositionsMm(params.width, maxGrid.width, gridSizeMm);
        const cutPlanesY = getSplitPlanePositionsMm(params.depth, maxGrid.depth, gridSizeMm);
        const connectorConfig = params.splitConnectors ?? DEFAULT_SPLIT_CONNECTOR_CONFIG;
        const totalPieceCount = getSplitPieceCount(
          params.width,
          params.depth,
          maxGrid.width,
          maxGrid.depth
        );

        // Wrap the split-export call in resilience. The pool/bridge fallback
        // is encapsulated in `runSplitBinExport`; resilience treats the whole
        // thing as a single retryable operation.
        const splitExport = await exportWithResilience(() =>
          runSplitBinExport(
            params,
            cutPlanesX,
            cutPlanesY,
            totalPieceCount,
            connectorConfig,
            format
          )
        );
        retryCount = splitExport.retryCount;
        restartCount = splitExport.restartCount;
        const result = splitExport.result;

        const baseName = generateFileName(params, format, config, designName).replace(
          /\.[^.]+$/,
          ''
        );

        // Collect non-bin companion pieces (dividers, lid) — split export
        // produces only bin pieces, so any extras come from a parallel
        // combined export.
        const companionPieces: { data: ArrayBuffer; label: string }[] = [];
        if (hasDividers || hasLid) {
          const combined = await exportWithResilience(() => {
            const bridge = getActiveBridge();
            if (!bridge) throw new Error('Bridge not available');
            return bridge.exportCombined(params, 'stl');
          });
          // Companion retries roll into the totals.
          retryCount += combined.retryCount;
          restartCount += combined.restartCount;
          for (const piece of combined.result.pieces) {
            if (piece.label !== 'bin') {
              companionPieces.push({ data: piece.data, label: piece.label });
            }
          }
        }

        if (format === '3mf') {
          const currentPrintSettings = useSettingsStore.getState().settings.printSettings;
          const currentEstimates = estimatePrint(params, currentPrintSettings);
          const threeMFPrintSettings = buildThreeMFPrintSettings(
            currentPrintSettings,
            currentEstimates
          );

          const convertedPieces = await buildSplit3MFPieces(
            [...result.pieces.map((p) => ({ data: p.data, label: p.label })), ...companionPieces],
            baseName,
            threeMFPrintSettings
          );

          const zip = packagePiecesAsZip(convertedPieces, baseName, '.3mf');
          triggerDownload(zip, `${baseName}_split.zip`);
        } else {
          const allPieces = [
            ...result.pieces.map((p) => ({ data: p.data, label: p.label })),
            ...companionPieces,
          ];
          const blob = packagePiecesAsZip(allPieces, baseName, '.stl');
          triggerDownload(blob, `${baseName}_split.zip`);
        }

        trackBinExportSucceeded(
          buildExportTelemetry(
            format,
            performance.now() - startTime,
            retryCount,
            restartCount,
            true
          )
        );
        return true;
      } catch (err) {
        handleExportError(
          err,
          format,
          () => {
            void downloadSplitRef.current?.(format, config, designName);
          },
          performance.now() - startTime,
          retryCount,
          restartCount,
          true
        );
        return false;
      } finally {
        setIsExportingBin(false);
      }
    },
    [params, maxGrid, hasDividers, hasLid, engineReady, buildExportTelemetry, handleExportError]
  );

  // Wire refs so the queued-export effect (and Retry callbacks) can find the
  // latest closures without recreating them on every render. The ref is
  // touched inside an effect because React's `react-hooks/refs` rule forbids
  // writes during render — same end result, lint-clean.
  useEffect(() => {
    downloadBinRef.current = downloadBin;
    downloadSplitRef.current = downloadSplit;
  });

  return {
    isExporting,
    isExportingBin,
    exportProgress,
    canExport,
    engineReady,
    hasDividers,
    estimates,
    downloadBin,
    needsSplit,
    splitPieceCount,
    maxGridUnits: maxGrid,
    downloadSplit,
  };
}
