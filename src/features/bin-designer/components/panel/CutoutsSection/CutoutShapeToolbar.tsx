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
}

export function CutoutShapeToolbar({
  mode,
  onSelectShape,
  snapEnabled,
  onSnapToggle,
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

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
          isIdle
            ? 'bg-accent text-white'
            : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
        }`}
        onClick={() => onSelectShape({ type: 'idle' })}
        title={t('binDesigner.cutouts.pointerTool')}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 1l8 5.5-3.5.5L5 11z" />
        </svg>
        {t('binDesigner.cutouts.pointerTool')}
      </button>

      <button
        type="button"
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
          activeShape === 'rectangle'
            ? 'bg-accent text-white'
            : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
        }`}
        onClick={() => handleClick('rectangle')}
        title={t('binDesigner.cutouts.addRectangle')}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="1" y="2" width="12" height="10" rx="1" />
        </svg>
        {t('binDesigner.cutouts.addRectangle')}
      </button>

      <button
        type="button"
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
          activeShape === 'circle'
            ? 'bg-accent text-white'
            : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
        }`}
        onClick={() => handleClick('circle')}
        title={t('binDesigner.cutouts.addCircle')}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="7" cy="7" r="6" />
        </svg>
        {t('binDesigner.cutouts.addCircle')}
      </button>

      <div className="h-4 w-px bg-stroke-subtle" />

      <button
        type="button"
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
          snapEnabled
            ? 'bg-accent text-white'
            : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
        }`}
        onClick={() => onSnapToggle(!snapEnabled)}
        title={t('binDesigner.cutouts.snapToGrid')}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M1 1h4v4H1zM9 1h4v4H9zM1 9h4v4H1zM9 9h4v4H9z" />
        </svg>
        {t('binDesigner.cutouts.snapToGrid')}
      </button>

      {isPlacing && (
        <span className="text-[11px] text-content-tertiary">
          {t('binDesigner.cutouts.dragToDraw')}
        </span>
      )}
    </div>
  );
}
