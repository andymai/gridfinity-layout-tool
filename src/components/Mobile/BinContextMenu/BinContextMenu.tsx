import { Suspense, lazy, useState } from 'react';
import {
  useLayoutStore,
  useSelectionStore,
  useMobileStore,
  useViewStore,
  useUndoableAction,
  useToastStore,
} from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { useResponsive } from '@/shared/hooks';
import { useContextMenu } from '@/hooks/useContextMenu';
import { validateBinRotation, getBinLocationContext } from '@/utils/binLocation';
import { calcMaxGridUnits } from '@/core/constants';
import {
  ContextMenuContainer,
  ContextMenuItem,
  ContextMenuDivider,
} from '@/shared/components/ContextMenu';
import { STLSearchDropdown } from '@/components/STLSearchDropdown';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { findBinById } from '@/utils/entity';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import type { Bin, LayerId } from '@/core/types';

// Lazy load design-linking section
const BinContextMenuDesignSection = lazy(() =>
  import('../BinContextMenuDesignSection').then((m) => ({
    default: m.BinContextMenuDesignSection,
  }))
);

interface BinContextMenuProps {
  bin: Bin;
  position: { x: number; y: number };
  onClose: () => void;
  source?: 'grid' | 'staging';
}

/**
 * Context menu for single bin actions (triggered by right-click or long-press).
 */
