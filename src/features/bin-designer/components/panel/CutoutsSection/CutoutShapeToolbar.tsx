/**
 * Shape toolbar for adding new cutouts.
 *
 * Rectangle and circle buttons with active state highlighting
 * when in placement mode.
 */

import type { CutoutShape } from '@/features/bin-designer/types';
import type { InteractionMode } from './useCutoutInteraction';
import { useTranslation } from '@/i18n';

interface CutoutShapeToolbarProps {
  readonly mode: InteractionMode;
  readonly onSelectShape: (mode: InteractionMode) => void;
  readonly snapEnabled: boolean;
  readonly onSnapToggle: (enabled: boolean) => void;
  readonly gridSize: number;
  readonly onGridSizeChange: (size: number) => void;
  /** Render as vertical icon-only strip (for workspace mode) */
  readonly vertical?: boolean;
}

export function CutoutShapeToolbar({
  mode,
  onSelectShape,
  snapEnabled,
  onSnapToggle,
  gridSize,
  onGridSizeChange,
  vertical = false,
}: CutoutShapeToolbarProps) {
  const t = useTranslation();
  const isPlacing = mode.type === 'placing';
  const isIdle = mode.type === 'idle';
  const activeShape = isPlacing ? (mode as { shape: CutoutShape }).shape : null;

  const handleClick = (shape: CutoutShape) => {
    if (activeShape === shape) {
      onSelectShape({ type: 'idle' });
    } else {
      onSelectShape({ type: 'placing', shape });
    }
  };

  const handleGridSizeCycle = () => {
    const sizes = [0.25, 0.5, 1, 2, 5];
    const currentIndex = sizes.indexOf(gridSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    onGridSizeChange(sizes[nextIndex]);
  };

  const btnBase = vertical
    ? 'flex items-center justify-center rounded p-2 transition-colors'
    : 'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors';
  const btnActive = 'bg-accent text-white';
  const btnInactive =
    'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover';
  const iconSize = vertical ? 'h-5 w-5' : 'h-3.5 w-3.5';

  return (
    <div className={vertical ? 'flex flex-col items-center gap-1' : 'flex items-center gap-2'}>
      <button
        type="button"
        className={`${btnBase} ${isIdle ? btnActive : btnInactive}`}
        onClick={() => onSelectShape({ type: 'idle' })}
        title={t('binDesigner.cutouts.pointerTool')}
      >
        <svg
          className={iconSize}
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 1l8 5.5-3.5.5L5 11z" />
        </svg>
        {!vertical && t('binDesigner.cutouts.pointerTool')}
      </button>

      <button
        type="button"
        className={`${btnBase} ${activeShape === 'rectangle' ? btnActive : btnInactive}`}
        onClick={() => handleClick('rectangle')}
        title={t('binDesigner.cutouts.addRectangle')}
      >
        <svg
          className={iconSize}
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="1" y="2" width="12" height="10" rx="1" />
        </svg>
        {!vertical && t('binDesigner.cutouts.addRectangle')}
      </button>

      <button
        type="button"
        className={`${btnBase} ${activeShape === 'circle' ? btnActive : btnInactive}`}
        onClick={() => handleClick('circle')}
        title={t('binDesigner.cutouts.addCircle')}
      >
        <svg
          className={iconSize}
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="7" cy="7" r="6" />
        </svg>
        {!vertical && t('binDesigner.cutouts.addCircle')}
      </button>

      <button
        type="button"
        className={`${btnBase} ${activeShape === 'path' ? btnActive : btnInactive}`}
        onClick={() => handleClick('path')}
        title={t('binDesigner.cutouts.penTool')}
      >
        <svg
          className={iconSize}
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {/* Pen nib */}
          <path d="M10.5 1.5L12.5 3.5 5 11 2 12l1-3z" strokeLinejoin="round" />
          {/* Bezier curve hint */}
          <path d="M2 12Q5 8 8 10" strokeLinecap="round" opacity="0.5" />
        </svg>
        {!vertical && t('binDesigner.cutouts.penTool')}
      </button>

      <div
        className={
          vertical ? 'w-5 border-t border-stroke-subtle my-0.5' : 'h-4 w-px bg-stroke-subtle'
        }
      />

      <button
        type="button"
        className={`${btnBase} ${snapEnabled ? btnActive : btnInactive}`}
        onClick={() => onSnapToggle(!snapEnabled)}
        title={t('binDesigner.cutouts.snapToGrid')}
      >
        <svg
          className={iconSize}
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M1 1h4v4H1zM9 1h4v4H9zM1 9h4v4H1zM9 9h4v4H9z" />
        </svg>
        {!vertical && t('binDesigner.cutouts.snapToGrid')}
      </button>

      {snapEnabled && (
        <button
          type="button"
          className={`${btnBase} ${btnInactive}`}
          onClick={handleGridSizeCycle}
          title={`${t('binDesigner.gridSize')}: ${gridSize}mm`}
        >
          <span className={vertical ? 'text-[10px] font-mono' : 'text-xs font-mono'}>
            {gridSize}mm
          </span>
        </button>
      )}

      {isPlacing && !vertical && (
        <span className="text-[11px] text-content-tertiary">
          {activeShape === 'path'
            ? t('binDesigner.cutouts.clickToDrawPath')
            : t('binDesigner.cutouts.dragToDraw')}
        </span>
      )}
    </div>
  );
}
