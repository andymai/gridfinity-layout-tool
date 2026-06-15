/**
 * Export-method implementations for `GenerationBridge`.
 *
 * Every export follows the same template: prepare a slot (which gives us a
 * requestId and rejects any superseded pending request), wrap a Promise that
 * registers the resolve/reject pair against the slot, start the timeout, and
 * post the worker message. Extracted to siblings so the bridge file stays
 * focused on the worker lifecycle + state machine.
 */

import type { BinParams, BaseplateParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { WorkerMessage, ExportFormat } from './types';
import {
  computeBaseplateExportTimeoutMs,
  computeExportTimeoutMs,
  computeGenerationTimeoutMs,
  EXPORT_MAX_TIMEOUT_MS,
} from './generationTimeout';
import type {
  ExportResult,
  DividersExportResult,
  CombinedExportResult,
  SplitExportResult,
  SplitPreviewResult,
  BaseplateExportResult,
  ExportSlot,
  PendingExportMap,
} from './bridgeTypes';

export interface BridgeExportContext {
  prepareExport: (slot: ExportSlot) => Promise<string>;
  readonly pendingExports: PendingExportMap;
  startExportTimeout: (slot: ExportSlot, requestId: string, timeoutMs: number) => void;
  postMessage: (message: WorkerMessage) => void;
}

/**
 * Run an export request: prepare the slot, register the Promise callbacks,
 * start the timeout, and post the worker message. Returned Promise resolves
 * when the worker sends back the result (handled by the message handler).
 */
function runExport<T>(
  ctx: BridgeExportContext,
  slot: ExportSlot,
  timeoutMs: number,
  buildMessage: (requestId: string) => WorkerMessage,
  onProgress?: (progress: number) => void
): Promise<T> {
  return ctx.prepareExport(slot).then(
    (requestId) =>
      new Promise<T>((resolve, reject) => {
        ctx.pendingExports.set(slot, {
          resolve: resolve as (result: unknown) => void,
          reject,
          requestId,
          timer: null,
          onProgress,
        });
        ctx.startExportTimeout(slot, requestId, timeoutMs);
        ctx.postMessage(buildMessage(requestId));
      })
  );
}

export function exportBin(
  ctx: BridgeExportContext,
  params: BinParams,
  format: ExportFormat,
  options?: {
    tolerance?: number;
    angularTolerance?: number;
    onProgress?: (progress: number) => void;
  }
): Promise<ExportResult> {
  return runExport<ExportResult>(
    ctx,
    'export',
    computeExportTimeoutMs(params),
    (requestId) => ({
      type: 'EXPORT',
      payload: {
        params,
        requestId,
        format,
        tolerance: options?.tolerance,
        angularTolerance: options?.angularTolerance,
      },
    }),
    options?.onProgress
  );
}

export function exportDividers(
  ctx: BridgeExportContext,
  params: BinParams
): Promise<DividersExportResult> {
  return runExport<DividersExportResult>(
    ctx,
    'dividers',
    computeExportTimeoutMs(params),
    (requestId) => ({ type: 'EXPORT_DIVIDERS', payload: { params, requestId } })
  );
}

export function exportCombined(
  ctx: BridgeExportContext,
  params: BinParams,
  format: ExportFormat,
  options?: {
    tolerance?: number;
    angularTolerance?: number;
    onProgress?: (progress: number) => void;
  }
): Promise<CombinedExportResult> {
  return runExport<CombinedExportResult>(
    ctx,
    'combined',
    computeExportTimeoutMs(params),
    (requestId) => ({
      type: 'EXPORT_COMBINED',
      payload: {
        params,
        requestId,
        format,
        tolerance: options?.tolerance,
        angularTolerance: options?.angularTolerance,
      },
    }),
    options?.onProgress
  );
}

export function exportSplitBin(
  ctx: BridgeExportContext,
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  options?: {
    tolerance?: number;
    angularTolerance?: number;
    splitConnectorConfig?: SplitConnectorConfig;
  }
): Promise<SplitExportResult> {
  return runExport<SplitExportResult>(
    ctx,
    'split',
    computeExportTimeoutMs(params),
    (requestId) => ({
      type: 'EXPORT_SPLIT',
      payload: {
        params,
        requestId,
        cutPlanesX,
        cutPlanesY,
        tolerance: options?.tolerance,
        angularTolerance: options?.angularTolerance,
        splitConnectorConfig: options?.splitConnectorConfig,
      },
    })
  );
}

export function generateSplitPreview(
  ctx: BridgeExportContext,
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  options?: { splitConnectorConfig?: SplitConnectorConfig }
): Promise<SplitPreviewResult> {
  return runExport<SplitPreviewResult>(
    ctx,
    'splitPreview',
    // Interactive preview (re-runs as the user drags cut planes), not a
    // user-committed export — keep the 3-minute preview clamp so a wedged
    // worker is cancelled promptly rather than after the 15-minute export cap.
    computeGenerationTimeoutMs(params),
    (requestId) => ({
      type: 'GENERATE_SPLIT_PREVIEW',
      payload: {
        params,
        requestId,
        cutPlanesX,
        cutPlanesY,
        splitConnectorConfig: options?.splitConnectorConfig,
      },
    })
  );
}

export function generateSplitPreviewRange(
  ctx: BridgeExportContext,
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  pieceIndices: readonly number[],
  options?: { splitConnectorConfig?: SplitConnectorConfig }
): Promise<SplitPreviewResult> {
  return runExport<SplitPreviewResult>(
    ctx,
    'splitPreview',
    // Interactive preview (see generateSplitPreview) — preview clamp, not export.
    computeGenerationTimeoutMs(params),
    (requestId) => ({
      type: 'GENERATE_SPLIT_PREVIEW_RANGE',
      payload: {
        params,
        requestId,
        cutPlanesX,
        cutPlanesY,
        pieceIndices,
        splitConnectorConfig: options?.splitConnectorConfig,
      },
    })
  );
}

export function exportSplitBinRange(
  ctx: BridgeExportContext,
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  pieceIndices: readonly number[],
  options?: {
    tolerance?: number;
    angularTolerance?: number;
    splitConnectorConfig?: SplitConnectorConfig;
  }
): Promise<SplitExportResult> {
  return runExport<SplitExportResult>(
    ctx,
    'split',
    computeExportTimeoutMs(params),
    (requestId) => ({
      type: 'EXPORT_SPLIT_RANGE',
      payload: {
        params,
        requestId,
        cutPlanesX,
        cutPlanesY,
        pieceIndices,
        tolerance: options?.tolerance,
        angularTolerance: options?.angularTolerance,
        splitConnectorConfig: options?.splitConnectorConfig,
      },
    })
  );
}

export function exportBaseplate(
  ctx: BridgeExportContext,
  params: BaseplateParams,
  format: ExportFormat,
  options?: { tolerance?: number; angularTolerance?: number }
): Promise<BaseplateExportResult> {
  return runExport<BaseplateExportResult>(
    ctx,
    'export',
    computeBaseplateExportTimeoutMs(params),
    (requestId) => ({
      type: 'EXPORT_BASEPLATE',
      payload: {
        params,
        requestId,
        format,
        tolerance: options?.tolerance,
        angularTolerance: options?.angularTolerance,
      },
    })
  );
}

/**
 * Export the standalone dovetail key. Reuses the `'export'` slot and
 * the BASEPLATE_EXPORT_RESULT response (same data/format/fileName shape).
 */
export function exportConnectorKey(
  ctx: BridgeExportContext,
  params: BaseplateParams,
  format: ExportFormat,
  options?: { tolerance?: number; angularTolerance?: number }
): Promise<BaseplateExportResult> {
  return runExport<BaseplateExportResult>(
    ctx,
    'export',
    computeBaseplateExportTimeoutMs(params),
    (requestId) => ({
      type: 'EXPORT_CONNECTOR_KEY',
      payload: {
        params,
        requestId,
        format,
        tolerance: options?.tolerance,
        angularTolerance: options?.angularTolerance,
      },
    })
  );
}

/**
 * Export the connector fit-sample tray. The tray's work (≈30 coupon booleans +
 * embossed labels) is fixed regardless of the user's baseplate footprint, so it
 * uses a fixed generous timeout rather than the footprint-derived budget. Like
 * every other export it runs on the user's (possibly slow) hardware and is
 * cancellable, so it shares the high export ceiling — the timeout only guards
 * against a wedged worker, not interactive wait.
 */
const CONNECTOR_SAMPLE_TIMEOUT_MS = EXPORT_MAX_TIMEOUT_MS;

export function exportConnectorSample(
  ctx: BridgeExportContext,
  params: BaseplateParams,
  format: ExportFormat,
  options?: { tolerance?: number; angularTolerance?: number }
): Promise<BaseplateExportResult> {
  return runExport<BaseplateExportResult>(
    ctx,
    'export',
    CONNECTOR_SAMPLE_TIMEOUT_MS,
    (requestId) => ({
      type: 'EXPORT_CONNECTOR_SAMPLE',
      payload: {
        params,
        requestId,
        format,
        tolerance: options?.tolerance,
        angularTolerance: options?.angularTolerance,
      },
    })
  );
}
