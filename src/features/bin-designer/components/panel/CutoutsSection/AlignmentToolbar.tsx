/**
 * Alignment and distribution toolbar for multi-selected cutouts.
 *
 * Shows alignment buttons (left/right/top/bottom/center), distribution,
 * auto-arrange with gap control, and combine (boolean union) actions.
 */

import { useState } from 'react';
import type { Cutout, GroupOp, ReorderDirection } from '@/features/bin-designer/types';
import { Button, IconButton } from '@/design-system';
import { useTranslation } from '@/i18n';
import {
  computeBounds,
  getEffectiveBounds,
  getEffectiveDepth,
  distributeHorizontally,
  distributeVertically,
  centerInBin,
} from './geometry';
import { autoArrangeCutouts } from './autoArrange';
import { PathfinderControls } from './PathfinderControls';
import { TransformControls } from './TransformControls';
import { ArrangeControls } from './ArrangeControls';

interface AlignmentToolbarProps {
  readonly selectedIds: readonly string[];
  readonly cutouts: readonly Cutout[];
  readonly binWidth: number;
  readonly binDepth: number;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onUpdateBatch: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly onGroup: (ids: readonly string[], op?: GroupOp) => void;
  readonly onUngroup: (ids: readonly string[]) => void;
  readonly onSetGroupOp: (groupId: string, op: GroupOp) => void;
  readonly onReorder: (ids: readonly string[], direction: ReorderDirection) => void;
  readonly onDuplicate: (ids: readonly string[]) => void;
}

type AlignType = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v';

const AlignIcon = ({ type }: { type: AlignType }) => {
  switch (type) {
    case 'left':
      return (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="2" y1="1" x2="2" y2="13" />
          <line x1="2" y1="4" x2="10" y2="4" />
          <line x1="2" y1="10" x2="7" y2="10" />
        </svg>
      );
    case 'center-h':
      return (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="7" y1="1" x2="7" y2="13" strokeDasharray="2 1" />
          <line x1="3" y1="4" x2="11" y2="4" />
          <line x1="4" y1="10" x2="10" y2="10" />
        </svg>
      );
    case 'right':
      return (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="12" y1="1" x2="12" y2="13" />
          <line x1="4" y1="4" x2="12" y2="4" />
          <line x1="7" y1="10" x2="12" y2="10" />
        </svg>
      );
    case 'top':
      return (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="1" y1="2" x2="13" y2="2" />
          <line x1="4" y1="2" x2="4" y2="10" />
          <line x1="10" y1="2" x2="10" y2="7" />
        </svg>
      );
    case 'center-v':
      return (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="1" y1="7" x2="13" y2="7" strokeDasharray="2 1" />
          <line x1="4" y1="3" x2="4" y2="11" />
          <line x1="10" y1="4" x2="10" y2="10" />
        </svg>
      );
    case 'bottom':
      return (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="1" y1="12" x2="13" y2="12" />
          <line x1="4" y1="4" x2="4" y2="12" />
          <line x1="10" y1="7" x2="10" y2="12" />
        </svg>
      );
  }
};

