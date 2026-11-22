/**
 * The cutout library inside the cutout workspace: saving the selection, the
 * ghost that places an item, and the tab and dialogs that drive both.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';
import { isErr } from '@/core/result';
import { trackEvent } from '@/shared/analytics/posthog';
import { generateUUID } from '@/shared/utils/uuid';
import { useLatestRef } from '@/shared/hooks/useLatestRef';
import type { Cutout, LibraryInsertOutcome } from '@/features/bin-designer/types';
import type { MeshAssetEntry } from '@/shared/generation/meshAsset';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { CutoutLibraryItem } from '@/features/bin-designer/library/libraryTypes';
import { MAX_LIBRARY_ITEMS } from '@/features/bin-designer/library/libraryTypes';
import { createItem, updateItem } from '@/features/bin-designer/library/CutoutLibraryService';
import { useCutoutLibrary } from '@/features/bin-designer/library/cutoutLibraryStore';
import { placeLibraryContent, toLibraryContent } from './libraryContent';
import { ghostOf, type LibraryGhost } from './libraryPlacement';
import { defaultSaveName, saveSource } from './librarySave';
import { LibraryGhost3D } from './LibraryGhost3D';
import { LibraryPanel } from './LibraryPanel';
import { ManageLibraryDialog } from './ManageLibraryDialog';
import { SaveToLibraryDialog, type SaveChoice } from './SaveToLibraryDialog';

const REFUSALS: Record<Exclude<LibraryInsertOutcome, 'added'>, string> = {
  noRoom: 'binDesigner.cutouts.library.noRoom',
  meshOnLid: 'binDesigner.cutouts.library.meshOnLid',
  overBudget: 'binDesigner.cutouts.library.overBudget',
};

interface UseCutoutLibraryWorkspaceArgs {
  /** The board's cutouts: the bin's, or the lid's while the lid is edited. */
  readonly cutouts: readonly Cutout[];
  readonly selection: ReadonlySet<string>;
  readonly groupNames: Readonly<Record<string, string>> | undefined;
  readonly meshAssets: Readonly<Record<string, MeshAssetEntry>> | undefined;
  readonly maxCutDepth: number;
  readonly isLid: boolean;
  readonly binWidth: number;
  readonly binDepth: number;
  /** The snap step in mm, or null when snapping is off. */
  readonly grid: number | null;
  readonly selectIds: (ids: readonly string[], additive: boolean) => void;
}

interface Placing {
  readonly item: CutoutLibraryItem;
  readonly ghost: LibraryGhost;
}

interface SaveDraft {
  readonly chosen: readonly Cutout[];
  readonly source: CutoutLibraryItem | null;
  readonly defaultName: string;
}

export interface CutoutLibraryWorkspace {
  readonly canSave: boolean;
  /** Whether an item's ghost follows the cursor. */
  readonly placing: boolean;
  readonly openSave: () => void;
  /** The dock's Library tab. */
  readonly panel: ReactNode;
  /** Dialogs, rendered once at the workspace root. */
  readonly dialogs: ReactNode;
  /** The ghost, rendered inside the board's 3D scene while an item is placed. */
  readonly sceneOverlay: ReactNode;
  /** A line over the board that says how to place or cancel. */
  readonly hint: ReactNode;
}

