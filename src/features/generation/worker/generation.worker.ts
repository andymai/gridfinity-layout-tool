/**
 * Web Worker entry point for bin geometry generation using brepjs (OpenCascade WASM).
 *
 * Receives messages from GenerationBridge, initializes the OCCT kernel,
 * and dispatches to focused handler modules.
 *
 * Protocol:
 * - INIT -> (load WASM) -> INIT_READY
 * - GENERATE -> PROGRESS* -> MESH_RESULT | ERROR
 * - EXPORT -> EXPORT_RESULT | ERROR (uses cached solid or regenerates)
 * - CANCEL -> (silently aborts current generation)
 * - CLEANUP -> CLEANUP_DONE (dispose all caches)
 */

// Must be first import — polyfills Symbol.dispose before brepjs loads
import './symbolDisposePolyfill';

import type { WorkerMessage } from '../bridge/types';
import type { KernelName } from '../bridge/types';
import type { WasmLoadResult } from './wasmInstantiator';
import { loadOpenCascade, loadBrepkit, loadOcctWasm } from './wasmInstantiator';
import { clearAllCaches } from './generators/shapeCache';
import { clearBaseplateCaches } from './generators/baseplateGenerator';
import {
  respond,
  formatError,
  setKernelInitialized,
  getKernelInfo,
  cancelRequest,
} from './handlers/workerContext';
import { handleGenerate, handleGenerateBaseplate } from './handlers/generateHandler';
import {
  handleExport,
  handleExportBaseplate,
  handleExportSnapClip,
  handleExportDividers,
  handleExportCombined,
} from './handlers/exportHandler';
import {
  handleSplitPreview,
  handleSplitPreviewRange,
  handleSplitExport,
  handleSplitExportRange,
} from './handlers/splitHandler';

/** Initialize the geometry kernel selected by the INIT message. */
async function initKernel(kernel: KernelName = 'opencascade'): Promise<void> {
  let result: WasmLoadResult;
  switch (kernel) {
    case 'brepkit':
      result = await loadBrepkit();
      break;
    case 'occt-wasm':
      result = await loadOcctWasm();
      break;
    case 'opencascade':
      result = await loadOpenCascade();
      break;
  }
  setKernelInitialized(kernel, result.isThreaded, result.hardwareConcurrency);
}

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  void (async () => {
    const message = event.data;

    switch (message.type) {
      case 'INIT':
        try {
          await initKernel(message.kernel);
          const info = getKernelInfo();
          respond({
            type: 'INIT_READY',
            isThreaded: info.isThreaded,
            hardwareConcurrency: info.hardwareConcurrency,
            kernel: info.kernel,
          });
        } catch (e) {
          respond({
            type: 'ERROR',
            requestId: '__init__',
            error: `Kernel init failed: ${formatError(e)}`,
          });
        }
        break;

      case 'GENERATE':
        handleGenerate(message);
        break;

      case 'GENERATE_BASEPLATE':
        handleGenerateBaseplate(message);
        break;

      case 'GENERATE_SPLIT_PREVIEW':
        await handleSplitPreview(message);
        break;

      case 'GENERATE_SPLIT_PREVIEW_RANGE':
        await handleSplitPreviewRange(message);
        break;

      case 'EXPORT':
        await handleExport(message);
        break;

      case 'EXPORT_BASEPLATE':
        await handleExportBaseplate(message);
        break;

      case 'EXPORT_SNAP_CLIP':
        await handleExportSnapClip(message);
        break;

      case 'EXPORT_DIVIDERS':
        await handleExportDividers(message);
        break;

      case 'EXPORT_COMBINED':
        await handleExportCombined(message);
        break;

      case 'EXPORT_SPLIT':
        await handleSplitExport(message);
        break;

      case 'EXPORT_SPLIT_RANGE':
        await handleSplitExportRange(message);
        break;

      case 'CANCEL':
        cancelRequest(message.requestId);
        break;

      case 'CLEANUP':
        clearAllCaches();
        clearBaseplateCaches();
        respond({ type: 'CLEANUP_DONE' });
        break;
    }
  })();
});
