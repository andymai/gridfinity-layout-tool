import { useEffect, useRef } from 'react';
import { useLayoutStore, useUIStore, useUndoableAction } from '../../store';
import { useResponsive } from '../../hooks/useResponsive';
import { STAGING_ID } from '../../constants';
import type { Bin } from '../../types';

interface BinContextMenuProps {
  bin: Bin;
  position: { x: number; y: number };
  onClose: () => void;
}

/**
 * Context menu for bin actions on mobile (triggered by long-press).
 */
export function BinContextMenu({ bin, position, onClose }: BinContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const deleteBin = useLayoutStore(state => state.deleteBin);
  const moveBinToStaging = useLayoutStore(state => state.moveBinToStaging);
  const duplicateBin = useLayoutStore(state => state.duplicateBin);
  const setSelectedBins = useUIStore(state => state.setSelectedBins);
  const toggleMobilePanel = useUIStore(state => state.toggleMobilePanel);
  const rightPanelCollapsed = useUIStore(state => state.rightPanelCollapsed);
  const toggleRightPanel = useUIStore(state => state.toggleRightPanel);

  const { execute } = useUndoableAction();
  const { isDesktop } = useResponsive();

  // Close on outside click - use pointerdown for unified mouse/touch handling
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Use timeout to avoid immediate close from the triggering event
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Position adjustment to stay within viewport
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200),
    y: Math.min(position.y, window.innerHeight - 250),
  };

  const handleDelete = () => {
    execute(() => deleteBin(bin.id));
    setSelectedBins([]);
    onClose();
  };

  const handleToStaging = () => {
    execute(() => moveBinToStaging(bin.id));
    onClose();
  };

  const handleDuplicate = () => {
    execute(() => duplicateBin(bin.id));
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

  // On desktop, only show Edit Properties when right panel is collapsed
  const showEditOption = !isDesktop || rightPanelCollapsed;

  const isOnGrid = bin.layerId !== STAGING_ID;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-overlay-light"
        onClick={onClose}
      />

      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 rounded-xl overflow-hidden shadow-xl bg-surface-elevated border border-stroke-subtle"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
          minWidth: '180px',
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b border-stroke-subtle"
        >
          <div className="font-medium text-content">
            {bin.width}×{bin.depth} Bin
          </div>
          {bin.label && (
            <div className="text-sm truncate text-content-tertiary">
              {bin.label}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="py-1">
          {showEditOption && (
            <button
              onClick={handleEdit}
              className="w-full px-4 py-3 flex items-center gap-3 transition-colors text-content hover:bg-surface-hover"
            >
              <svg className="w-5 h-5 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Properties
            </button>
          )}

          <button
            onClick={handleDuplicate}
            className="w-full px-4 py-3 flex items-center gap-3 transition-colors text-content hover:bg-surface-hover"
          >
            <svg className="w-5 h-5 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Duplicate
          </button>

          {isOnGrid && (
            <button
              onClick={handleToStaging}
              className="w-full px-4 py-3 flex items-center gap-3 transition-colors text-content hover:bg-surface-hover"
            >
              <svg className="w-5 h-5 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Move to Stash
            </button>
          )}

          <div className="border-t border-stroke-subtle my-1" />

          <button
            onClick={handleDelete}
            className="w-full px-4 py-3 flex items-center gap-3 transition-colors text-error hover:bg-surface-hover"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