export function BinContextMenu({ bin, position, onClose, source }: BinContextMenuProps) {
  const t = useTranslation();

  // Calculate adjusted position for upward opening
  // For staging bins, position menu above cursor but not too far
  // Use a moderate offset instead of full menu height to keep it close
  const shouldOpenUpward = source === 'staging';
  const upwardOffset = 120; // Enough to show menu is above, but not disconnected
  const adjustedPosition = {
    x: position.x,
    y: shouldOpenUpward
      ? Math.max(0, position.y - upwardOffset) // Open upward with moderate offset
      : position.y, // Open downward (normal)
  };

  const { menuRef } = useContextMenu();

  const layout = useLayoutStore((state) => state.layout);
  const { deleteBin, moveBinToStaging, moveBinFromStaging, duplicateBin, updateBin } =
    useMutations();
  const setSelectedBins = useSelectionStore((state) => state.setSelectedBins);
  const toggleMobilePanel = useMobileStore((state) => state.toggleMobilePanel);
  const rightPanelCollapsed = useViewStore((state) => state.rightPanelCollapsed);
  const toggleRightPanel = useViewStore((state) => state.toggleRightPanel);
  const addToast = useToastStore((state) => state.addToast);

  const { execute } = useUndoableAction();
  const { isDesktop } = useResponsive();

  const handleDelete = () => {
    // Track deletion BEFORE executing (need bin data)
    mlTracking.trackDeletion(bin, 'context_menu');

    // Track quick correction for deleted bin
    mlTracking.trackQuickCorrect('delete', bin.id, bin);

    execute(() => deleteBin(bin.id));
    setSelectedBins([]);
    onClose();
  };

  const handleToStaging = () => {
    execute(() => moveBinToStaging(bin.id));
    onClose();
  };

  const handleDuplicate = () => {
    execute(() => {
      const result = duplicateBin(bin.id);
      if (isOk(result)) {
        // Track for ML telemetry
        const newBin = findBinById(useLayoutStore.getState().layout, result.value);
        if (newBin) {
          mlTracking.trackPlacement(newBin, 'duplicate');
        }
      }
    });
    onClose();
  };

  const handleEdit = () => {
    setSelectedBins([bin.id]);
    if (isDesktop) {
      // On desktop, expand the right panel if it's collapsed
      if (rightPanelCollapsed) {
        toggleRightPanel();
      }
    } else {
      // On mobile/tablet, open the inspector panel
      toggleMobilePanel('inspector');
    }
    onClose();
  };

  const handleRotate = () => {
    const result = validateBinRotation(bin, layout);
    if (!result.valid) {
      addToast(result.message, 'error');
      onClose();
      return;
    }

    // Rotation is valid, perform it (may include position change)
    execute(() => {
      const updates: Partial<Bin> = { width: bin.depth, depth: bin.width };
      if (result.movedTo) {
        updates.x = result.movedTo.x;
        updates.y = result.movedTo.y;
      }
      updateBin(bin.id, updates);
    });

    // Show toast if bin was relocated to fit rotation
    if (result.movedTo) {
      addToast(t('toast.rotateRepositioned', { distance: result.movedTo.distance }), 'info');
    }

    onClose();
  };

  const [showLayerPicker, setShowLayerPicker] = useState(false);

  const handleMoveToGrid = (targetLayerId: LayerId) => {
    let placed = false;
    execute(() => {
      const result = moveBinFromStaging(bin.id, targetLayerId, 0, 0);
      placed = isOk(result);
    });
    if (placed) {
      addToast(t('toast.binsMovedToLayer', { count: 1 }), 'success');
      onClose();
    } else {
      addToast(t('toast.dragFromStash'), 'info');
      onClose();
    }
  };

  // On desktop, only show Edit Properties when right panel is collapsed
  const showEditOption = !isDesktop || rightPanelCollapsed;

  const locationContext = getBinLocationContext(bin);
  const canMoveToStash = locationContext.canMoveToStash;
  const isInStash = locationContext.location === 'stash';
  // On desktop, hide rotate for stash bins since the hover rotate button is available.
  // On mobile, the context menu is the only way to rotate stash bins.
  const showRotate = locationContext.canRotate && !(isInStash && isDesktop);

  // Check if bin needs splitting for STL search
  const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);
  const needsSplit = bin.width > maxGridUnits || bin.depth > maxGridUnits;

  return (
    <ContextMenuContainer
      isOpen={true}
      position={adjustedPosition}
      onClose={onClose}
      menuRef={menuRef}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-stroke-subtle">
        <div className="font-medium text-content">
          {t('inspector.bin', { width: bin.width, depth: bin.depth })}
        </div>
        {bin.label && <div className="text-sm truncate text-content-tertiary">{bin.label}</div>}
      </div>

      {/* Actions */}
      <div className="py-1">
        {showEditOption && (
          <ContextMenuItem
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            }
            label={t('mobile.binMenu.editProperties')}
            onClick={handleEdit}
          />
        )}

        {!isInStash && (
          <ContextMenuItem
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            }
            label={t('common.duplicate')}
            onClick={handleDuplicate}
          />
        )}

        {showRotate && (
          <ContextMenuItem
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            }
            label={t('mobile.binMenu.rotate')}
            onClick={handleRotate}
          />
        )}

        {canMoveToStash && (
          <ContextMenuItem
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                />
              </svg>
            }
            label={t('mobile.binMenu.toStash')}
            onClick={handleToStaging}
          />
        )}

        {isInStash && (
          <div>
            <button
              onClick={() => {
                if (layout.layers.length === 1) {
                  handleMoveToGrid(layout.layers[0].id);
                } else {
                  setShowLayerPicker(!showLayerPicker);
                }
              }}
              className="w-full px-4 py-3 flex items-center justify-between transition-colors text-content hover:bg-surface-hover"
            >
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-content-tertiary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
                {t('mobile.binMenu.moveToGrid')}
              </div>
              {layout.layers.length > 1 && (
                <svg
                  className={`w-4 h-4 ml-3 transition-transform ${showLayerPicker ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              )}
            </button>
            {showLayerPicker && (
              <div className="px-2 py-1 bg-surface-secondary">
                {layout.layers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => handleMoveToGrid(layer.id)}
                    className="w-full px-3 py-2 text-left rounded transition-colors hover:bg-surface-hover"
                  >
                    <div className="text-sm text-content">{layer.name}</div>
                    <div className="text-xs text-content-tertiary">
                      {t('mobile.contextMenu.minHeight', { height: layer.height })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <STLSearchDropdown
          width={bin.width}
          depth={bin.depth}
          variant="menu-item"
          onClose={onClose}
          needsSplit={needsSplit}
        />

        <ContextMenuDivider />

        {/* Design Linking Actions */}
        <Suspense fallback={null}>
          <BinContextMenuDesignSection bin={bin} onClose={onClose} />
        </Suspense>

        <ContextMenuItem
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          }
          label={t('common.delete')}
          onClick={handleDelete}
          destructive
        />
      </div>
    </ContextMenuContainer>
  );
}
