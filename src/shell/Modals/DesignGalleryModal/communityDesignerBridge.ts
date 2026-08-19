/**
 * Shell-side implementations of the community detail's designer actions
 * (shared/types/communityDetail contract). The shell composes both features,
 * so this is where community requests cross into the bin designer; dynamic
 * imports keep the designer's storage/store graph out of the modal chunk
 * until an action actually runs.
 */

import { isOk } from '@/core/result';
import type { GridUnits, HeightUnits } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import type { CommunityDesign } from '@/shared/types/community';
import type {
  CommunityEditOriginalOutcome,
  CommunityPlaceOutcome,
} from '@/shared/types/communityDetail';

export async function remixCommunityDesign(
  design: CommunityDesign,
  options?: { ownDuplicate?: boolean }
): Promise<boolean> {
  try {
    const { communityToDesign } = await import('@/features/bin-designer/utils/communityToDesign');
    return isOk(await communityToDesign(design, options));
  } catch {
    return false;
  }
}

export async function openPublishForActiveDesign(): Promise<boolean> {
  try {
    const [
      { getActiveDesignId, loadDesign: loadStoredDesign },
      { useDesignerStore },
      { openCommunityPublish },
    ] = await Promise.all([
      import('@/features/bin-designer/storage/DesignerStorage'),
      import('@/features/bin-designer/store/designer'),
      import('@/features/bin-designer/hooks/useCommunityPublish'),
    ]);

    const activeId = getActiveDesignId();
    if (activeId === null) return false;
    const saved = await loadStoredDesign(activeId);
    if (!isOk(saved)) return false;

    // Load into the store here instead of waiting for the designer page:
    // openCommunityPublish reads the live designer state, which may not have
    // loaded the active design yet right after switch-to-designer.
    useDesignerStore.getState().loadDesign(saved.value);
    await openCommunityPublish(null);
    return true;
  } catch {
    return false;
  }
}

export async function editOriginalCommunityDesign(
  // Only the published id is consulted, so Mine cards (which have no full
  // record) can share this path with the detail view's owner action.
  design: Pick<CommunityDesign, 'id'>
): Promise<CommunityEditOriginalOutcome> {
  try {
    const { findLocalDesignByPublishedId } =
      await import('@/features/bin-designer/utils/findLocalDesignByPublishedId');
    const local = await findLocalDesignByPublishedId(design.id);
    if (local === null) return 'missing';

    const [{ setActiveDesignId }, { useDesignerStore }, { openCommunityPublish }] =
      await Promise.all([
        import('@/features/bin-designer/storage/DesignerStorage'),
        import('@/features/bin-designer/store/designer'),
        import('@/features/bin-designer/hooks/useCommunityPublish'),
      ]);

    setActiveDesignId(local.id);
    useDesignerStore.getState().loadDesign(local);
    // Re-derives update mode from the freshly loaded design's own
    // publishedId; no mode is passed anywhere in the dialog-open path.
    await openCommunityPublish(null);
    return 'opened';
  } catch {
    return 'error';
  }
}

/**
 * Fits-gap placement: saves a local copy of the design (lineage + open
 * counter, same as a remix), registers it as a custom bin, and places a
 * linked bin at the gap recorded in the core gapFit store. Tries the
 * as-published orientation first, then width/depth swapped (mirrors
 * rotateAll's explicit two-probe pattern; canPlaceBin never rotates).
 */
export async function placeCommunityDesignInLayout(
  design: CommunityDesign
): Promise<CommunityPlaceOutcome> {
  try {
    const [{ useGapFitStore }, { useLayoutStore, useSelectionStore }, { canPlaceBin }] =
      await Promise.all([
        import('@/core/store/gapFit'),
        import('@/core/store'),
        import('@/shared/utils/validation'),
      ]);
    const constraint = useGapFitStore.getState().constraint;
    if (constraint === null) return 'error';

    const layout = useLayoutStore.getState().layout;
    const { x, y, layerId } = constraint.targetPosition;
    if (!layout.layers.some((layer) => layer.id === layerId)) return 'error';

    const { width, depth, height } = design.params;
    // The placed bin carries raw unit counts into the layout's unit system,
    // so a design authored on different mm-per-unit scales would come out a
    // different physical size than published. Treat that as unplaceable.
    const designGridUnitMmY = design.params.gridUnitMmY ?? design.params.gridUnitMm;
    if (
      design.params.gridUnitMm !== layout.gridUnitMm ||
      designGridUnitMmY !== effectiveGridUnitMmY(layout) ||
      design.params.heightUnitMm !== layout.heightUnitMm
    ) {
      return 'no-fit';
    }
    const orientations =
      width === depth
        ? [{ width, depth }]
        : [
            { width, depth },
            { width: depth, depth: width },
          ];
    const fitting = orientations.find(
      (orientation) =>
        canPlaceBin(
          {
            x,
            y,
            width: orientation.width as GridUnits,
            depth: orientation.depth as GridUnits,
            height: height as HeightUnits,
          },
          layerId,
          layout
        ).valid
    );
    if (fitting === undefined) return 'no-fit';

    const { communityToDesign } = await import('@/features/bin-designer/utils/communityToDesign');
    const saved = await communityToDesign(design);
    if (!isOk(saved)) return 'error';

    // From here on the remix copy exists in the library (and the open
    // counter fired), so any failure must say so rather than pretend
    // nothing happened.
    try {
      const {
        upsertRegistryEntry,
        registryEdgeFields,
        registryHeightFields,
        registryOverhangFields,
      } = await import('@/features/bin-designer/store/customBinRegistry');
      // saveDesign never registers a design (only the mounted Designer page's
      // auto-save hooks do), so register explicitly or the placed bin would
      // link to an id the planner palette cannot resolve.
      upsertRegistryEntry({
        id: saved.value.id,
        name: saved.value.name,
        width,
        depth,
        height,
        ...registryEdgeFields(design.params),
        ...registryHeightFields(design.params),
        ...registryOverhangFields(design.params),
        updatedAt: saved.value.updatedAt,
      });

      const { commandBus, createCqrsMutations } = await import('@/core/cqrs');
      const result = createCqrsMutations(commandBus).addBin({
        layerId,
        x,
        y,
        width: fitting.width as GridUnits,
        depth: fitting.depth as GridUnits,
        height: height as HeightUnits,
        category: useSelectionStore.getState().activeCategoryId,
        label: '',
        notes: '',
        linkedDesignId: saved.value.id,
      });
      if (!isOk(result)) return 'error-copy-saved';

      const selection = useSelectionStore.getState();
      selection.setActiveLayer(layerId);
      selection.setSelectedBin(result.value);
      useGapFitStore.getState().clear();
      return 'placed';
    } catch {
      return 'error-copy-saved';
    }
  } catch {
    return 'error';
  }
}

/**
 * Best-effort cleanup after an unpublish performed outside the publish
 * dialog (the Mine card action): without it the local design keeps a
 * dangling publishedId and would reopen the publish dialog in update mode
 * against a deleted record.
 */
export async function clearLocalPublishedId(publishedId: string): Promise<void> {
  try {
    const [{ findLocalDesignByPublishedId }, { clearDesignPublishedId }] = await Promise.all([
      import('@/features/bin-designer/utils/findLocalDesignByPublishedId'),
      import('@/features/bin-designer/storage/DesignerStorage'),
    ]);
    const local = await findLocalDesignByPublishedId(publishedId);
    if (local !== null) {
      await clearDesignPublishedId(local.id);
    }
  } catch {
    // The published record is already gone server-side; the reconcile pass
    // (publishedIdReconcile) self-heals any pointer this failed to clear.
  }
}
