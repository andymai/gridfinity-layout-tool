/**
 * Docked properties column for the cutout workspace.
 *
 * Replaces the old free-floating inspector overlay: a fixed column between the
 * 2D canvas and the app's 3D preview, so the panel never covers the shapes
 * being edited. Drag the left edge to resize; collapse to a thin rail to
 * reclaim canvas width. Width + collapsed state persist across sessions.
 *
 * Chrome mirrors the main ParameterPanel sidebar (header + scrollable body)
 * for visual consistency with the rest of the designer.
 */

import { useCallback, useRef, useState } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { cn } from '@/design-system/cn';
import type { FitCue } from '../panel/CutoutsSection/cutoutSectionVisibility';
import { InspectorContent } from './InspectorContent';
import {
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
  loadInspectorCollapsed,
  loadInspectorWidth,
  saveInspectorCollapsed,
  saveInspectorWidth,
} from './inspectorDockStorage';

interface InspectorDockProps {
  readonly cutouts: readonly Cutout[];
  readonly selection: ReadonlySet<string>;
  readonly preview: ReadonlyMap<string, Partial<Cutout>>;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly maxCutDepth: number;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onUpdateBatch?: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly disabled?: boolean;
  readonly onFitCue?: (cue: FitCue) => void;
  readonly onFlattenArray?: (id: string) => void;
}

function ChevronRight() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M6 4l4 4-4 4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <path d="M10 4L6 8l4 4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InspectorDock(props: InspectorDockProps) {
  const t = useTranslation();
  const [width, setWidth] = useState(loadInspectorWidth);
  const [collapsed, setCollapsed] = useState(loadInspectorCollapsed);
  const dockRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveInspectorCollapsed(next);
      return next;
    });
  }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const handleMove = (moveEvent: PointerEvent) => {
      if (!draggingRef.current || !dockRef.current) return;
      const rightEdge = dockRef.current.getBoundingClientRect().right;
      const next = Math.max(
        INSPECTOR_MIN_WIDTH,
        Math.min(INSPECTOR_MAX_WIDTH, rightEdge - moveEvent.clientX)
      );
      setWidth(next);
    };

    const handleUp = () => {
      draggingRef.current = false;
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      if (dockRef.current) {
        saveInspectorWidth(dockRef.current.getBoundingClientRect().width);
      }
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, []);

  if (collapsed) {
    return (
      <div className="flex w-9 flex-shrink-0 flex-col items-center border-l border-stroke-subtle bg-surface-secondary">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="mt-2 rounded p-1.5 text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content"
          aria-label={t('binDesigner.cutoutEditor.inspectorExpand')}
          title={t('binDesigner.cutoutEditor.inspectorExpand')}
        >
          <ChevronLeft />
        </button>
        <span
          className="mt-3 text-[10px] uppercase tracking-wide text-content-tertiary"
          style={{ writingMode: 'vertical-rl' }}
        >
          {t('binDesigner.cutoutEditor.inspectorTitle')}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={dockRef}
      className="relative flex flex-shrink-0 flex-col border-l border-stroke-subtle bg-surface-secondary"
      style={{ width }}
    >
      {/* Left-edge resize handle */}
      <div
        className="group absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize select-none"
        onPointerDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('binDesigner.cutoutEditor.inspectorResize')}
      >
        <div className="absolute inset-y-0 left-1 w-px bg-transparent transition-colors group-hover:bg-accent/60" />
      </div>

      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-stroke-subtle px-3 py-2">
        <span className="text-xs font-semibold text-content-secondary">
          {t('binDesigner.cutoutEditor.inspectorTitle')}
        </span>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded p-1 text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content"
          aria-label={t('binDesigner.cutoutEditor.inspectorCollapse')}
          title={t('binDesigner.cutoutEditor.inspectorCollapse')}
        >
          <ChevronRight />
        </button>
      </div>

      {/* Scrollable body */}
      <div className={cn('flex-1 overflow-y-scroll scrollbar-thin px-3 py-3')}>
        <InspectorContent {...props} />
      </div>
    </div>
  );
}
