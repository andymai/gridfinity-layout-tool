/**
 * Orchestration hook for STL file import into mesh imprint cutouts.
 *
 * Owns: file input, worker round-trip (parse/repair/lay-flat/decimate happen
 * in the generation worker via `bridge.importMesh`), the pending orientation
 * dialog state, flip re-runs, and final placement via `addMeshCutout`.
 *
 * The raw file buffer is kept for the dialog's lifetime so 90° flip
 * corrections can re-run the worker pipeline (each run transfers a copy —
 * the worker detaches its input).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { bridgeManager } from '@/shared/generation/bridge';
import type {
  MeshAsset,
  MeshImportErrorReason,
  MeshImportFlips,
} from '@/shared/generation/meshAsset';
import { MAX_MESH_ASSETS_PER_DESIGN, MAX_MESH_FILE_BYTES } from '@/shared/generation/meshAsset';
import { defaultEntryChamfer } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';

/** Default insertion clearance (mm) for an imported tool, matching scans. */
const STL_DEFAULT_CLEARANCE_MM = 0.4;

const ERROR_TOAST_KEYS: Record<MeshImportErrorReason, string> = {
  too_large: 'toast.stlImport.fileTooLarge',
  parse_failed: 'toast.stlImport.parseFailed',
  not_manifold: 'toast.stlImport.notManifold',
  empty: 'toast.stlImport.empty',
};

/** A completed worker import awaiting orientation confirmation. */
export interface PendingStlImport {
  readonly asset: MeshAsset;
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly suggestedCutDepth: number;
  readonly fileName: string;
  readonly flips: MeshImportFlips;
  /** True when the footprint exceeds the bin interior (warn, never scale). */
  readonly oversized: boolean;
}

export interface UseStlImportReturn {
  /** Trigger the native file picker for STL import. */
  readonly triggerImport: () => void;
  /** Import awaiting orientation confirmation, or null. */
  readonly pending: PendingStlImport | null;
  /** True while the worker is parsing/repairing/decimating. */
  readonly importing: boolean;
  /** Re-run the import with an extra quarter-turn about the given axis. */
  readonly flip: (axis: keyof MeshImportFlips) => void;
  /** Place the pending mesh as a cutout at the interior center. */
  readonly place: () => void;
  /** Discard the pending import. */
  readonly cancel: () => void;
}

export function useStlImport(): UseStlImportReturn {
  const addMeshCutout = useDesignerStore((s) => s.addMeshCutout);
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  const [pending, setPending] = useState<PendingStlImport | null>(null);
  const [importing, setImporting] = useState(false);
  /** Raw file bytes retained while the dialog is open, for flip re-runs. */
  const bufferRef = useRef<ArrayBuffer | null>(null);
  const fileNameRef = useRef<string>('');

  const runImport = useCallback(
    async (flips: MeshImportFlips): Promise<void> => {
      const buffer = bufferRef.current;
      if (!buffer) return;
      // cancel() nulls bufferRef; a resolving in-flight run must then discard
      // its result silently instead of re-opening the dialog (or toasting).
      const isCancelled = (): boolean => bufferRef.current !== buffer;
      setImporting(true);
      try {
        const bridge = await bridgeManager.acquire();
        try {
          // slice(): importMesh transfers its input; keep our copy intact.
          const outcome = await bridge.importMesh(buffer.slice(0), fileNameRef.current, flips);
          if (isCancelled()) return;
          if (!outcome.ok) {
            addToast(t(ERROR_TOAST_KEYS[outcome.reason]), 'error');
            trackEvent('stl_import', { success: false, error_code: outcome.reason });
            bufferRef.current = null;
            setPending(null);
            return;
          }
          const { asset } = outcome;
          const { innerW, innerD } = cutoutInterior(useDesignerStore.getState().params);
          setPending({
            asset,
            positions: outcome.positions,
            indices: outcome.indices,
            suggestedCutDepth: outcome.suggestedCutDepth,
            fileName: fileNameRef.current,
            flips,
            oversized: asset.sizeMm.x > innerW || asset.sizeMm.y > innerD,
          });
        } finally {
          bridgeManager.release();
        }
      } catch {
        if (isCancelled()) return;
        addToast(t('toast.stlImport.parseFailed'), 'error');
        trackEvent('stl_import', { success: false, error_code: 'worker_failed' });
        bufferRef.current = null;
        setPending(null);
      } finally {
        setImporting(false);
      }
    },
    [addToast, t]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > MAX_MESH_FILE_BYTES) {
        addToast(t('toast.stlImport.fileTooLarge'), 'error');
        trackEvent('stl_import', { success: false, error_code: 'too_large' });
        return;
      }
      const meshAssetCount = Object.keys(
        useDesignerStore.getState().params.meshAssets ?? {}
      ).length;
      if (meshAssetCount >= MAX_MESH_ASSETS_PER_DESIGN) {
        addToast(t('toast.stlImport.assetLimit', { count: MAX_MESH_ASSETS_PER_DESIGN }), 'error');
        trackEvent('stl_import', { success: false, error_code: 'asset_limit' });
        return;
      }
      void file.arrayBuffer().then((buffer) => {
        bufferRef.current = buffer;
        fileNameRef.current = file.name;
        void runImport({ x: 0, y: 0, z: 0 });
      });
    },
    [addToast, t, runImport]
  );

  const flip = useCallback(
    (axis: keyof MeshImportFlips) => {
      if (!pending || importing) return;
      const flips = { ...pending.flips, [axis]: (pending.flips[axis] + 1) % 4 };
      void runImport(flips);
    },
    [pending, importing, runImport]
  );

  const place = useCallback(() => {
    if (!pending) return;
    const meshId = crypto.randomUUID();
    const { asset, suggestedCutDepth } = pending;
    const current = useDesignerStore.getState().params;
    const { innerW, innerD } = cutoutInterior(current);
    addMeshCutout(
      {
        id: crypto.randomUUID(),
        shape: 'mesh',
        meshId,
        x: Math.max(0, (innerW - asset.sizeMm.x) / 2),
        y: Math.max(0, (innerD - asset.sizeMm.y) / 2),
        width: asset.sizeMm.x,
        depth: asset.sizeMm.y,
        cutDepth: suggestedCutDepth,
        rotation: 0,
        cornerRadius: 0,
        label: asset.name,
        groupId: null,
        clearance: STL_DEFAULT_CLEARANCE_MM,
        chamferWidth: defaultEntryChamfer(
          Math.min(asset.sizeMm.x, asset.sizeMm.y),
          suggestedCutDepth
        ),
      },
      asset
    );
    trackEvent('stl_import', {
      success: true,
      triangle_count: asset.triangleCount,
      oversized: pending.oversized,
    });
    addToast(t('toast.stlImport.success', { name: asset.name }), 'success');
    bufferRef.current = null;
    setPending(null);
  }, [pending, addMeshCutout, addToast, t]);

  const cancel = useCallback(() => {
    bufferRef.current = null;
    setPending(null);
  }, []);

  // Hidden file input (mirrors useSvgImport)
  const handleFileRef = useRef<(file: File) => void>(() => {});
  useEffect(() => {
    handleFileRef.current = handleFile;
  }, [handleFile]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.stl';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) handleFileRef.current(file);
      input.value = '';
    });
    document.body.appendChild(input);
    fileInputRef.current = input;
    return () => {
      input.remove();
      fileInputRef.current = null;
    };
  }, []);

  const triggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return { triggerImport, pending, importing, flip, place, cancel };
}
