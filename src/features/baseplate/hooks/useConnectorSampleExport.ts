/**
 * Hook for exporting the connector fit-sample tray (a calibration card sweeping
 * all three connector styles across a fit-offset ladder) as STL, STEP, or 3MF.
 *
 * Single-file export: the worker compounds every coupon + shared loose part into
 * one ready-to-slice tray. Independent of the active split/connector selection —
 * it always sweeps all styles/offsets — but reuses the layout's grid unit and
 * magnet settings so the coupon height matches the real plate.
 */

import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { getActiveBridge } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isErr, getUserMessage } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { buildFullParams } from '../utils/buildFullParams';
import {
  FORMAT_MIME_TYPES,
  FORMAT_EXTENSIONS,
  triggerDownload,
} from '@/shared/generation/exportUtils';
import type { ExportFileFormat } from '@/shared/types/bin';

/** Default download name when the dialog isn't given a custom one. */
export const CONNECTOR_SAMPLE_BASE_NAME = 'connector-fit-sample';

interface UseConnectorSampleExportReturn {
  readonly isExporting: boolean;
  readonly canExport: boolean;
  readonly downloadSample: (format: ExportFileFormat, baseName?: string) => Promise<boolean>;
}

function convertStlTo3mf(stlData: ArrayBuffer, name: string): Blob {
  const parseResult = parseSTLBinary(stlData);
  if (isErr(parseResult)) {
    throw new Error(getUserMessage(parseResult.error));
  }
  const { vertices, normals } = parseResult.value;
  const printSettings = useSettingsStore.getState().settings.printSettings;
  return export3MF(vertices, normals, {
    name,
    printSettings: {
      layerHeight: printSettings.layerHeightMm,
      infillPercent: printSettings.infillPercent,
      material: 'PLA',
      supportRequired: false,
      estimatedMinutes: 0,
      estimatedGrams: 0,
    },
  });
}

export function useConnectorSampleExport(): UseConnectorSampleExportReturn {
  const t = useTranslation();

  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    baseplateParams,
  } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      gridUnitMm: state.layout.gridUnitMm,
      fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
      fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );

  const [isExporting, setIsExporting] = useState(false);
  const canExport = getActiveBridge() !== null;

  const downloadSample = useCallback(
    async (format: ExportFileFormat, baseName: string = CONNECTOR_SAMPLE_BASE_NAME) => {
      const bridge = getActiveBridge();
      if (!bridge) {
        useToastStore.getState().addToast(t('baseplate.exportNotReady'), 'error');
        return false;
      }

      setIsExporting(true);
      try {
        const fullParams = buildFullParams(
          baseplateParams,
          drawerWidth,
          drawerDepth,
          gridUnitMm,
          fractionalEdgeX,
          fractionalEdgeY
        );

        if (format === '3mf') {
          const stlResult = await bridge.exportConnectorSample(fullParams, 'stl');
          const blob = convertStlTo3mf(stlResult.data, baseName);
          triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS['3mf']}`);
        } else {
          const result = await bridge.exportConnectorSample(fullParams, format);
          const blob = new Blob([result.data], { type: FORMAT_MIME_TYPES[format] });
          triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS[format]}`);
        }
        return true;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Export failed';
        useToastStore.getState().addToast(message, 'error');
        return false;
      } finally {
        setIsExporting(false);
      }
    },
    [t, drawerWidth, drawerDepth, gridUnitMm, fractionalEdgeX, fractionalEdgeY, baseplateParams]
  );

  return { isExporting, canExport, downloadSample };
}
