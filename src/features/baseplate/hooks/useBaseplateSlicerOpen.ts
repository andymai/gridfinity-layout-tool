/**
 * Hook for the "Open in Slicer" flow in the baseplate export dialog.
 *
 * Flow:
 * 1. Generate a 3MF file via the generation bridge (STL → parse → package)
 * 2. Upload to a temporary public URL via /api/slicer-upload
 * 3. Fire the slicer's protocol handler via a hidden anchor click
 * 4. Detect whether the slicer opened via window blur + 5s timeout
 *
 * For split baseplates, generates the full unsplit baseplate as a single 3MF
 * (slicers cannot open ZIP archives).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { getActiveBridge } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { buildSlicerUrl } from '@/shared/utils/slicerConfig';
import { isErr } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import { generateBaseplateFileName, toNamingParams } from '../utils/fileNaming';
import type { SlicerSite } from '@/core/store/settings';

const SLICER_DETECTION_TIMEOUT_MS = 5000;

interface UseBaseplateSlicerOpenReturn {
  readonly isOpening: boolean;
  readonly openingSlicerId: string | null;
  readonly openInSlicer: (slicer: SlicerSite) => Promise<void>;
}

export function useBaseplateSlicerOpen(): UseBaseplateSlicerOpenReturn {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

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

  const exportFileNameConfig = useBaseplatePageStore((s) => s.exportFileNameConfig);
  const [openingSlicerId, setOpeningSlicerId] = useState<string | null>(null);
  const detectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (detectionTimerRef.current) {
        clearTimeout(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
    };
  }, []);

  const openInSlicer = useCallback(
    async (slicer: SlicerSite) => {
      const bridge = getActiveBridge();
      if (!bridge) {
        addToast({ message: t('baseplate.exportNotReady'), type: 'error', duration: 5000 });
        return;
      }

      setOpeningSlicerId(slicer.id);

      const fullParams = buildFullParams(
        baseplateParams,
        drawerWidth,
        drawerDepth,
        gridUnitMm,
        fractionalEdgeX,
        fractionalEdgeY
      );

      const fileName = generateBaseplateFileName(
        toNamingParams(fullParams),
        '3mf',
        exportFileNameConfig
      );

      const triggerFallbackDownload = (blob: Blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      };

      let protocolFired = false;
      let threeMFBlob: Blob | null = null;

      try {
        // Step 1: Generate 3MF (full unsplit baseplate — slicers can't open ZIPs)
        const stlResult = await bridge.exportBaseplate(fullParams, 'stl');
        const parseResult = parseSTLBinary(stlResult.data);
        if (isErr(parseResult)) {
          addToast({ message: t('slicerOpen.generationFailed'), type: 'error', duration: 5000 });
          return;
        }
        const { vertices, normals } = parseResult.value;

        const printSettings = useSettingsStore.getState().settings.printSettings;
        const baseNameNoExt = fileName.replace(/\.[^.]+$/, '');

        threeMFBlob = export3MF(vertices, normals, {
          name: baseNameNoExt,
          printSettings: {
            layerHeight: printSettings.layerHeightMm,
            infillPercent: printSettings.infillPercent,
            material: 'PLA',
            supportRequired: false,
            estimatedMinutes: 0,
            estimatedGrams: 0,
          },
        });

        // Step 2: Upload to temporary public URL
        const uploadResponse = await fetch('/api/slicer-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: threeMFBlob,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        const { url } = (await uploadResponse.json()) as { url: string };

        // Step 3: Blur detection + timer fallback
        detectionTimerRef.current = setTimeout(() => {
          detectionTimerRef.current = null;
          window.removeEventListener('blur', onSlicerOpened);
          addToast({
            message: t('slicerOpen.notDetected', { slicer: slicer.name }),
            type: 'info',
            duration: 5000,
          });
          setOpeningSlicerId(null);
        }, SLICER_DETECTION_TIMEOUT_MS);

        const onSlicerOpened = () => {
          if (detectionTimerRef.current) {
            clearTimeout(detectionTimerRef.current);
            detectionTimerRef.current = null;
          }
          setOpeningSlicerId(null);
        };

        window.addEventListener('blur', onSlicerOpened, { once: true });

        // Step 4: Fire protocol handler
        protocolFired = true;
        const protocolAnchor = document.createElement('a');
        protocolAnchor.href = buildSlicerUrl(slicer.protocol, url);
        protocolAnchor.style.display = 'none';
        document.body.appendChild(protocolAnchor);
        protocolAnchor.click();
        protocolAnchor.remove();
      } catch {
        if (threeMFBlob) {
          triggerFallbackDownload(threeMFBlob);
          addToast({ message: t('slicerOpen.uploadFailed'), type: 'error', duration: 5000 });
        } else {
          addToast({ message: t('slicerOpen.generationFailed'), type: 'error', duration: 5000 });
        }
      } finally {
        if (!protocolFired) {
          setOpeningSlicerId(null);
        }
      }
    },
    [
      baseplateParams,
      drawerWidth,
      drawerDepth,
      gridUnitMm,
      fractionalEdgeX,
      fractionalEdgeY,
      exportFileNameConfig,
      t,
      addToast,
    ]
  );

  return {
    isOpening: openingSlicerId !== null,
    openingSlicerId,
    openInSlicer,
  };
}