export function AlignmentToolbar({
  selectedIds,
  cutouts,
  binWidth,
  binDepth,
  onUpdate,
  onUpdateBatch,
  onGroup,
  onUngroup,
  onSetGroupOp,
  onReorder,
  onDuplicate,
}: AlignmentToolbarProps) {
  const t = useTranslation();
  const [gap, setGap] = useState(2);

  const selected = cutouts.filter((c) => selectedIds.includes(c.id));
  const hasGroup = selected.some((c) => c.groupId !== null);

  const handleAlign = (type: AlignType) => {
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
  };

  const handleAutoArrange = () => {
    const positions = autoArrangeCutouts(selected, { binWidth, binDepth, gap });
    for (const [id, pos] of Object.entries(positions)) {
      onUpdate(id, pos);
    }
  };

  const handleDistributeH = () => {
    const positions = distributeHorizontally(selected, binWidth);
    for (const [id, pos] of Object.entries(positions)) {
      onUpdate(id, pos);
    }
  };

  const handleDistributeV = () => {
    const positions = distributeVertically(selected, binDepth);
    for (const [id, pos] of Object.entries(positions)) {
      onUpdate(id, pos);
    }
  };

  const handleCenterInBin = () => {
    const positions = centerInBin(selected, binWidth, binDepth);
    for (const [id, pos] of Object.entries(positions)) {
      onUpdate(id, pos);
    }
  };

  const alignButton = (type: AlignType, label: string) => (
    <IconButton
      type="button"
      size="sm"
      touchTarget={false}
      className="text-content-tertiary"
      onClick={() => handleAlign(type)}
      title={label}
      aria-label={label}
    >
      <AlignIcon type={type} />
    </IconButton>
  );

  return (
    <div className="space-y-2 rounded border border-stroke-subtle p-2">
      <div className="text-[11px] text-content-tertiary">
        {t('binDesigner.cutouts.nSelected', { count: selectedIds.length })}
      </div>

      {/* Alignment buttons */}
      <div className="flex flex-wrap gap-0.5">
        {alignButton('left', t('binDesigner.cutouts.alignLeft'))}
        {alignButton('center-h', t('binDesigner.cutouts.alignCenterH'))}
        {alignButton('right', t('binDesigner.cutouts.alignRight'))}
        {alignButton('top', t('binDesigner.cutouts.alignTop'))}
        {alignButton('center-v', t('binDesigner.cutouts.alignCenterV'))}
        {alignButton('bottom', t('binDesigner.cutouts.alignBottom'))}
      </div>

      {/* Distribution buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          touchTarget={false}
          className="text-content-secondary"
          leftIcon={
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <line x1="1" y1="1" x2="1" y2="13" />
              <line x1="7" y1="3" x2="7" y2="11" />
              <line x1="13" y1="1" x2="13" y2="13" />
            </svg>
          }
          onClick={handleDistributeH}
          disabled={selectedIds.length < 3}
          title={t('binDesigner.cutouts.distributeH')}
        >
          {t('binDesigner.cutouts.distributeH')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          touchTarget={false}
          className="text-content-secondary"
          leftIcon={
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <line x1="1" y1="1" x2="13" y2="1" />
              <line x1="3" y1="7" x2="11" y2="7" />
              <line x1="1" y1="13" x2="13" y2="13" />
            </svg>
          }
          onClick={handleDistributeV}
          disabled={selectedIds.length < 3}
          title={t('binDesigner.cutouts.distributeV')}
        >
          {t('binDesigner.cutouts.distributeV')}
        </Button>
      </div>

      {/* Auto-arrange */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          touchTarget={false}
          className="text-content-secondary"
          onClick={handleAutoArrange}
        >
          {t('binDesigner.cutouts.autoArrange')}
        </Button>
        <label className="flex items-center gap-1 text-[11px] text-content-tertiary">
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
      </div>

      {/* Pathfinder (Adobe Illustrator-style boolean ops) */}
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-content-tertiary">
          {t('binDesigner.cutouts.pathfinder.title')}
        </div>
        <PathfinderControls
          selectedIds={selectedIds}
          cutouts={cutouts}
          onGroup={onGroup}
          onSetGroupOp={onSetGroupOp}
        />
      </div>

      {/* Transform: flip + rotate */}
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-content-tertiary">
          {t('binDesigner.cutouts.transform.title')}
        </div>
        <TransformControls
          selectedIds={selectedIds}
          cutouts={cutouts}
          binWidth={binWidth}
          binDepth={binDepth}
          onUpdateBatch={onUpdateBatch}
        />
      </div>

      {/* Arrange: z-order */}
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-content-tertiary">
          {t('binDesigner.cutouts.arrange.title')}
        </div>
        <ArrangeControls selectedIds={selectedIds} onReorder={onReorder} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          touchTarget={false}
          className="text-content-secondary"
          onClick={handleCenterInBin}
        >
          {t('binDesigner.cutouts.centerInBin')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          touchTarget={false}
          className="text-content-secondary"
          onClick={() => onDuplicate(selectedIds)}
        >
          {t('common.duplicate')}
        </Button>
        {hasGroup && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            touchTarget={false}
            className="text-content-secondary"
            onClick={() => onUngroup(selectedIds)}
          >
            {t('binDesigner.cutouts.ungroup')}
          </Button>
        )}
      </div>
    </div>
  );
}
