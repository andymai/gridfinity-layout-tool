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

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { IconButton, Tabs } from '@/design-system';
import type { Cutout } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import type { FitCue } from '../panel/CutoutsSection/cutoutSectionVisibility';
import type { GrowTarget } from '../panel/CutoutsSection/growBinToFit';
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
  /** Forwarded to {@link InspectorContent}; see its own doc. */
  readonly throughOnly?: boolean;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onUpdateBatch?: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly disabled?: boolean;
  readonly onFitCue?: (cue: FitCue) => void;
  readonly onFlattenArray?: (id: string) => void;
  readonly onFlattenGroupArray?: (id: string) => void;
  /** Count of cutouts stranded past the board after a resize (0 = none). */
  readonly offBoardCount?: number;
  /** Clamp every off-board cutout back inside the board. */
  readonly onClampOffBoard?: () => void;
  /** Center every off-board cutout as one block. */
  readonly onCenterOffBoard?: () => void;
  /** Count of cutouts the generator will cut shallower than requested. */
  readonly depthShortfallCount?: number;
  /** Bin size that would fit every stray, or `null` when growing can't clear it. */
  readonly growTarget?: GrowTarget | null;
  /** Resize the bin to {@link growTarget}. */
  readonly onGrowToFit?: () => void;
  /**
   * Fires when the dock is collapsed or expanded. The canvas uses it to move
   * the repeat suggestion onto a floating chip, so collapsing the dock never
   * silently hides the offer.
   */
  readonly onCollapsedChange?: (collapsed: boolean) => void;
  /** Editor-level settings shown when nothing is selected. */
  readonly board?: BoardSettings;
  /** Duplicate the current selection. */
  readonly onDuplicate?: () => void;
  /** Delete the current selection. */
  readonly onDelete?: () => void;
  /** Shape-list tab. Omitted in contexts without one. */
  readonly shapeList?: ReactNode;
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

type DockTab = 'properties' | 'shapes';

/** Tab ids (not user-facing copy — labels come from these i18n keys). */
const DOCK_TABS: readonly { readonly id: DockTab; readonly labelKey: string }[] = [
  { id: 'properties', labelKey: 'binDesigner.shapeList.tabProperties' },
  { id: 'shapes', labelKey: 'binDesigner.shapeList.tabShapes' },
];

export function InspectorDock({
  board,
  onDuplicate,
  onDelete,
  shapeList,
  onCollapsedChange,
  ...content
}: InspectorDockProps) {
  const t = useTranslation();
  const [width, setWidth] = useState(loadInspectorWidth);
  const [collapsed, setCollapsed] = useState(loadInspectorCollapsed);
  const [isScrolled, setIsScrolled] = useState(false);
  const [tab, setTab] = useState<DockTab>('properties');
  const dockRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const hasSelection = content.selection.size > 0;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveInspectorCollapsed(next);
      onCollapsedChange?.(next);
      return next;
    });
  }, [onCollapsedChange]);

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
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={toggleCollapsed}
          className={ICON_BTN}
          aria-expanded={false}
          aria-label={t('binDesigner.cutoutEditor.inspectorExpand')}
          title={t('binDesigner.cutoutEditor.inspectorExpand')}
        >
          <Icon paths={ICON_PATHS.chevronDoubleLeft} />
        </IconButton>
        <span
          className="mt-3 text-micro font-semibold uppercase tracking-wider text-content-tertiary"
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
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={toggleCollapsed}
            className={ICON_BTN}
            aria-expanded
            aria-label={t('binDesigner.cutoutEditor.inspectorCollapse')}
            title={t('binDesigner.cutoutEditor.inspectorCollapse')}
          >
            <Icon paths={ICON_PATHS.chevronDoubleRight} />
          </IconButton>
          <span className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
            {t('binDesigner.cutoutEditor.inspectorTitle')}
          </span>
          {hasSelection && (
            <div className="ml-auto flex items-center gap-0.5">
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                touchTarget={false}
                onClick={onDuplicate}
                disabled={!onDuplicate}
                className={ICON_BTN}
                aria-label={t('binDesigner.cutoutEditor.duplicate')}
                title={t('binDesigner.cutoutEditor.duplicate')}
              >
                <Icon paths={ICON_PATHS.duplicate} />
              </IconButton>
              <IconButton
                type="button"
                variant="dangerGhost"
                size="sm"
                touchTarget={false}
                onClick={onDelete}
                disabled={!onDelete}
                className={`${ICON_BTN} hover:bg-error-muted hover:text-error`}
                aria-label={t('binDesigner.cutoutEditor.delete')}
                title={t('binDesigner.cutoutEditor.delete')}
              >
                <Icon paths={ICON_PATHS.trash} />
              </IconButton>
            </div>
          )}
        </div>
      </div>

      {/* Body. With a shape list present the dock becomes tabbed; the design
          system's Tabs owns the full ARIA pattern (tab/panel ids, roving
          tabIndex, arrow-key navigation) so this doesn't hand-roll a partial
          one. */}
      {shapeList ? (
        <Tabs.Root>
          <div className="flex-shrink-0 border-b border-stroke-subtle px-2 pb-1">
            <Tabs.List
              tabs={DOCK_TABS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
              activeTab={tab}
              onChange={setTab}
              aria-label={t('binDesigner.cutoutEditor.inspectorTitle')}
            />
          </div>
          <div
            onScroll={handleScroll}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin pt-0 pb-3"
          >
            <Tabs.Panel tabId="properties" activeTab={tab} keepMounted>
              <div className="px-4">
                <InspectorContent {...content} board={board} />
              </div>
            </Tabs.Panel>
            {/* keepMounted so expanded/collapsed groups survive tab switches. */}
            <Tabs.Panel tabId="shapes" activeTab={tab} keepMounted>
              {shapeList}
            </Tabs.Panel>
          </div>
        </Tabs.Root>
      ) : (
        <div
          onScroll={handleScroll}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin px-4 pt-0 pb-3"
        >
          <InspectorContent {...content} board={board} />
        </div>
      )}
    </aside>
  );
}