export function useCutoutLibraryWorkspace({
  cutouts,
  selection,
  groupNames,
  meshAssets,
  maxCutDepth,
  isLid,
  binWidth,
  binDepth,
  grid,
  selectIds,
}: UseCutoutLibraryWorkspaceArgs): CutoutLibraryWorkspace {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const { items, folders } = useCutoutLibrary();
  const [placingId, setPlacingId] = useState<string | null>(null);
  // Read from the library each render, so an item deleted or edited elsewhere
  // ends or redraws its ghost.
  const placingItem = placingId === null ? null : (items.find((i) => i.id === placingId) ?? null);
  const placingGhost = useMemo(
    () => (placingItem ? ghostOf(placingItem.content) : null),
    [placingItem]
  );
  const placing: Placing | null =
    placingItem && placingGhost ? { item: placingItem, ghost: placingGhost } : null;
  const [draft, setDraft] = useState<SaveDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [managing, setManaging] = useState(false);

  const canSave = selection.size > 0;

  const openSave = useCallback(() => {
    const chosen = cutouts.filter((c) => selection.has(c.id));
    if (chosen.length === 0) return;
    const source = saveSource(chosen, items);
    setDraft({
      chosen,
      source,
      defaultName: defaultSaveName(
        chosen,
        source,
        groupNames,
        t('binDesigner.cutouts.library.defaultName')
      ),
    });
  }, [cutouts, selection, items, groupNames, t]);

  const save = async (choice: SaveChoice) => {
    if (!draft) return;
    const content = toLibraryContent(draft.chosen, cutouts, {
      cutoutGroupNames: groupNames,
      meshAssets,
    });
    if (!content) return;
    setSaving(true);
    const target = choice.mode === 'update' ? draft.source : null;
    const updating = target !== null;
    let result: Awaited<ReturnType<typeof createItem>>;
    try {
      result = target
        ? await updateItem(target.id, { name: choice.name, folderId: choice.folderId, content })
        : await createItem({ name: choice.name, folderId: choice.folderId, content });
    } finally {
      setSaving(false);
    }
    if (isErr(result)) {
      const full = result.error.code === 'STORAGE_QUOTA_EXCEEDED';
      addToast(
        full
          ? t('binDesigner.cutouts.library.full', { max: MAX_LIBRARY_ITEMS })
          : t('binDesigner.cutouts.library.saveFailed'),
        'error'
      );
      return;
    }
    useDesignerStore.getState().setCutoutsLibraryItem(
      draft.chosen.map((c) => c.id),
      result.value.id
    );
    trackEvent(updating ? 'cutout_library_item_updated' : 'cutout_library_item_saved', {
      shapes: content.params.cutouts.length,
    });
    addToast(
      updating
        ? t('binDesigner.cutouts.library.updated', { name: result.value.name })
        : t('binDesigner.cutouts.library.saved', { name: result.value.name }),
      'success'
    );
    setDraft(null);
  };

  const startPlacing = useCallback((item: CutoutLibraryItem) => {
    setPlacingId((current) => (current === item.id ? null : item.id));
  }, []);

  const placingRef = useLatestRef(placing);
  const drop = useCallback(
    (at: { x: number; y: number }) => {
      const current = placingRef.current;
      if (!current) return;
      const placed = placeLibraryContent(current.item.content, {
        itemId: current.item.id,
        at,
        newCutoutId: generateUUID,
        newGroupId: generateUUID,
        maxCutDepth,
      });
      const outcome = useDesignerStore
        .getState()
        .addLibraryCutouts(placed.cutouts, placed.meshAssets, placed.groupNames);
      if (outcome !== 'added') {
        addToast(t(REFUSALS[outcome]), 'error');
        return;
      }
      selectIds(
        placed.cutouts.map((c) => c.id),
        false
      );
      trackEvent('cutout_library_item_inserted', {
        shapes: placed.cutouts.length,
        target: isLid ? 'lid' : 'bin',
      });
      setPlacingId(null);
    },
    [placingRef, maxCutDepth, addToast, t, selectIds, isLid]
  );

  // Capture phase, ahead of the workspace's own keys, so Esc ends the
  // placement and does nothing else.
  const active = placing !== null;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setPlacingId(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);

  const panel = (
    <LibraryPanel
      cutouts={cutouts}
      canSave={canSave}
      placingId={placing?.item.id ?? null}
      onSave={openSave}
      onPlace={startPlacing}
      onManage={() => setManaging(true)}
    />
  );

  const dialogs = (
    <>
      {draft && (
        <SaveToLibraryDialog
          source={draft.source}
          defaultName={draft.defaultName}
          folders={folders}
          saving={saving}
          onSave={(choice) => void save(choice)}
          onCancel={() => setDraft(null)}
        />
      )}
      {managing && <ManageLibraryDialog onClose={() => setManaging(false)} />}
    </>
  );

  const sceneOverlay = useMemo(
    () =>
      placingGhost ? (
        <LibraryGhost3D
          ghost={placingGhost}
          binWidth={binWidth}
          binDepth={binDepth}
          grid={grid}
          onDrop={drop}
        />
      ) : null,
    [placingGhost, binWidth, binDepth, grid, drop]
  );

  const hint = placing ? (
    <div
      role="status"
      className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md border border-stroke-subtle bg-surface-elevated px-3 py-1.5 text-xs text-content-secondary shadow-md"
    >
      {t('binDesigner.cutouts.library.placeHint', { name: placing.item.name })}
    </div>
  ) : null;

  return { canSave, placing: active, openSave, panel, dialogs, sceneOverlay, hint };
}
