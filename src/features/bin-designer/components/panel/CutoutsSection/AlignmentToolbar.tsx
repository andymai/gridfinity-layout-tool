/**
 * Alignment and distribution toolbar for multi-selected cutouts.
 *
 * Shows alignment buttons (left/right/top/bottom/center), distribution,
 * auto-arrange with gap control, and combine (boolean union) actions.
 */

import { useState } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { computeBounds, getEffectiveBounds, getEffectiveDepth } from './geometry';
import { autoArrangeCutouts } from './autoArrange';

interface AlignmentToolbarProps {
  readonly selectedIds: readonly string[];
  readonly cutouts: readonly Cutout[];
  readonly binWidth: number;
  readonly binDepth: number;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onGroup: (ids: readonly string[]) => void;
  readonly onUngroup: (ids: readonly string[]) => void;
  readonly onDuplicate: (ids: readonly string[]) => void;
}

type AlignType = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v';

const ALIGN_ICONS: Record<AlignType, string> = {
  left: '⫷',
  'center-h': '⫿',
  right: '⫸',
  top: '⤒',
  'center-v': '⫾',
  bottom: '⤓',
};

export function AlignmentToolbar({
  selectedIds,
  cutouts,
  binWidth,
  binDepth,
  onUpdate,
  onGroup,
  onUngroup,
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

  const alignButton = (type: AlignType, label: string, icon: string) => (
    <button
      type="button"
      className="rounded p-1.5 text-content-tertiary hover:bg-surface-hover hover:text-content transition-colors"
      onClick={() => handleAlign(type)}
      title={label}
      aria-label={label}
    >
      <span className="text-[10px] leading-none">{icon}</span>
    </button>
  );

  return (
    <div className="space-y-2 rounded border border-stroke-subtle p-2">
      <div className="text-[11px] text-content-tertiary">
        {t('binDesigner.cutouts.nSelected', { count: selectedIds.length })}
      </div>

      {/* Alignment buttons */}
      <div className="flex flex-wrap gap-0.5">
        {alignButton('left', t('binDesigner.cutouts.alignLeft'), ALIGN_ICONS.left)}
        {alignButton('center-h', t('binDesigner.cutouts.alignCenterH'), ALIGN_ICONS['center-h'])}
        {alignButton('right', t('binDesigner.cutouts.alignRight'), ALIGN_ICONS.right)}
        {alignButton('top', t('binDesigner.cutouts.alignTop'), ALIGN_ICONS.top)}
        {alignButton('center-v', t('binDesigner.cutouts.alignCenterV'), ALIGN_ICONS['center-v'])}
        {alignButton('bottom', t('binDesigner.cutouts.alignBottom'), ALIGN_ICONS.bottom)}
      </div>

      {/* Auto-arrange */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors"
          onClick={handleAutoArrange}
        >
          {t('binDesigner.cutouts.autoArrange')}
        </button>
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

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors"
          onClick={() => onDuplicate(selectedIds)}
        >
          {t('binDesigner.cutouts.duplicate')}
        </button>
        {hasGroup ? (
          <button
            type="button"
            className="rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors"
            onClick={() => onUngroup(selectedIds)}
          >
            {t('binDesigner.cutouts.ungroup')}
          </button>
        ) : (
          <button
            type="button"
            className="rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors"
            onClick={() => onGroup(selectedIds)}
          >
            {t('binDesigner.cutouts.combine')}
          </button>
        )}
      </div>
    </div>
  );
}
