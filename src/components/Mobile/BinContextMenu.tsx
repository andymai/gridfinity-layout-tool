import { useLayoutStore, useUIStore, useUndoableAction, useToastStore } from '@/core/store';
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
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import type { Bin } from '@/core/types';

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
  const { deleteBin, moveBinToStaging, duplicateBin, updateBin } = useMutations();
  const setSelectedBins = useUIStore((state) => state.setSelectedBins);
  const toggleMobilePanel = useUIStore((state) => state.toggleMobilePanel);
  const rightPanelCollapsed = useUIStore((state) => state.rightPanelCollapsed);
  const toggleRightPanel = useUIStore((state) => state.toggleRightPanel);
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
        const newBin = useLayoutStore.getState().layout.bins.find((b) => b.id === result.value);
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

    // Rotation is valid, perform it
    execute(() => {
      updateBin(bin.id, { width: bin.depth, depth: bin.width });
    });
    onClose();
  };

  // On desktop, only show Edit Properties when right panel is collapsed
  const showEditOption = !isDesktop || rightPanelCollapsed;

  const locationContext = getBinLocationContext(bin);
  const canMoveToStash = locationContext.canMoveToStash;
  const isInStash = locationContext.location === 'stash';
  // Hide rotate in staging context menu since there's already a rotate affordance
  const showRotate = locationContext.canRotate && !isInStash;

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
            label={t('mobile.binMenu.duplicate')}
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

        <STLSearchDropdown
          width={bin.width}
          depth={bin.depth}
          variant="menu-item"
          onClose={onClose}
          needsSplit={needsSplit}
        />

        <ContextMenuDivider />

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
