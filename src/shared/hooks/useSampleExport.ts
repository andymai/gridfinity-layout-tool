/**
 * Shared skeleton for the fit-sample export hooks (bin designer and baseplate).
 *
 * Each sample differs only in what it asks the worker for and what it calls the
 * file; readiness gating, the busy flag, the toast wording and the 3MF re-wrap
 * are identical, so they live here. Callers supply every feature-specific piece
 * as an argument, including the already-translated toast strings.
 */

import { useCallback, useState } from 'react';
import { useSettingsStore } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import { getActiveBridge } from '@/shared/generation/bridge';
import type { ExportFormat, GenerationBridge } from '@/shared/generation/bridge';
import {
  FORMAT_EXTENSIONS,
  FORMAT_MIME_TYPES,
  triggerDownload,
} from '@/shared/generation/exportUtils';
import { stlTo3MF } from '@/shared/generation/stlTo3mf';
import { useEngineReady } from '@/shared/hooks/useEngineReady';
import type { PrintSettings } from '@/shared/printSettings';
import type { ExportFileFormat } from '@/shared/types/bin';
import { getErrorMessage } from '@/shared/utils/errors';

export interface SampleExportContext {
  readonly bridge: GenerationBridge;
  readonly format: ExportFileFormat;
  readonly baseName: string;
  readonly printSettings: PrintSettings;
}

export interface SampleExportConfig {
  readonly defaultBaseName: string;
  readonly notReadyMessage: string;
  readonly failureMessage: string;
  /** ANDed with engine readiness. Omit when readiness is the only gate. */
  readonly enabled?: boolean;
  /** Memoize this, or `downloadSample` changes identity every render. */
  readonly download: (context: SampleExportContext) => Promise<void>;
}

export interface UseSampleExportReturn {
  readonly isExporting: boolean;
  readonly canExport: boolean;
  readonly downloadSample: (format: ExportFileFormat, baseName?: string) => Promise<boolean>;
}

/**
 * The plain download shape: STL and STEP ship the worker's bytes as-is, 3MF is
 * re-wrapped from an STL request.
 */
export async function downloadWorkerSample(
  context: SampleExportContext,
  run: (format: ExportFormat) => Promise<{ data: ArrayBuffer }>
): Promise<void> {
  const { format, baseName, printSettings } = context;
  if (format === '3mf') {
    const stlResult = await run('stl');
    const blob = stlTo3MF(stlResult.data, printSettings, { name: baseName });
    triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS['3mf']}`);
    return;
  }
  const result = await run(format);
  const blob = new Blob([result.data], { type: FORMAT_MIME_TYPES[format] });
  triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS[format]}`);
}

export function useSampleExport(config: SampleExportConfig): UseSampleExportReturn {
  const { defaultBaseName, notReadyMessage, failureMessage, enabled = true, download } = config;
  const [isExporting, setIsExporting] = useState(false);
  const canExport = useEngineReady() && enabled;

  const downloadSample = useCallback(
    async (format: ExportFileFormat, baseName: string = defaultBaseName): Promise<boolean> => {
      const bridge = getActiveBridge();
      if (!bridge) {
        useToastStore.getState().addToast(notReadyMessage, 'error');
        return false;
      }

      setIsExporting(true);
      try {
        await download({
          bridge,
          format,
          baseName,
          printSettings: useSettingsStore.getState().settings.printSettings,
        });
        return true;
      } catch (error: unknown) {
        useToastStore.getState().addToast(getErrorMessage(error, failureMessage), 'error');
        return false;
      } finally {
        setIsExporting(false);
      }
    },
    [defaultBaseName, notReadyMessage, failureMessage, download]
  );

  return { isExporting, canExport, downloadSample };
}
