/**
 * Handlers for the generic item-type messages. `GENERATE_ITEM` resolves the
 * registered generator by `item.structure.kind` and runs it through the shared
 * `runGeneration` machinery (cancellation, progress, perf, MESH_RESULT).
 * `EXPORT_ITEM` mirrors the baseplate export via `runExport`.
 */
import type { GenerateItemMessage, ExportItemMessage } from '../../bridge/types';
import { getItemGenerator } from '../items/generatorRegistry';
import {
  runGeneration,
  runExport,
  reportProgress,
  getActiveRequestId,
  classifyExportError,
} from './workerContext';

export function handleGenerateItem(message: GenerateItemMessage): void {
  const { item, requestId } = message.payload;
  runGeneration(
    (signal) =>
      getItemGenerator(item.structure.kind).generate(
        item,
        (stage, progress) => {
          if (getActiveRequestId() !== requestId) return;
          reportProgress(requestId, stage as 'base' | 'shell' | 'features' | 'merge', progress);
        },
        false,
        signal
      ),
    requestId,
    'ItemGen',
    true
  );
}

export async function handleExportItem(message: ExportItemMessage): Promise<void> {
  const { item, requestId, format, tolerance, angularTolerance } = message.payload;
  await runExport(
    requestId,
    'BASEPLATE_EXPORT_RESULT',
    async () => {
      const result = await getItemGenerator(item.structure.kind).export(
        item,
        format,
        tolerance,
        angularTolerance
      );
      return { data: result.data, format, fileName: result.fileName };
    },
    'Item export failed',
    (p) => [p.data],
    classifyExportError
  );
}
