/**
 * Shape toolbar for adding new cutouts.
 *
 * Rectangle and circle buttons with active state highlighting
 * when in placement mode.
 */

import type { ReactNode } from 'react';
import type { CutoutShape } from '@/features/bin-designer/types';
import type { InteractionMode } from './useCutoutInteraction';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';

/** Styled tooltip wrapper for vertical toolbar buttons */
function ToolbarTooltip({
  label,
  shortcut,
  children,
}: {
  readonly label: string;
  readonly shortcut: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="relative group">
      {children}
      {/* eslint-disable i18next/no-literal-string -- formatting parens around shortcut key */}
      <div className="tooltip hidden group-hover:block absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50">
        {label} ({shortcut})
      </div>
      {/* eslint-enable i18next/no-literal-string */}
    </div>
  );
}

interface CutoutShapeToolbarProps {
  readonly mode: InteractionMode;
  readonly onSelectShape: (mode: InteractionMode) => void;
  readonly snapEnabled: boolean;
  readonly onSnapToggle: (enabled: boolean) => void;
  readonly gridSize: number;
  readonly onGridSizeChange: (size: number) => void;
  /** Render as vertical icon-only strip (for workspace mode) */
  readonly vertical?: boolean;
  /** Callback to trigger SVG file import. When omitted, the button is hidden. */
  readonly onImportSvg?: () => void;
  /** Callback to open the scan-with-phone dialog. When omitted, the button is hidden. */
  readonly onScanWithPhone?: () => void;
}

