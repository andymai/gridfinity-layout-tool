/**
 * Floating selection toolbar for multi-selected bins.
 *
 * Shows alignment buttons, category color dots, and bulk action buttons
 * (rotate, match height, move to layer, move to stash, delete) when 2+
 * bins are selected. Desktop only — visibility controlled by the parent.
 */

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import type { BinId, CategoryId, LayerId, Category, Layer } from '@/core/types';
import type { AlignEdge } from '@/shared/utils/alignBins';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';

interface SelectionToolbarProps {
  readonly selectedBinIds: readonly BinId[];
  readonly onAlign: (edge: AlignEdge) => void;
  readonly onSetCategory: (categoryId: CategoryId) => void;
  readonly onRotateAll: () => void;
  readonly onMatchHeight: () => void;
  readonly onMoveToLayer: (targetLayerId: LayerId) => void;
  readonly onMoveToStash: () => void;
  readonly onDeleteAll: () => void;
  readonly categories: readonly Category[];
  readonly otherLayers: readonly Layer[];
}

const TOOLBAR_OFFSET = 44;
const VIEWPORT_PADDING = 8;
const TOOLBAR_WIDTH_ESTIMATE = 560;

function computePosition(selectedBinIds: readonly BinId[]): { top: number; left: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;

  for (const id of selectedBinIds) {
    const el = document.querySelector(`[data-bin-id="${CSS.escape(id)}"]`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    minX = Math.min(minX, rect.left);
    maxX = Math.max(maxX, rect.right);
    minY = Math.min(minY, rect.top);
  }

  if (minX === Infinity) return null;

  const centerX = (minX + maxX) / 2;
  const halfWidth = TOOLBAR_WIDTH_ESTIMATE / 2;

  return {
    top: Math.max(VIEWPORT_PADDING, minY - TOOLBAR_OFFSET),
    left: Math.max(
      VIEWPORT_PADDING + halfWidth,
      Math.min(centerX, window.innerWidth - VIEWPORT_PADDING - halfWidth)
    ),
  };
}

export function SelectionToolbar({
  selectedBinIds,
  onAlign,
  onSetCategory,
  onRotateAll,
  onMatchHeight,
  onMoveToLayer,
  onMoveToStash,
  onDeleteAll,
  categories,
  otherLayers,
}: SelectionToolbarProps) {
  const t = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const position = computePosition(selectedBinIds);
  if (!position) return null;

  const alignButtons: Array<{ edge: AlignEdge; label: string }> = [
    { edge: 'left', label: t('commandPalette.alignLeft') },
    { edge: 'top', label: t('commandPalette.alignTop') },
    { edge: 'bottom', label: t('commandPalette.alignBottom') },
    { edge: 'right', label: t('commandPalette.alignRight') },
  ];

  return (
    <>
      <div
        className="fixed z-50 flex items-center gap-0.5 rounded-lg border border-stroke-subtle bg-surface-elevated px-1.5 py-1 shadow-lg animate-scale-in"
        style={{
          top: position.top,
          left: position.left,
          transform: 'translateX(-50%)',
        }}
        role="toolbar"
        aria-label={t('selectionToolbar.ariaLabel')}
      >
        {/* Bin count badge */}
        <span className="px-1.5 text-xs font-medium tabular-nums text-content-secondary">
          {selectedBinIds.length}
        </span>

        <Divider />

        {/* Alignment section */}
        {alignButtons.map(({ edge, label }) => (
          <ToolbarButton key={edge} label={label} onClick={() => onAlign(edge)}>
            <AlignIcon edge={edge} />
          </ToolbarButton>
        ))}

        <Divider />

        {/* Category section */}
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="h-4 w-4 rounded-full border border-stroke-subtle transition-transform hover:scale-125"
            style={{ backgroundColor: cat.color }}
            onClick={() => onSetCategory(cat.id)}
            title={t('selectionToolbar.setCategory', { name: cat.name })}
            aria-label={t('selectionToolbar.setCategory', { name: cat.name })}
          />
        ))}

        <Divider />

        {/* Rotate all */}
        <ToolbarButton label={t('selectionToolbar.rotateAll')} onClick={onRotateAll}>
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M11 3a5 5 0 1 0 1.5 4" />
            <path d="M11 1v3h-3" />
          </svg>
        </ToolbarButton>

        {/* Match height */}
        <ToolbarButton label={t('selectionToolbar.matchHeight')} onClick={onMatchHeight}>
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <line x1="3" y1="2" x2="3" y2="12" />
            <line x1="11" y1="2" x2="11" y2="12" />
            <line x1="1" y1="2" x2="5" y2="2" />
            <line x1="9" y1="2" x2="13" y2="2" />
            <line x1="1" y1="12" x2="5" y2="12" />
            <line x1="9" y1="12" x2="13" y2="12" />
          </svg>
        </ToolbarButton>

        {/* Move to layer */}
        {otherLayers.length > 0 && (
          <select
            className="h-6 rounded border border-stroke-subtle bg-surface-secondary px-1 text-[11px] text-content-secondary hover:bg-surface-hover transition-colors cursor-pointer"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onMoveToLayer(e.target.value as LayerId);
                e.target.value = '';
              }
            }}
            title={t('selectionToolbar.moveToLayer')}
            aria-label={t('selectionToolbar.moveToLayer')}
          >
            <option value="" disabled>
              {t('selectionToolbar.moveToLayer')}
            </option>
            {otherLayers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        )}

        {/* Move to stash */}
        <ToolbarButton label={t('selectionToolbar.moveToStash')} onClick={onMoveToStash}>
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="6" width="10" height="6" rx="1" />
            <path d="M7 2v6M5 6l2 2 2-2" />
          </svg>
        </ToolbarButton>

        <Divider />

        {/* Delete */}
        <ToolbarButton
          label={t('selectionToolbar.deleteAll')}
          onClick={() => setShowDeleteConfirm(true)}
          destructive
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <line x1="3" y1="3" x2="11" y2="11" />
            <line x1="11" y1="3" x2="3" y2="11" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('selectionToolbar.deleteConfirmTitle', { count: selectedBinIds.length })}
        message={t('selectionToolbar.deleteConfirmMessage', { count: selectedBinIds.length })}
        confirmText={t('selectionToolbar.deleteConfirmButton')}
        destructive
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDeleteAll();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

