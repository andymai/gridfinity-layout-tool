/**
 * Header bar for the cutout workspace.
 *
 * Shows title, undo/redo, cursor coords on the left.
 * Context-sensitive actions in the center (alignment, distribute, duplicate, delete, etc.).
 * Zoom controls and Done button on the right.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { groupDepth } from '@/features/bin-designer/utils/cutoutHierarchy';
import type { Cutout, GroupOp, ReorderDirection } from '@/features/bin-designer/types';
import { useCutoutSelection, useDesignerStore } from '@/features/bin-designer/store';
import { GroupBreadcrumb } from './GroupBreadcrumb';
import { Button, Checkbox, IconButton, Input } from '@/design-system';
import { useTranslation } from '@/i18n';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog';
import {
  distributeHorizontally,
  distributeVertically,
  centerInBin,
  type CenterAxis,
} from '../panel/CutoutsSection/geometry';
import {
  expandSelectionToGroups,
  toArrangeUnits,
  unitsBounds,
} from '../panel/CutoutsSection/cutoutGroups';
import { autoArrangeCutouts } from '../panel/CutoutsSection/autoArrange';
import { PathfinderControls } from '../panel/CutoutsSection/PathfinderControls';
import { canGroupSelection } from '../panel/CutoutsSection/pathfinderHelpers';
import { TransformControls } from '../panel/CutoutsSection/TransformControls';
import { ArrangeControls } from '../panel/CutoutsSection/ArrangeControls';
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
/**
 * Centering is against the BIN, not against the rest of the selection, so
 * these draw the bin outline where {@link AlignIcon} draws bare edges — the two
 * groups sit side by side in the toolbar. The shape sits off-centre on the axis
 * the action leaves alone, which is the whole distinction between the three.
 */
function CenterInBinIcon({ axis }: { readonly axis: CenterAxis }) {
  const marks = {
    both: { box: { x: 4.5, y: 5.5, w: 5, h: 3 }, vLine: true, hLine: true },
    x: { box: { x: 4.5, y: 7.5, w: 5, h: 3 }, vLine: true, hLine: false },
    y: { box: { x: 7.5, y: 4.5, w: 3, h: 5 }, vLine: false, hLine: true },
  }[axis];
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <rect x="1" y="1" width="12" height="12" rx="1.5" />
      {marks.vLine && <line x1="7" y1="2" x2="7" y2="12" strokeDasharray="2 1" />}
      {marks.hLine && <line x1="2" y1="7" x2="12" y2="7" strokeDasharray="2 1" />}
      <rect x={marks.box.x} y={marks.box.y} width={marks.box.w} height={marks.box.h} />
    </svg>
  );
}

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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        touchTarget={false}
        className="text-label text-content-secondary"
        onClick={() => setOpen(!open)}
        title={t('binDesigner.cutouts.autoArrange')}
      >
        {t('binDesigner.cutouts.autoArrange')}
      </Button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 rounded-lg border border-stroke-subtle bg-surface-elevated p-2 shadow-lg">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-label text-content-tertiary whitespace-nowrap">
                {t('binDesigner.cutouts.gap')}
                <Input
                  type="number"
                  value={gap}
                  onChange={(e) => setGap(Math.max(0, Number(e.target.value)))}
                  min={0}
                  max={20}
                  step={0.5}
                  size="sm"
                  wrapperClassName="w-12"
                />
                mm
              </label>
              <Button
                type="button"
                variant="primary"
                size="sm"
                touchTarget={false}
                className="text-label"
                onClick={() => {
                  onArrange(gap, staggered);
                  setOpen(false);
                }}
              >
                {t('binDesigner.cutouts.autoArrange')}
              </Button>
            </div>
            <Checkbox
              checked={staggered}
              onChange={setStaggered}
              label={t('binDesigner.cutouts.staggered')}
              size="sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
