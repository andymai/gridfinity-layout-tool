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
import { computeBaseplateTimeoutMs, computeGenerationTimeoutMs } from './generationTimeout';
import type {
  ExportResult,
  DividersExportResult,
  CombinedExportResult,
  SplitExportResult,
  SplitPreviewResult,
  BaseplateExportResult,
  ExportSlot,
  PendingExport,
} from './bridgeTypes';

export interface BridgeExportContext {
  prepareExport: (slot: ExportSlot) => Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pendingExports values are PendingExport<T> with different T per slot; type safety enforced at each call site
  readonly pendingExports: Map<ExportSlot, PendingExport<any>>;
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
  buildMessage: (requestId: string) => WorkerMessage
): Promise<T> {
  return ctx.prepareExport(slot).then(
    (requestId) =>
      new Promise<T>((resolve, reject) => {
        ctx.pendingExports.set(slot, {
          resolve: resolve as (result: unknown) => void,
          reject,
          requestId,
          timer: null,
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
  options?: { tolerance?: number; angularTolerance?: number }
): Promise<ExportResult> {
  return runExport<ExportResult>(
    ctx,
    'export',
    computeGenerationTimeoutMs(params),
    (requestId) => ({
      type: 'EXPORT',
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

export function exportDividers(
  ctx: BridgeExportContext,
  params: BinParams
): Promise<DividersExportResult> {
  return runExport<DividersExportResult>(
    ctx,
    'dividers',
    computeGenerationTimeoutMs(params),
    (requestId) => ({ type: 'EXPORT_DIVIDERS', payload: { params, requestId } })
  );
}

export function exportCombined(
  ctx: BridgeExportContext,
  params: BinParams,
  format: ExportFormat,
  options?: { tolerance?: number; angularTolerance?: number }
): Promise<CombinedExportResult> {
  return runExport<CombinedExportResult>(
    ctx,
    'combined',
    computeGenerationTimeoutMs(params),
    (requestId) => ({
      type: 'EXPORT_COMBINED',
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
    computeGenerationTimeoutMs(params),
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
    computeGenerationTimeoutMs(params),
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
    computeBaseplateTimeoutMs(params),
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
    computeBaseplateTimeoutMs(params),
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