export function CutoutShapeToolbar({
  mode,
  onSelectShape,
  snapEnabled,
  onSnapToggle,
  gridSize,
  onGridSizeChange,
  vertical = false,
  onImportSvg,
  onScanWithPhone,
}: CutoutShapeToolbarProps) {
  const t = useTranslation();
  // Derive which tool is "active" across all transient interaction states
  const activeShape: CutoutShape | null =
    mode.type === 'placing' || mode.type === 'pending-place' || mode.type === 'drawing'
      ? (mode as { shape: CutoutShape }).shape
      : mode.type === 'path-drawing'
        ? 'path'
        : null;
  const isPointerActive =
    mode.type === 'idle' ||
    mode.type === 'dragging' ||
    mode.type === 'resizing' ||
    mode.type === 'rotating' ||
    mode.type === 'group-rotating' ||
    mode.type === 'group-scaling' ||
    mode.type === 'marquee' ||
    mode.type === 'vertex-editing';
  const isRulerActive = mode.type === 'ruler-ready' || mode.type === 'measuring';

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
    ? 'flex items-center justify-center rounded-md p-2 transition-all duration-100 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60'
    : 'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
  const btnActive = 'bg-accent text-on-accent shadow-sm ring-1 ring-accent/40';
  const btnInactive =
    'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover hover:text-content-primary hover:border-stroke';
  const iconSize = vertical ? 'h-5 w-5' : 'h-3.5 w-3.5';

  /** Conditionally wraps a button in a ToolbarTooltip (vertical mode only) */
  const wrap = (label: string, shortcut: string, btn: ReactNode) =>
    vertical ? (
      <ToolbarTooltip label={label} shortcut={shortcut}>
        {btn}
      </ToolbarTooltip>
    ) : (
      btn
    );

  return (
    <div className={vertical ? 'flex flex-col items-center gap-1' : 'flex items-center gap-2'}>
      {wrap(
        t('binDesigner.cutouts.pointerTool'),
        'V',
        <Button
          type="button"
          variant="ghost"
          touchTarget={false}
          className={`${btnBase} ${isPointerActive ? btnActive : btnInactive}`}
          onClick={() => onSelectShape({ type: 'idle' })}
          aria-label={t('binDesigner.cutouts.pointerTool')}
          title={!vertical ? t('binDesigner.cutouts.pointerTool') : undefined}
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
        </Button>
      )}

      {wrap(
        t('binDesigner.cutouts.addRectangle'),
        'R',
        <Button
          type="button"
          variant="ghost"
          touchTarget={false}
          className={`${btnBase} ${activeShape === 'rectangle' ? btnActive : btnInactive}`}
          onClick={() => handleClick('rectangle')}
          aria-label={t('binDesigner.cutouts.addRectangle')}
          title={!vertical ? t('binDesigner.cutouts.addRectangle') : undefined}
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
        </Button>
      )}

      {/* eslint-disable i18next/no-literal-string -- shortcut key identifiers, not translatable */}
      {wrap(
        t('binDesigner.cutouts.addCircle'),
        'C',
        <Button
          type="button"
          variant="ghost"
          touchTarget={false}
          className={`${btnBase} ${activeShape === 'circle' ? btnActive : btnInactive}`}
          onClick={() => handleClick('circle')}
          aria-label={t('binDesigner.cutouts.addCircle')}
          title={!vertical ? t('binDesigner.cutouts.addCircle') : undefined}
        >
          <svg
            className={iconSize}
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="7" cy="7" r="5.5" />
          </svg>
          {!vertical && t('binDesigner.cutouts.addCircle')}
        </Button>
      )}

      {wrap(
        t('binDesigner.cutouts.addPolygon'),
        'G',
        <Button
          type="button"
          variant="ghost"
          touchTarget={false}
          className={`${btnBase} ${activeShape === 'polygon' ? btnActive : btnInactive}`}
          onClick={() => handleClick('polygon')}
          aria-label={t('binDesigner.cutouts.addPolygon')}
          title={!vertical ? t('binDesigner.cutouts.addPolygon') : undefined}
        >
          <svg
            className={iconSize}
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          >
            {/* Flat-top hexagon */}
            <path d="M3.5 1.5h7L13 7l-2.5 5.5h-7L1 7z" />
          </svg>
          {!vertical && t('binDesigner.cutouts.addPolygon')}
        </Button>
      )}

      {wrap(
        t('binDesigner.cutouts.addSlot'),
        'S',
        <Button
          type="button"
          variant="ghost"
          touchTarget={false}
          className={`${btnBase} ${activeShape === 'slot' ? btnActive : btnInactive}`}
          onClick={() => handleClick('slot')}
          aria-label={t('binDesigner.cutouts.addSlot')}
          title={!vertical ? t('binDesigner.cutouts.addSlot') : undefined}
        >
          <svg
            className={iconSize}
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {/* Stadium / capsule */}
            <rect x="1" y="4" width="12" height="6" rx="3" />
          </svg>
          {!vertical && t('binDesigner.cutouts.addSlot')}
        </Button>
      )}

      {wrap(
        t('binDesigner.cutouts.penTool'),
        'P',
        <Button
          type="button"
          variant="ghost"
          touchTarget={false}
          className={`${btnBase} ${activeShape === 'path' ? btnActive : btnInactive}`}
          onClick={() => handleClick('path')}
          aria-label={t('binDesigner.cutouts.penTool')}
          title={!vertical ? t('binDesigner.cutouts.penTool') : undefined}
        >
          <svg
            className={iconSize}
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* S-curve: top-right to bottom-left with opposing control points */}
            <path d="M12 2 C5 2, 13 12, 2 12" strokeWidth="1.5" />
            {/* Control handles */}
            <line x1="12" y1="2" x2="5" y2="2" strokeWidth="0.7" strokeDasharray="1 1" />
            <line x1="2" y1="12" x2="9" y2="12" strokeWidth="0.7" strokeDasharray="1 1" />
            {/* Anchor points */}
            <rect x="11" y="1" width="2" height="2" fill="currentColor" stroke="none" />
            <rect x="1" y="11" width="2" height="2" fill="currentColor" stroke="none" />
            {/* Control point handles */}
            <circle cx="5" cy="2" r="1" fill="none" strokeWidth="1" />
            <circle cx="9" cy="12" r="1" fill="none" strokeWidth="1" />
          </svg>
          {!vertical && t('binDesigner.cutouts.penTool')}
        </Button>
      )}

      {onImportSvg &&
        wrap(
          t('binDesigner.cutouts.importSvg'),
          'I',
          <Button
            type="button"
            variant="ghost"
            touchTarget={false}
            className={`${btnBase} ${btnInactive}`}
            onClick={onImportSvg}
            aria-label={t('binDesigner.cutouts.importSvg')}
            title={!vertical ? t('binDesigner.cutouts.importSvg') : undefined}
          >
            <svg
              className={iconSize}
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Upload arrow */}
              <path d="M7 10V3" />
              <path d="M4 5.5L7 2.5L10 5.5" />
              {/* File base */}
              <path d="M2 9v2.5a1 1 0 001 1h8a1 1 0 001-1V9" />
            </svg>
            {!vertical && t('binDesigner.cutouts.importSvg')}
          </Button>
        )}

      {onScanWithPhone &&
        wrap(
          t('binDesigner.cutouts.scanImport.title'),
          'K',
          <Button
            type="button"
            variant="ghost"
            touchTarget={false}
            className={`${btnBase} ${btnInactive}`}
            onClick={onScanWithPhone}
            aria-label={t('binDesigner.cutouts.scanImport.title')}
            title={!vertical ? t('binDesigner.cutouts.scanImport.title') : undefined}
          >
            <svg
              className={iconSize}
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Phone body */}
              <rect x="3.5" y="1" width="7" height="12" rx="1.5" />
              {/* Camera lens */}
              <circle cx="7" cy="4" r="0.75" fill="currentColor" stroke="none" />
              {/* Home indicator */}
              <path d="M6 11.25h2" />
            </svg>
            {!vertical && t('binDesigner.cutouts.scanImport.buttonLabel')}
          </Button>
        )}

      <div
        className={
          vertical ? 'w-5 border-t border-stroke-subtle my-0.5' : 'h-4 w-px bg-stroke-subtle'
        }
      />

      {wrap(
        t('binDesigner.cutouts.rulerTool'),
        'M',
        <Button
          type="button"
          variant="ghost"
          touchTarget={false}
          className={`${btnBase} ${isRulerActive ? btnActive : btnInactive}`}
          onClick={() => onSelectShape(isRulerActive ? { type: 'idle' } : { type: 'ruler-ready' })}
          aria-label={t('binDesigner.cutouts.rulerTool')}
          title={!vertical ? t('binDesigner.cutouts.rulerTool') : undefined}
        >
          <svg
            className={iconSize}
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="1.5" y1="7" x2="12.5" y2="7" />
            <line x1="1.5" y1="5" x2="1.5" y2="9" />
            <line x1="12.5" y1="5" x2="12.5" y2="9" />
          </svg>
          {!vertical && t('binDesigner.cutouts.rulerTool')}
        </Button>
      )}
      {/* eslint-enable i18next/no-literal-string */}

      <div
        className={
          vertical ? 'w-5 border-t border-stroke-subtle my-0.5' : 'h-4 w-px bg-stroke-subtle'
        }
      />

      <Button
        type="button"
        variant="ghost"
        touchTarget={false}
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
      </Button>

      {snapEnabled && (
        <Button
          type="button"
          variant="ghost"
          touchTarget={false}
          className={`${btnBase} ${btnInactive}`}
          onClick={handleGridSizeCycle}
          title={`${t('binDesigner.gridSize')}: ${gridSize}mm`}
        >
          <span className={vertical ? 'text-[10px] font-mono' : 'text-xs font-mono'}>
            {gridSize}mm
          </span>
        </Button>
      )}

      {activeShape !== null && !vertical && (
        <span className="text-[11px] text-content-tertiary">
          {activeShape === 'path'
            ? t('binDesigner.cutouts.clickToDrawPath')
            : t('binDesigner.cutouts.dragToDraw')}
        </span>
      )}

      {isRulerActive && !vertical && (
        <span className="text-[11px] text-content-tertiary">
          {t('binDesigner.cutouts.dragToMeasure')}
        </span>
      )}
    </div>
  );
}
