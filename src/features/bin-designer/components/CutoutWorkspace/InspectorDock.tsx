/**
 * Docked properties column for the cutout workspace.
 *
 * Replaces the old free-floating inspector overlay: a fixed column between the
 * 2D canvas and the app's 3D preview, so the panel never covers the shapes
 * being edited. Drag the left edge to resize; collapse to a thin rail to
 * reclaim canvas width. Width + collapsed state persist across sessions.
 *
 * Chrome mirrors the layout planner's RightPanel / bin inspector (scroll-shadow
 * header, shared icon set, ghost icon buttons) for visual consistency.
 */

import { useCallback, useRef, useState } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import type { FitCue } from '../panel/CutoutsSection/cutoutSectionVisibility';
import { InspectorContent, type BoardSettings } from './InspectorContent';
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
  /** Editor-level settings shown when nothing is selected. */
  readonly board?: BoardSettings;
  /** Duplicate the current selection. */
  readonly onDuplicate?: () => void;
  /** Delete the current selection. */
  readonly onDelete?: () => void;
}

const ICON_BTN =
  'flex-shrink-0 rounded-md p-1.5 text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content disabled:pointer-events-none disabled:opacity-40';

function Icon({ paths }: { readonly paths: readonly string[] }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      {paths.map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

export function InspectorDock({ board, onDuplicate, onDelete, ...content }: InspectorDockProps) {
  const t = useTranslation();
  const [width, setWidth] = useState(loadInspectorWidth);
  const [collapsed, setCollapsed] = useState(loadInspectorCollapsed);
  const [isScrolled, setIsScrolled] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const hasSelection = content.selection.size > 0;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveInspectorCollapsed(next);
      return next;
    });
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 0);
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
      document.removeEventListener('pointercancel', handleUp);
      if (dockRef.current) {
        saveInspectorWidth(dockRef.current.getBoundingClientRect().width);
      }
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    // Cancelled gestures (OS interruption, lost capture) must also end the drag,
    // otherwise draggingRef stays true and the dock keeps resizing on later moves.
    document.addEventListener('pointercancel', handleUp);
  }, []);

  if (collapsed) {
    return (
      <aside className="flex w-12 flex-shrink-0 flex-col items-center border-l border-stroke-subtle bg-surface-secondary py-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          className={ICON_BTN}
          aria-expanded={false}
          aria-label={t('binDesigner.cutoutEditor.inspectorExpand')}
          title={t('binDesigner.cutoutEditor.inspectorExpand')}
        >
          <Icon paths={ICON_PATHS.chevronDoubleLeft} />
        </button>
        <span
          className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-content-tertiary"
          style={{ writingMode: 'vertical-rl' }}
        >
          {t('binDesigner.cutoutEditor.inspectorTitle')}
        </span>
      </aside>
    );
  }

  return (
    <aside
      ref={dockRef}
      className="animate-fade-in relative flex flex-shrink-0 flex-col overflow-hidden border-l border-stroke-subtle bg-surface-secondary"
      style={{ width }}
    >
      {/* Left-edge resize handle */}
      <div
        className="group absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize select-none"
        onPointerDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('binDesigner.cutoutEditor.inspectorResize')}
        aria-valuenow={Math.round(width)}
        aria-valuemin={INSPECTOR_MIN_WIDTH}
        aria-valuemax={INSPECTOR_MAX_WIDTH}
      >
        <div className="absolute inset-y-0 left-1 w-px bg-transparent transition-colors group-hover:bg-accent/60" />
      </div>

      {/* Header */}
      <div
        className={`flex flex-shrink-0 flex-col border-b border-stroke-subtle transition-shadow duration-200 ${
          isScrolled ? 'shadow-elevated' : ''
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={ICON_BTN}
            aria-expanded
            aria-label={t('binDesigner.cutoutEditor.inspectorCollapse')}
            title={t('binDesigner.cutoutEditor.inspectorCollapse')}
          >
            <Icon paths={ICON_PATHS.chevronDoubleRight} />
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
            {t('binDesigner.cutoutEditor.inspectorTitle')}
          </span>
          {hasSelection && (
            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                onClick={onDuplicate}
                disabled={!onDuplicate}
                className={ICON_BTN}
                aria-label={t('binDesigner.cutoutEditor.duplicate')}
                title={t('binDesigner.cutoutEditor.duplicate')}
              >
                <Icon paths={ICON_PATHS.duplicate} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={!onDelete}
                className={`${ICON_BTN} hover:text-danger`}
                aria-label={t('binDesigner.cutoutEditor.delete')}
                title={t('binDesigner.cutoutEditor.delete')}
              >
                <Icon paths={ICON_PATHS.trash} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin px-4 pt-0 pb-3"
      >
        <InspectorContent {...content} board={board} />
      </div>
    </aside>
  );
}