function Separator() {
  return <div className="mx-1 h-4 w-px bg-stroke-subtle" />;
}
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
  readonly onUpdateBatch: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly onRemove: (id: string) => void;
  readonly onDuplicate: (ids: readonly string[]) => void;
  readonly onGroup: (ids: readonly string[], op?: GroupOp) => void;
  readonly onUngroup: (ids: readonly string[]) => void;
  readonly onSetGroupOp: (groupId: string, op: GroupOp) => void;
  readonly onReorder: (ids: readonly string[], direction: ReorderDirection) => void;
  readonly onClearAll: () => void;
  readonly disabled?: boolean;
  readonly onShowHelp?: () => void;
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
  onUpdateBatch,
  onRemove,
  onDuplicate,
  onGroup,
  onUngroup,
  onSetGroupOp,
  onReorder,
  onClearAll,
  disabled = false,
  onShowHelp,
}: WorkspaceHeaderProps) {
  const setCutoutEditorOpen = useDesignerStore((s) => s.setCutoutEditorOpen);
  const t = useTranslation();
  const [clearConfirm, setClearConfirm] = useState(false);

  const handleClearAllClick = useCallback(() => {
    setClearConfirm(true);
  }, []);

  const selectedIds = [...selection];
  const selected = useMemo(() => cutouts.filter((c) => selection.has(c.id)), [cutouts, selection]);
  const hasGroup = selected.some((c) => groupDepth(c) > 0);
  const groupContext = useCutoutSelection((state) => state.groupContext);
  const setGroupContext = useCutoutSelection((state) => state.setGroupContext);
  const groupNames = useDesignerStore((state) => state.params.cutoutGroupNames);
  const canGroup = canGroupSelection(selectedIds, cutouts, groupContext);
  const singleCutout = selection.size === 1 ? (selected[0] ?? null) : null;

  // Arrange operates on whole groups, so a partially-selected group still moves
  // as one body.
  const arrangeTargets = useMemo(
    () => expandSelectionToGroups(cutouts, selected, groupContext),
    [cutouts, selected, groupContext]
  );

  const applyPositions = useCallback(
    (positions: Record<string, { x?: number; y?: number }>) => {
      const updates = new Map<string, Partial<Cutout>>(Object.entries(positions));
      if (updates.size > 0) onUpdateBatch(updates);
    },
    [onUpdateBatch]
  );

  const handleAlign = useCallback(
    (type: AlignType) => {
      const units = toArrangeUnits(arrangeTargets, groupContext);
      const bounds = unitsBounds(units);
      const positions: Record<string, { x?: number; y?: number }> = {};

      for (const unit of units) {
        if (unit.locked) continue;
        const eb = unit.bounds;
        let dx = 0;
        let dy = 0;

        switch (type) {
          case 'left':
            dx = bounds.minX - eb.minX;
            break;
          case 'right':
            dx = bounds.maxX - eb.maxX;
            break;
          case 'top':
            dy = bounds.maxY - eb.maxY;
            break;
          case 'bottom':
            dy = bounds.minY - eb.minY;
            break;
          case 'center-h':
            dx = (bounds.minX + bounds.maxX) / 2 - (eb.minX + eb.maxX) / 2;
            break;
          case 'center-v':
            dy = (bounds.minY + bounds.maxY) / 2 - (eb.minY + eb.maxY) / 2;
            break;
        }

        // A unit already on the line needs no write — emitting one would dirty
        // the design and cost an undo step for nothing.
        if (dx === 0 && dy === 0) continue;

        for (const member of unit.members) {
          positions[member.id] = {
            ...(dx !== 0 ? { x: member.x + dx } : {}),
            ...(dy !== 0 ? { y: member.y + dy } : {}),
          };
        }
      }
      applyPositions(positions);
    },
    [arrangeTargets, groupContext, applyPositions]
  );

  const handleDistributeH = useCallback(() => {
    applyPositions(distributeHorizontally(arrangeTargets, binWidth, groupContext));
  }, [arrangeTargets, binWidth, groupContext, applyPositions]);

  const handleDistributeV = useCallback(() => {
    applyPositions(distributeVertically(arrangeTargets, binDepth, groupContext));
  }, [arrangeTargets, binDepth, groupContext, applyPositions]);

  const handleCenterInBin = useCallback(
    (axis: CenterAxis) => {
      applyPositions(centerInBin(arrangeTargets, binWidth, binDepth, axis, groupContext));
    },
    [arrangeTargets, binWidth, binDepth, groupContext, applyPositions]
  );

  const handleAutoArrange = useCallback(
    (gap: number, staggered: boolean) => {
      applyPositions(
        autoArrangeCutouts(arrangeTargets, { binWidth, binDepth, gap, staggered }, groupContext)
      );
    },
    [arrangeTargets, binWidth, binDepth, groupContext, applyPositions]
  );
  const iconBtn = (
    onClick: () => void,
    title: string,
    icon: React.ReactNode,
    isDisabled = false
  ) => (
    <IconButton
      type="button"
      size="sm"
      touchTarget={false}
      className="text-content-tertiary"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={isDisabled || disabled}
    >
      {icon}
    </IconButton>
  );

  const textBtn = (onClick: () => void, label: string, danger = false, isDisabled = false) => (
    <Button
      type="button"
      variant={danger ? 'danger' : 'ghost'}
      size="sm"
      touchTarget={false}
      className={
        danger
          ? 'text-label text-red-400 bg-transparent hover:bg-red-500/10'
          : 'text-label text-content-secondary'
      }
      onClick={onClick}
      disabled={isDisabled || disabled}
    >
      {label}
    </Button>
  );
  const renderMainRowActions = () => {
    if (selection.size === 0) {
      return (
        <div className="flex items-center gap-0.5">
          {cutouts.length > 0 &&
            textBtn(handleClearAllClick, t('binDesigner.cutouts.clearAll'), true)}
        </div>
      );
    }
    if (selection.size === 1 && singleCutout) {
      return (
        <div className="flex items-center gap-0.5">
          {textBtn(() => onDuplicate(selectedIds), t('common.duplicate'))}
          {textBtn(() => onRemove(singleCutout.id), t('common.delete'), true)}
          {cutouts.length > 1 && <Separator />}
          {cutouts.length > 1 &&
            textBtn(handleClearAllClick, t('binDesigner.cutouts.clearAll'), true)}
        </div>
      );
    }
    return (
      <span className="text-label text-content-tertiary">
        {t('binDesigner.cutoutEditor.selectedCount', { count: selection.size })}
      </span>
    );
  };

  const renderMultiSelectToolbar = () => {
    if (selection.size < 2) return null;
    return (
      <div
        role="toolbar"
        aria-label={t('binDesigner.cutoutEditor.multiSelectToolbar')}
        className="flex items-center gap-0.5 border-t border-stroke-subtle px-3 py-1"
      >
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
        <TransformControls
          selectedIds={selectedIds}
          cutouts={cutouts}
          binWidth={binWidth}
          binDepth={binDepth}
          onUpdateBatch={onUpdateBatch}
          disabled={disabled}
        />
        <Separator />
        <PathfinderControls
          selectedIds={selectedIds}
          cutouts={cutouts}
          onGroup={onGroup}
          onSetGroupOp={onSetGroupOp}
          disabled={disabled}
          compact
        />
        <Separator />
        <ArrangeControls selectedIds={selectedIds} onReorder={onReorder} disabled={disabled} />
        <div className="flex-1" />
        {/* Three icons, not a text button plus two: the row is already at its
            width budget, and the icon group is narrower than the label it
            replaces while matching the align/distribute groups beside it. */}
        {iconBtn(
          () => handleCenterInBin('both'),
          t('binDesigner.cutouts.centerInBin'),
          <CenterInBinIcon axis="both" />
        )}
        {iconBtn(
          () => handleCenterInBin('x'),
          t('binDesigner.cutouts.centerH'),
          <CenterInBinIcon axis="x" />
        )}
        {iconBtn(
          () => handleCenterInBin('y'),
          t('binDesigner.cutouts.centerV'),
          <CenterInBinIcon axis="y" />
        )}
        <AutoArrangePopover onArrange={handleAutoArrange} />
        {textBtn(() => onDuplicate(selectedIds), t('common.duplicate'))}
        {canGroup && textBtn(() => onGroup(selectedIds), t('binDesigner.cutouts.group'))}
        {hasGroup && textBtn(() => onUngroup(selectedIds), t('binDesigner.cutouts.ungroup'))}
        <Separator />
        {textBtn(handleClearAllClick, t('binDesigner.cutouts.clearAll'), true)}
      </div>
    );
  };

  return (
    <div className="flex flex-col border-b border-stroke-subtle bg-surface-secondary">
      <div className="flex h-10 items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-3 flex-shrink-0">
          <span className="text-sm font-medium text-content">
            {t('binDesigner.cutoutEditor.title')}
          </span>

          <GroupBreadcrumb
            cutouts={cutouts}
            groupNames={groupNames}
            context={groupContext}
            onNavigate={setGroupContext}
          />

          <div className="flex items-center gap-0.5">
            <IconButton
              type="button"
              size="sm"
              touchTarget={false}
              className="text-content-secondary"
              onClick={onUndo}
              disabled={!canUndo}
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
            </IconButton>
            <IconButton
              type="button"
              size="sm"
              touchTarget={false}
              className="text-content-secondary"
              onClick={onRedo}
              disabled={!canRedo}
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
            </IconButton>
          </div>

          {cursorWorldPos && (
            <span className="text-micro font-mono text-content-tertiary tabular-nums">
              {`X: ${cursorWorldPos.x.toFixed(1)} \u00a0 Y: ${cursorWorldPos.y.toFixed(1)}`}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center flex-1 min-w-0 mx-3">
          {renderMainRowActions()}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-0.5 rounded border border-stroke-subtle bg-surface-elevated">
            <IconButton
              type="button"
              size="sm"
              touchTarget={false}
              className="text-content-secondary"
              onClick={onZoomOut}
              title={t('binDesigner.cutoutEditor.zoomOut')}
              aria-label={t('binDesigner.cutoutEditor.zoomOut')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </IconButton>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              touchTarget={false}
              className="min-w-[3.5rem] px-1 text-label text-content-secondary tabular-nums"
              onClick={onFitToView}
              title={t('binDesigner.cutoutEditor.fitToView')}
              aria-label={t('binDesigner.cutoutEditor.fitToView')}
            >
              {zoomPercent}%
            </Button>
            <IconButton
              type="button"
              size="sm"
              touchTarget={false}
              className="text-content-secondary"
              onClick={onZoomIn}
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
            </IconButton>
          </div>

          {onShowHelp && (
            <IconButton
              type="button"
              size="sm"
              touchTarget={false}
              className="text-content-tertiary"
              onClick={onShowHelp}
              title={t('binDesigner.cutoutEditor.showHelp')}
              aria-label={t('binDesigner.cutoutEditor.showHelp')}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </IconButton>
          )}

          <Button
            type="button"
            variant="primary"
            size="sm"
            touchTarget={false}
            className="px-4 font-semibold"
            onClick={() => setCutoutEditorOpen(false)}
          >
            {t('binDesigner.cutoutEditor.done')}
          </Button>
        </div>

        <ConfirmDialog
          isOpen={clearConfirm}
          title={t('binDesigner.cutouts.clearAllConfirmTitle')}
          message={t('binDesigner.cutouts.clearAllConfirmMessage', { count: cutouts.length })}
          confirmText={t('binDesigner.cutouts.clearAll')}
          destructive
          onConfirm={onClearAll}
          onCancel={() => setClearConfirm(false)}
        />
      </div>
      {renderMultiSelectToolbar()}
    </div>
  );
}
