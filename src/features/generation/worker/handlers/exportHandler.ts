/**
 * EXPORT, EXPORT_BASEPLATE, EXPORT_DIVIDERS message handlers.
 */

import type {
  ExportMessage,
  ExportBaseplateMessage,
  ExportDividersMessage,
} from '../../bridge/types';
import { exportBin } from '../generators/binGenerator';
import { exportBaseplate } from '../generators/baseplateGenerator';
import { exportDividers } from '../generators/dividerExport';
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
