/**
 * Multi-select transform controls: Flip H/V + Rotate (90°, 180°, numeric).
 *
 * Flips piggy-back on the existing `flipSelectionHorizontal/Vertical`
 * helpers — they already mirror the selection across its collective center.
 *
 * Rotation rotates each cutout around the **selection bounding box's**
 * center (matches Illustrator) and clamps every member's new center to its
 * own rotation-aware AABB so a 90° rotate doesn't push pieces out of the
 * bin interior.
 */

import { useState } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { flipSelectionHorizontal, flipSelectionVertical } from './geometryFlips';
import { buildGroupRotationUpdates } from './pathfinderHelpers';
import { getSegmentClass } from '@/shared/components/segmentedControlClasses';

interface TransformControlsProps {
  readonly selectedIds: readonly string[];
  readonly cutouts: readonly Cutout[];
  readonly binWidth: number;
  readonly binDepth: number;
  readonly onUpdateBatch: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly disabled?: boolean;
}

export function TransformControls({
  selectedIds,
  cutouts,
  binWidth,
  binDepth,
  onUpdateBatch,
  disabled = false,
}: TransformControlsProps) {
  const t = useTranslation();
  const [angle, setAngle] = useState('');
  const selected = cutouts.filter((c) => selectedIds.includes(c.id));
  const allDisabled = disabled || selected.length === 0;

  const applyRotate = (deg: number): void => {
    const updates = buildGroupRotationUpdates(selected, deg, binWidth, binDepth);
    if (updates.size > 0) onUpdateBatch(updates);
  };

  const applyFlip = (axis: 'h' | 'v'): void => {
    const updates =
      axis === 'h' ? flipSelectionHorizontal(selected) : flipSelectionVertical(selected);
    if (updates.size > 0) onUpdateBatch(updates);
  };

  const handleAngleSubmit = (): void => {
    const n = Number(angle);
    if (Number.isFinite(n) && n !== 0) applyRotate(n);
    setAngle('');
  };

  const btn = (onClick: () => void, label: string, content: React.ReactNode) => (
    <Button
      type="button"
      variant="ghost"
      className={getSegmentClass(false, { size: 'icon' })}
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={allDisabled}
    >
      {content}
    </Button>
  );

  return (
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label={t('binDesigner.cutouts.transform.title')}
    >
      {btn(
        () => applyFlip('h'),
        t('binDesigner.cutouts.flipHorizontal'),
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 1v12M3 4l-2 3 2 3M11 4l2 3-2 3" />
        </svg>
      )}
      {btn(
        () => applyFlip('v'),
        t('binDesigner.cutouts.flipVertical'),
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 7h12M4 3L7 1l3 2M4 11l3 2 3-2" />
        </svg>
      )}
      {btn(
        () => applyRotate(90),
        t('binDesigner.cutouts.transform.rotate90'),
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8a4 4 0 1 0 4-4" />
          <path d="M7 1l-2 3 3 1" />
        </svg>
      )}
      {btn(
        () => applyRotate(180),
        t('binDesigner.cutouts.transform.rotate180'),
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 7a5 5 0 1 1 5 5" />
          <path d="M7 13l-2-2 2-2" />
        </svg>
      )}
      <input
        type="number"
        className="w-12 rounded border border-stroke-subtle bg-surface px-1 py-0.5 text-[11px] text-content disabled:opacity-50"
        value={angle}
        min={-359}
        max={359}
        step={1}
        onChange={(e) => setAngle(e.target.value)}
        onBlur={handleAngleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAngleSubmit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        disabled={allDisabled}
        title={t('binDesigner.cutouts.transform.rotateField')}
        aria-label={t('binDesigner.cutouts.transform.rotateField')}
      />
    </div>
  );
}
