/**
 * Hook for exporting the connector fit-sample tray (a calibration card sweeping
 * all three connector styles across a fit-offset ladder) as STL, STEP, or 3MF.
 *
 * Single-file export: the worker compounds every coupon + shared loose part into
 * one ready-to-slice tray. Independent of the active split/connector selection —
 * it always sweeps all styles/offsets — but reuses the layout's grid unit and
 * magnet settings so the coupon height matches the real plate.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { useTranslation } from '@/i18n';
import { downloadWorkerSample, useSampleExport } from '@/shared/hooks/useSampleExport';
import type { SampleExportContext, UseSampleExportReturn } from '@/shared/hooks/useSampleExport';
import { buildFullParams } from '../utils/buildFullParams';

/** Default download name when the dialog isn't given a custom one. */
export const CONNECTOR_SAMPLE_BASE_NAME = 'connector-fit-sample';

export function useConnectorSampleExport(): UseSampleExportReturn {
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

  const download = useCallback(
    (context: SampleExportContext) => {
      const fullParams = buildFullParams(
        baseplateParams,
        drawerWidth,
        drawerDepth,
        gridUnitMm,
        fractionalEdgeX,
        fractionalEdgeY,
        context.printSettings.nozzleSizeMm
      );
      return downloadWorkerSample(context, (format) =>
        context.bridge.exportConnectorSample(fullParams, format)
      );
    },
    [baseplateParams, drawerWidth, drawerDepth, gridUnitMm, fractionalEdgeX, fractionalEdgeY]
  );

  return useSampleExport({
    defaultBaseName: CONNECTOR_SAMPLE_BASE_NAME,
    notReadyMessage: t('baseplate.exportNotReady'),
    failureMessage: t('baseplate.connectorSample.exportFailed'),
    download,
  });
}
