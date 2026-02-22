/**
 * Header bar for the cutout workspace.
 *
 * Shows title, undo/redo, cursor coords on the left.
 * Context-sensitive actions in the center (alignment, distribute, duplicate, delete, etc.).
 * Zoom controls and Done button on the right.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import {
  computeBounds,
  getEffectiveBounds,
  getEffectiveDepth,
  distributeHorizontally,
  distributeVertically,
  centerInBin,
} from '../panel/CutoutsSection/geometry';
import { autoArrangeCutouts } from '../panel/CutoutsSection/autoArrange';

// ─── Align Icons (14×14 inline SVGs) ──────────────────────────────────────────

type AlignType = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v';

function AlignIcon({ type }: { readonly type: AlignType }) {
  const props = {
    className: 'h-3.5 w-3.5',
    viewBox: '0 0 14 14',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
  } as const;

  switch (type) {
    case 'left':
      return (
        <svg {...props}>
          <line x1="2" y1="1" x2="2" y2="13" />
          <line x1="2" y1="4" x2="10" y2="4" />
          <line x1="2" y1="10" x2="7" y2="10" />
        </svg>
      );
    case 'center-h':
      return (
        <svg {...props}>
          <line x1="7" y1="1" x2="7" y2="13" strokeDasharray="2 1" />
          <line x1="3" y1="4" x2="11" y2="4" />
          <line x1="4" y1="10" x2="10" y2="10" />
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
    case 'center-v':
      return (
        <svg {...props}>
          <line x1="1" y1="7" x2="13" y2="7" strokeDasharray="2 1" />
          <line x1="4" y1="3" x2="4" y2="11" />
          <line x1="10" y1="4" x2="10" y2="10" />
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

// ─── Distribute Icons ─────────────────────────────────────────────────────────

function DistributeHIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <line x1="1" y1="1" x2="1" y2="13" />
      <line x1="7" y1="3" x2="7" y2="11" />
      <line x1="13" y1="1" x2="13" y2="13" />
    </svg>
  );
}

function DistributeVIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <line x1="1" y1="1" x2="13" y2="1" />
      <line x1="3" y1="7" x2="11" y2="7" />
      <line x1="1" y1="13" x2="13" y2="13" />
    </svg>
  );
}

// ─── Auto-Arrange Popover ─────────────────────────────────────────────────────

function AutoArrangePopover({
  onArrange,
}: {
  readonly onArrange: (gap: number, staggered: boolean) => void;
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [gap, setGap] = useState(2);
  const [staggered, setStaggered] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        className="rounded p-1 text-[11px] text-content-secondary hover:bg-surface-hover hover:text-content transition-colors"
        onClick={() => setOpen(!open)}
        title={t('binDesigner.cutouts.autoArrange')}
      >
        {t('binDesigner.cutouts.autoArrange')}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 rounded-lg border border-stroke-subtle bg-surface-elevated p-2 shadow-lg">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] text-content-tertiary whitespace-nowrap">
                {t('binDesigner.cutouts.gap')}
                <input
                  type="number"
                  value={gap}
                  onChange={(e) => setGap(Math.max(0, Number(e.target.value)))}
                  className="w-12 rounded border border-stroke-subtle bg-surface px-1.5 py-0.5 text-xs text-content"
                  min={0}
                  max={20}
                  step={0.5}
                />
                mm
              </label>
              <button
                type="button"
                className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-on-accent hover:bg-accent/90 transition-colors"
                onClick={() => {
                  onArrange(gap, staggered);
                  setOpen(false);
                }}
              >
                {t('binDesigner.cutouts.autoArrange')}
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-content-tertiary cursor-pointer">
              <input
                type="checkbox"
                checked={staggered}
                onChange={(e) => setStaggered(e.target.checked)}
                className="rounded border-stroke-subtle"
              />
              {t('binDesigner.cutouts.staggered')}
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Separator ────────────────────────────────────────────────────────────────

function Separator() {
  return <div className="mx-1 h-4 w-px bg-stroke-subtle" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface WorkspaceHeaderProps {
  readonly zoomPercent: number;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onFitToView: () => void;
  readonly onUndo?: () => void;
  readonly onRedo?: () => void;
  readonly canUndo?: boolean;
  readonly canRedo?: boolean;
  readonly cursorWorldPos?: { readonly x: number; readonly y: number } | null;
  // Context action props
  readonly cutouts: readonly Cutout[];
  readonly selection: ReadonlySet<string>;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onRemove: (id: string) => void;
  readonly onDuplicate: (ids: readonly string[]) => void;
  readonly onGroup: (ids: readonly string[]) => void;
  readonly onUngroup: (ids: readonly string[]) => void;
  readonly onClearAll: () => void;
  readonly disabled?: boolean;
}

export function WorkspaceHeader({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFitToView,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  cursorWorldPos,
  cutouts,
  selection,
  binWidth,
  binDepth,
  onUpdate,
  onRemove,
  onDuplicate,
  onGroup,
  onUngroup,
  onClearAll,
  disabled = false,
}: WorkspaceHeaderProps) {
  const setCutoutEditorOpen = useDesignerStore((s) => s.setCutoutEditorOpen);
  const t = useTranslation();

  const selectedIds = [...selection];
  const selected = useMemo(() => cutouts.filter((c) => selection.has(c.id)), [cutouts, selection]);
  const hasGroup = selected.some((c) => c.groupId !== null);
  const singleCutout = selection.size === 1 ? (selected[0] ?? null) : null;

  // ─── Alignment handlers ──────────────────────────────────────────────

  const handleAlign = useCallback(
    (type: AlignType) => {
      const bounds = computeBounds(selected);
      for (const cutout of selected) {
        const eb = getEffectiveBounds(cutout);
        let newX: number | undefined;
        let newY: number | undefined;

        switch (type) {
          case 'left':
            newX = bounds.minX;
            break;
          case 'right':
            newX = bounds.maxX - (eb.maxX - eb.minX);
            break;
          case 'top':
            newY = bounds.maxY - getEffectiveDepth(cutout);
            break;
          case 'bottom':
            newY = bounds.minY;
            break;
          case 'center-h': {
            const centerX = (bounds.minX + bounds.maxX) / 2;
            newX = centerX - (eb.maxX - eb.minX) / 2;
            break;
          }
          case 'center-v': {
            const centerY = (bounds.minY + bounds.maxY) / 2;
            newY = centerY - getEffectiveDepth(cutout) / 2;
            break;
          }
        }

        onUpdate(cutout.id, {
          ...(newX !== undefined ? { x: newX } : {}),
          ...(newY !== undefined ? { y: newY } : {}),
        });
      }
    },
    [selected, onUpdate]
  );

  const handleDistributeH = useCallback(() => {
    const positions = distributeHorizontally(selected, binWidth);
    for (const [id, pos] of Object.entries(positions)) {
      onUpdate(id, pos);
    }
  }, [selected, binWidth, onUpdate]);

  const handleDistributeV = useCallback(() => {
    const positions = distributeVertically(selected, binDepth);
    for (const [id, pos] of Object.entries(positions)) {
      onUpdate(id, pos);
    }
  }, [selected, binDepth, onUpdate]);

  const handleCenterInBin = useCallback(() => {
    const positions = centerInBin(selected, binWidth, binDepth);
    for (const [id, pos] of Object.entries(positions)) {
      onUpdate(id, pos);
    }
  }, [selected, binWidth, binDepth, onUpdate]);

  const handleAutoArrange = useCallback(
    (gap: number, staggered: boolean) => {
      const positions = autoArrangeCutouts(selected, { binWidth, binDepth, gap, staggered });
      for (const [id, pos] of Object.entries(positions)) {
        onUpdate(id, pos);
      }
    },
    [selected, binWidth, binDepth, onUpdate]
  );

  // ─── Compact icon button helper ──────────────────────────────────────

  const iconBtn = (
    onClick: () => void,
    title: string,
    icon: React.ReactNode,
    isDisabled = false
  ) => (
    <button
      type="button"
      className="rounded p-1 text-content-tertiary hover:bg-surface-hover hover:text-content transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={isDisabled || disabled}
    >
      {icon}
    </button>
  );

  const textBtn = (onClick: () => void, label: string, danger = false, isDisabled = false) => (
    <button
      type="button"
      className={`rounded px-2 py-0.5 text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-content-secondary hover:bg-surface-hover hover:text-content'
      }`}
      onClick={onClick}
      disabled={isDisabled || disabled}
    >
      {label}
    </button>
  );

  // ─── Render context actions ──────────────────────────────────────────

  const renderContextActions = () => {
    // No selection: Clear All + Show All
    if (selection.size === 0) {
      return (
        <div className="flex items-center gap-0.5">
          {cutouts.length > 0 && textBtn(onClearAll, t('binDesigner.cutouts.clearAll'), true)}
        </div>
      );
    }

    // Single selection: Duplicate + Delete
    if (selection.size === 1 && singleCutout) {
      return (
        <div className="flex items-center gap-0.5">
          {textBtn(() => onDuplicate(selectedIds), t('common.duplicate'))}
          {textBtn(() => onRemove(singleCutout.id), t('common.delete'), true)}
          {cutouts.length > 1 && <Separator />}
          {cutouts.length > 1 && textBtn(onClearAll, t('binDesigner.cutouts.clearAll'), true)}
        </div>
      );
    }

    // Multi-selection (2+): alignment row, distribute, center, auto, duplicate, group
    return (
      <div className="flex items-center gap-0.5">
        {/* Alignment icons */}
        {iconBtn(
          () => handleAlign('left'),
          t('binDesigner.cutouts.alignLeft'),
          <AlignIcon type="left" />
        )}
        {iconBtn(
          () => handleAlign('center-h'),
          t('binDesigner.cutouts.alignCenterH'),
          <AlignIcon type="center-h" />
        )}
        {iconBtn(
          () => handleAlign('right'),
          t('binDesigner.cutouts.alignRight'),
          <AlignIcon type="right" />
        )}
        {iconBtn(
          () => handleAlign('top'),
          t('binDesigner.cutouts.alignTop'),
          <AlignIcon type="top" />
        )}
        {iconBtn(
          () => handleAlign('center-v'),
          t('binDesigner.cutouts.alignCenterV'),
          <AlignIcon type="center-v" />
        )}
        {iconBtn(
          () => handleAlign('bottom'),
          t('binDesigner.cutouts.alignBottom'),
          <AlignIcon type="bottom" />
        )}

        <Separator />

        {/* Distribute */}
        {iconBtn(
          handleDistributeH,
          t('binDesigner.cutouts.distributeH'),
          <DistributeHIcon />,
          selectedIds.length < 3
        )}
        {iconBtn(
          handleDistributeV,
          t('binDesigner.cutouts.distributeV'),
          <DistributeVIcon />,
          selectedIds.length < 3
        )}

        <Separator />

        {/* Center, Auto, Duplicate, Group/Ungroup */}
        {textBtn(handleCenterInBin, t('binDesigner.cutouts.centerInBin'))}
        <AutoArrangePopover onArrange={handleAutoArrange} />
        {textBtn(() => onDuplicate(selectedIds), t('common.duplicate'))}
        {hasGroup
          ? textBtn(() => onUngroup(selectedIds), t('binDesigner.cutouts.ungroup'))
          : textBtn(() => onGroup(selectedIds), t('binDesigner.cutouts.combine'))}

        <Separator />
        {textBtn(onClearAll, t('binDesigner.cutouts.clearAll'), true)}
      </div>
    );
  };

  return (
    <div className="flex h-10 items-center justify-between border-b border-stroke-subtle px-3 bg-surface-secondary">
      {/* Left: title, undo/redo, coords */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-sm font-medium text-content">
          {t('binDesigner.cutoutEditor.title')}
        </span>

        {/* Undo/Redo buttons */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="rounded p-1 text-content-secondary hover:text-content disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t('binDesigner.cutoutEditor.undo')}
            aria-label={t('binDesigner.cutoutEditor.undo')}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 9h10.5a5.5 5.5 0 0 1 0 11H12"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="rounded p-1 text-content-secondary hover:text-content disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t('binDesigner.cutoutEditor.redo')}
            aria-label={t('binDesigner.cutoutEditor.redo')}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 14l5-5-5-5" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 9H9.5a5.5 5.5 0 0 0 0 11H12"
              />
            </svg>
          </button>
        </div>

        {/* Cursor coordinate readout */}
        {cursorWorldPos && (
          <span className="text-[10px] font-mono text-content-tertiary tabular-nums">
            {}
            {`X: ${cursorWorldPos.x.toFixed(1)} \u00a0 Y: ${cursorWorldPos.y.toFixed(1)}`}
          </span>
        )}
      </div>

      {/* Center: context-sensitive actions */}
      <div className="flex items-center justify-center flex-1 min-w-0 mx-3 overflow-x-clip">
        {renderContextActions()}
      </div>

      {/* Right: zoom + done */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 rounded border border-stroke-subtle bg-surface-elevated">
          <button
            type="button"
            onClick={onZoomOut}
            className="px-1.5 py-0.5 text-xs text-content-secondary hover:text-content transition-colors"
            title={t('binDesigner.cutoutEditor.zoomOut')}
            aria-label={t('binDesigner.cutoutEditor.zoomOut')}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onFitToView}
            className="min-w-[3.5rem] px-1 py-0.5 text-[11px] font-medium text-content-secondary hover:text-content tabular-nums transition-colors"
            title={t('binDesigner.cutoutEditor.fitToView')}
            aria-label={t('binDesigner.cutoutEditor.fitToView')}
          >
            {zoomPercent}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="px-1.5 py-0.5 text-xs text-content-secondary hover:text-content transition-colors"
            title={t('binDesigner.cutoutEditor.zoomIn')}
            aria-label={t('binDesigner.cutoutEditor.zoomIn')}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        {/* Done button */}
        <button
          type="button"
          onClick={() => setCutoutEditorOpen(false)}
          className="rounded-md px-4 py-1.5 text-xs font-semibold bg-accent text-on-accent hover:bg-accent/90 shadow-sm transition-colors"
        >
          {t('binDesigner.cutoutEditor.done')}
        </button>
      </div>
    </div>
  );
}
