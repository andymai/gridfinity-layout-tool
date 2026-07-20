/**
 * Orchestration hook for importing a whole Gridfinity bin STL as a design.
 *
 * Mirrors `useStlImport` (mesh imprint cutouts) but the outcome is a new
 * `importedMesh` design in the library instead of a cutout: worker round-trip
 * via `bridge.importMesh` (parse/repair/lay-flat/decimate), grid-footprint
 * detection from the oriented bounds, user-adjustable W×D×H, then an eager
 * one-time save (imported designs are immutable, so unlike parametric bins
 * they are persisted immediately rather than on first explicit save).
 *
 * The raw file buffer is kept for the dialog's lifetime so orientation
 * corrections can re-run the worker pipeline (each run transfers a copy).
 */

import { useCallback, useRef, useState } from 'react';
import { isOk } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { bridgeManager } from '@/shared/generation/bridge';
import type {
  MeshAsset,
  MeshImportErrorReason,
  MeshImportRotation,
} from '@/shared/generation/meshAsset';
import { MAX_MESH_FILE_BYTES } from '@/shared/generation/meshAsset';
import { createDefaultEnvelope } from '@/shared/items/defaultEnvelope';
import type { ImportedMeshStructure } from '@/shared/types/item';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { saveDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  registryEdgeFields,
  upsertRegistryEntry,
} from '@/features/bin-designer/store/customBinRegistry';
import type { SavedDesign } from '@/features/bin-designer/types';
import { detectGridFromSize } from '@/features/bin-designer/utils/meshGridDetection';
import type { DetectedGrid } from '@/features/bin-designer/utils/meshGridDetection';

const ERROR_TOAST_KEYS: Record<MeshImportErrorReason, string> = {
  too_large: 'toast.stlImport.fileTooLarge',
  parse_failed: 'toast.stlImport.parseFailed',
  not_manifold: 'toast.stlImport.notManifold',
  empty: 'toast.stlImport.empty',
};

/** User-adjustable grid claim shown as steppers in the dialog. */
export interface GridClaim {
  readonly width: number;
  readonly depth: number;
  readonly heightUnits: number;
}

/** A completed worker import awaiting footprint confirmation. */
export interface PendingBinImport {
  readonly asset: MeshAsset;
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly volumeMm3: number;
  readonly fileName: string;
  readonly rotation: MeshImportRotation;
  readonly detected: DetectedGrid;
}

export interface UseImportBinDesignReturn {
  /** Start an import from a picked/dropped STL file. */
  readonly handleFile: (file: File) => void;
  /** Import awaiting confirmation, or null. */
  readonly pending: PendingBinImport | null;
  /** True while the worker is parsing/repairing/decimating. */
  readonly importing: boolean;
  /** Current grid claim (detected, then user-adjusted). */
  readonly claim: GridClaim;
  /** Override one axis of the grid claim. */
  readonly setClaim: (claim: GridClaim) => void;
  /** Re-run the import with the given axis set to an absolute angle (degrees). */
  readonly setAxisRotation: (axis: keyof MeshImportRotation, degrees: number) => void;
  /** Save the pending import as an importedMesh design. */
  readonly save: () => Promise<void>;
  /** Discard the pending import. */
  readonly cancel: () => void;
}

const EMPTY_CLAIM: GridClaim = { width: 1, depth: 1, heightUnits: 1 };

export function useImportBinDesign(
  onSaved: (design: SavedDesign) => void
): UseImportBinDesignReturn {
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  const [pending, setPending] = useState<PendingBinImport | null>(null);
  const [importing, setImporting] = useState(false);
  const [claim, setClaim] = useState<GridClaim>(EMPTY_CLAIM);
  /** Raw file bytes retained while the dialog is open, for rotation re-runs. */
  const bufferRef = useRef<ArrayBuffer | null>(null);
  const fileNameRef = useRef<string>('');

  const runImport = useCallback(
    async (rotation: MeshImportRotation): Promise<void> => {
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
          const outcome = await bridge.importMesh(buffer.slice(0), fileNameRef.current, rotation);
          if (isCancelled()) return;
          if (!outcome.ok) {
            // The toast is generic; keep the worker's real error reachable for
            // debugging (it distinguishes parse errors from WASM-load or
            // pipeline failures that share the parse_failed reason).
            console.warn('[BinImport] import failed:', outcome.reason, outcome.message);
            addToast(t(ERROR_TOAST_KEYS[outcome.reason]), 'error');
            trackEvent('stl_bin_import', { success: false, error_code: outcome.reason });
            bufferRef.current = null;
            setPending(null);
            return;
          }
          const detected = detectGridFromSize(outcome.asset.sizeMm);
          setPending({
            asset: outcome.asset,
            positions: outcome.positions,
            indices: outcome.indices,
            volumeMm3: outcome.volumeMm3,
            fileName: fileNameRef.current,
            rotation,
            detected,
          });
          setClaim({
            width: detected.width,
            depth: detected.depth,
            heightUnits: detected.heightUnits,
          });
        } finally {
          bridgeManager.release();
        }
      } catch (e) {
        if (isCancelled()) return;
        console.warn('[BinImport] worker failed:', e);
        addToast(t('toast.stlImport.parseFailed'), 'error');
        trackEvent('stl_bin_import', { success: false, error_code: 'worker_failed' });
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
        trackEvent('stl_bin_import', { success: false, error_code: 'too_large' });
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

  const setAxisRotation = useCallback(
    (axis: keyof MeshImportRotation, degrees: number) => {
      if (!pending || importing) return;
      const normalized = Number.isFinite(degrees) ? ((degrees % 360) + 360) % 360 : 0;
      if (normalized === pending.rotation[axis]) return;
      void runImport({ ...pending.rotation, [axis]: normalized });
    },
    [pending, importing, runImport]
  );

  const save = useCallback(async () => {
    if (!pending) return;
    const structure: ImportedMeshStructure = {
      kind: 'importedMesh',
      heightUnits: claim.heightUnits,
      asset: pending.asset,
      volumeMm3: pending.volumeMm3,
      sourceFileName: pending.fileName,
    };
    const envelope = {
      ...createDefaultEnvelope(DEFAULT_BIN_PARAMS.featureColors),
      width: claim.width,
      depth: claim.depth,
    };
    const result = await saveDesign({
      name: pending.asset.name,
      kind: 'importedMesh',
      envelope,
      structure,
      thumbnail: null,
      exportFileNameConfig: null,
    });
    if (!isOk(result)) {
      addToast(t('binDesigner.importBin.saveFailed'), 'error');
      trackEvent('stl_bin_import', { success: false, error_code: 'save_failed' });
      return;
    }
    const design = result.value;
    upsertRegistryEntry({
      id: design.id,
      name: design.name,
      width: claim.width,
      depth: claim.depth,
      height: claim.heightUnits,
      kind: 'importedMesh',
      ...registryEdgeFields({}),
      updatedAt: design.updatedAt,
    });
    useDesignerStore.getState().loadDesign(design);
    trackEvent('stl_bin_import', {
      success: true,
      triangle_count: pending.asset.triangleCount,
      off_grid: pending.detected.offGrid,
      has_lip: pending.detected.hasLip,
    });
    addToast(t('binDesigner.importBin.success', { name: design.name }), 'success');
    bufferRef.current = null;
    setPending(null);
    onSaved(design);
  }, [pending, claim, addToast, t, onSaved]);

  const cancel = useCallback(() => {
    bufferRef.current = null;
    setPending(null);
  }, []);

  return { handleFile, pending, importing, claim, setClaim, setAxisRotation, save, cancel };
}
