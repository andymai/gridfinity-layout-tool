/**
 * Hook for the "Open in Slicer" flow in the bin designer export dialog.
 *
 * Flow:
 * 1. Generate a 3MF file via the generation worker
 * 2. Upload it to a temporary public URL via /api/slicer-upload
 * 3. Fire the slicer's protocol handler via a hidden anchor click:
 *    <protocol>://open?file_url=<url>
 * 4. Detect whether the slicer opened via a window blur event. If no blur
 *    fires within 5s, show a toast suggesting the slicer may not be installed.
 *    No automatic download — the user can download manually from the dialog.
 *
 * Note: The blur-detection heuristic may not fire on Firefox/Safari for
 * some protocol handlers. This is an accepted trade-off given Chrome/Edge
 * market share among FDM printing users.
 */

import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import { getActiveBridge } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { parseSTLBinary } from '@/features/bin-designer/utils/stlParser';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { buildSlicerUrl } from '@/features/bin-designer/utils/slicerConfig';
import { isErr } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import type { SlicerSite } from '@/core/store/settings';

/** How long to wait for the slicer protocol to respond before showing a "not detected" toast */
const SLICER_DETECTION_TIMEOUT_MS = 5000;

interface UseSlicerOpenReturn {
  /** Whether a slicer upload is currently in progress */
  readonly isOpening: boolean;
  /** ID of the slicer currently being opened (null when idle) */
  readonly openingSlicerId: string | null;
  /** Open the current design in the specified slicer */
  readonly openInSlicer: (slicer: SlicerSite) => Promise<void>;
}

export function useSlicerOpen(): UseSlicerOpenReturn {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const { params, designName, exportFileNameConfig } = useDesignerStore(
    useShallow((state) => ({
      params: state.params,
      designName: state.designName,
      exportFileNameConfig: state.exportFileNameConfig,
    }))
  );

  const [openingSlicerId, setOpeningSlicerId] = useState<string | null>(null);

  const openInSlicer = useCallback(
    async (slicer: SlicerSite) => {
      const bridge = getActiveBridge();
      if (!bridge) return;

      setOpeningSlicerId(slicer.id);

      /** Trigger a browser download of the 3MF file as a fallback. */
      const triggerFallbackDownload = (blob: Blob) => {
        const fileName = generateFileName(params, '3mf', exportFileNameConfig, designName);
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      };

      // Track whether the protocol was successfully fired so `finally` knows
      // whether to reset state immediately (early exit) or defer to the
      // timer/blur callbacks (normal path).
      let protocolFired = false;
      let threeMFBlob: Blob | null = null;

      try {
        // Step 1: Generate 3MF via worker (STL → parse → package as 3MF)
        const stlResult = await bridge.exportBin(params, 'stl');
        const parseResult = parseSTLBinary(stlResult.data);
        if (isErr(parseResult)) {
          addToast({ message: t('slicerOpen.generationFailed'), type: 'error', duration: 5000 });
          return;
        }
        const { vertices, normals } = parseResult.value;

        const currentPrintSettings = useSettingsStore.getState().settings.printSettings;
        const estimates = estimatePrint(params, currentPrintSettings);

        threeMFBlob = export3MF(vertices, normals, {
          name: designName || `gridfinity-${params.width}x${params.depth}x${params.height}`,
          printSettings: {
            layerHeight: currentPrintSettings.layerHeightMm,
            infillPercent: currentPrintSettings.infillPercent,
            material: 'PLA',
            supportRequired: false,
            estimatedMinutes: estimates.printTimeMinutes,
            estimatedGrams: estimates.gramsFilament,
          },
        });

        // Step 2: Upload to temporary public URL
        // Send the Blob directly — fetch converts it to binary automatically.
        // Using application/octet-stream so Vercel's body-parser populates req.body
        // as a Buffer (it only auto-parses this content type for binary data).
        const uploadResponse = await fetch('/api/slicer-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: threeMFBlob,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        const { url } = (await uploadResponse.json()) as { url: string };

        // Step 3: Set up blur detection (slicer opened = page loses focus)
        // and a fallback timer for when the slicer isn't installed.
        // Both callbacks own the state reset to prevent premature re-enabling.
        const notDetectedTimer = setTimeout(() => {
          window.removeEventListener('blur', onSlicerOpened);
          addToast({
            message: t('slicerOpen.notDetected', { slicer: slicer.name }),
            type: 'info',
            duration: 5000,
          });
          setOpeningSlicerId(null);
        }, SLICER_DETECTION_TIMEOUT_MS);

        const onSlicerOpened = () => {
          clearTimeout(notDetectedTimer);
          setOpeningSlicerId(null);
        };

        window.addEventListener('blur', onSlicerOpened, { once: true });

        // Step 4: Fire protocol handler via anchor click — more reliable than
        // window.location.href for custom protocol URLs because it's treated
        // as a user-gesture-initiated navigation in all major browsers.
        // State reset is now owned by the callbacks above.
        protocolFired = true;
        const protocolAnchor = document.createElement('a');
        protocolAnchor.href = buildSlicerUrl(slicer.protocol, url);
        protocolAnchor.style.display = 'none';
        document.body.appendChild(protocolAnchor);
        protocolAnchor.click();
        protocolAnchor.remove();
      } catch {
        if (threeMFBlob) {
          // Upload failed — 3MF was generated successfully, so fall back to direct download
          triggerFallbackDownload(threeMFBlob);
          addToast({ message: t('slicerOpen.uploadFailed'), type: 'error', duration: 5000 });
        } else {
          // Generation failed — no 3MF available to download
          addToast({ message: t('slicerOpen.generationFailed'), type: 'error', duration: 5000 });
        }
      } finally {
        // Only reset state here for early-exit paths (errors, parse failures).
        // The normal protocol-fired path delegates reset to the timer/blur callbacks.
        if (!protocolFired) {
          setOpeningSlicerId(null);
        }
      }
    },
    [params, designName, exportFileNameConfig, t, addToast]
  );

  return {
    isOpening: openingSlicerId !== null,
    openingSlicerId,
    openInSlicer,
  };
}
