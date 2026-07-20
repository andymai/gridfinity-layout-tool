/**
 * Export + preview for swappable label plates (#2666, PR 2).
 *
 * Derives the plate set from the design's socket plan (same math that cut
 * the sockets), snaps the text depth to a whole layer-height multiple so a
 * single filament swap yields clean two-color text, and downloads STL /
 * STEP / 3MF via the worker. `fetchPreviewStl` reuses the STL export path
 * for the pre-export 3D preview — no separate worker message needed.
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { getActiveBridge } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isErr, getUserMessage } from '@/core/result';
import { getErrorMessage } from '@/shared/utils/errors';
import {
  FORMAT_MIME_TYPES,
  FORMAT_EXTENSIONS,
  triggerDownload,
} from '@/shared/generation/exportUtils';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import {
  effectiveLabelSocketClearance,
  snapTextDepthToLayers,
} from '@/shared/constants/labelPlates';

export { snapTextDepthToLayers } from '@/shared/constants/labelPlates';
import { planLabelPlates } from '@/shared/utils/labelSocketPlan';
import type { LabelPlatePlanEntry } from '@/shared/utils/labelSocketPlan';
import type { LabelPlateExportOptions, LabelPlateExportSpec } from '@/shared/generation/bridge';
import type { ExportFileFormat } from '@/shared/types/bin';

export const LABEL_PLATES_BASE_NAME = 'label-plates';

interface UseLabelPlateExportReturn {
  readonly plates: readonly LabelPlatePlanEntry[];
  readonly isExporting: boolean;
  readonly canExport: boolean;
  readonly downloadPlates: (format: ExportFileFormat, baseName?: string) => Promise<boolean>;
  readonly fetchPreviewStl: () => Promise<ArrayBuffer | null>;
}

export function useLabelPlateExport(): UseLabelPlateExportReturn {
  const t = useTranslation();
  const { params, compartments, label, textDefaults } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      compartments: s.params.compartments,
      label: s.params.label,
      textDefaults: s.params.textDefaults,
    }))
  );

  const [isExporting, setIsExporting] = useState(false);
  const canExport = getActiveBridge() !== null;

  const plates = useMemo(() => {
    if (!label.enabled || (label.mode ?? 'text') !== 'socket') return [];
    const { innerW } = binDimensions(params);
    const clearanceMm = effectiveLabelSocketClearance(undefined, label.plateFitOffset);
    return planLabelPlates(compartments, innerW, clearanceMm, '');
  }, [params, compartments, label]);

  const buildRequest = useCallback((): {
    specs: LabelPlateExportSpec[];
    options: LabelPlateExportOptions;
  } => {
    const layerHeightMm = useSettingsStore.getState().settings.printSettings.layerHeightMm;
    return {
      specs: plates.map((p) => ({ widthU: p.widthU, text: p.text })),
      options: {
        textMode: textDefaults.mode === 'emboss' ? 'emboss' : 'deboss',
        textDepthMm: snapTextDepthToLayers(textDefaults.depth, layerHeightMm),
        textDefaults,
        v1Channels: true,
      },
    };
  }, [plates, textDefaults]);

  const downloadPlates = useCallback(
    async (format: ExportFileFormat, baseName: string = LABEL_PLATES_BASE_NAME) => {
      const bridge = getActiveBridge();
      if (!bridge || plates.length === 0) return false;

      setIsExporting(true);
      try {
        const { specs, options } = buildRequest();
        if (format === '3mf') {
          const stlResult = await bridge.exportLabelPlates(specs, options, 'stl');
          const parseResult = parseSTLBinary(stlResult.data);
          if (isErr(parseResult)) throw new Error(getUserMessage(parseResult.error));
          const printSettings = useSettingsStore.getState().settings.printSettings;
          const blob = export3MF(parseResult.value.vertices, parseResult.value.normals, {
            name: baseName,
            printSettings: {
              layerHeight: printSettings.layerHeightMm,
              infillPercent: printSettings.infillPercent,
              material: 'PLA',
              supportRequired: false,
              estimatedMinutes: 0,
              estimatedGrams: 0,
            },
          });
          triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS['3mf']}`);
        } else {
          const result = await bridge.exportLabelPlates(specs, options, format);
          const blob = new Blob([result.data], { type: FORMAT_MIME_TYPES[format] });
          triggerDownload(blob, `${baseName}${FORMAT_EXTENSIONS[format]}`);
        }
        return true;
      } catch (error: unknown) {
        useToastStore
          .getState()
          .addToast(getErrorMessage(error, t('binDesigner.plates.exportFailed')), 'error');
        return false;
      } finally {
        setIsExporting(false);
      }
    },
    [plates, buildRequest, t]
  );

  const fetchPreviewStl = useCallback(async (): Promise<ArrayBuffer | null> => {
    const bridge = getActiveBridge();
    if (!bridge || plates.length === 0) return null;
    const { specs, options } = buildRequest();
    const result = await bridge.exportLabelPlates(specs, options, 'stl');
    return result.data;
  }, [plates, buildRequest]);

  return { plates, isExporting, canExport, downloadPlates, fetchPreviewStl };
}