function Divider() {
  return <div className="mx-1 h-4 w-px bg-stroke-subtle" />;
}

function ToolbarButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rounded p-1.5 transition-colors ${
        destructive
          ? 'text-error hover:bg-error/10'
          : 'text-content-tertiary hover:bg-surface-hover hover:text-content'
      }`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function AlignIcon({ edge }: { edge: AlignEdge }) {
  const props = {
    className: 'h-3.5 w-3.5',
    viewBox: '0 0 14 14',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
  } as const;

  switch (edge) {
    case 'left':
      return (
        <svg {...props}>
          <line x1="2" y1="1" x2="2" y2="13" />
          <line x1="2" y1="4" x2="10" y2="4" />
          <line x1="2" y1="10" x2="7" y2="10" />
        </svg>
      );
    case 'right':
      return (
        <svg {...props}>
          <line x1="12" y1="1" x2="12" y2="13" />
          <line x1="4" y1="4" x2="12" y2="4" />
          <line x1="7" y1="10" x2="12" y2="10" />
        </svg>
      );
    case 'top':
      return (
        <svg {...props}>
          <line x1="1" y1="2" x2="13" y2="2" />
          <line x1="4" y1="2" x2="4" y2="10" />
          <line x1="10" y1="2" x2="10" y2="7" />
        </svg>
      );
    case 'bottom':
      return (
        <svg {...props}>
          <line x1="1" y1="12" x2="13" y2="12" />
          <line x1="4" y1="4" x2="4" y2="12" />
          <line x1="10" y1="7" x2="10" y2="12" />
        </svg>
      );
  }
}
