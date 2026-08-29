/**
 * Docked properties column for the cutout workspace.
 *
 * Replaces the old free-floating inspector overlay: a fixed column between the
 * 2D canvas and the app's 3D preview, so the panel never covers the shapes
 * being edited. Frame behavior (drag/keyboard resize, collapse-to-rail,
 * persisted width + collapsed state) comes from the design system's SidePanel;
 * the persistKey below reproduces this dock's original storage keys, so saved
 * layouts survive the migration.
 */

import { useState, type ReactNode } from 'react';
import { IconButton, SidePanel, Tabs } from '@/design-system';
import type { Cutout } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import type { FitCue } from '../panel/CutoutsSection/cutoutSectionVisibility';
import type { GrowTarget } from '../panel/CutoutsSection/growBinToFit';
import { InspectorContent, type BoardSettings } from './InspectorContent';
import { INSPECTOR_MAX_WIDTH, INSPECTOR_MIN_WIDTH } from './inspectorDockStorage';

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
  const [tab, setTab] = useState<DockTab>('properties');
  const hasSelection = content.selection.size > 0;

  return (
    <SidePanel.Root
      side="right"
      minWidth={INSPECTOR_MIN_WIDTH}
      maxWidth={INSPECTOR_MAX_WIDTH}
      persistKey="gridfinity-cutout-inspector"
      labels={{
        collapse: t('binDesigner.cutoutEditor.inspectorCollapse'),
        expand: t('binDesigner.cutoutEditor.inspectorExpand'),
        resize: t('binDesigner.cutoutEditor.inspectorResize'),
      }}
      railTitle={t('binDesigner.cutoutEditor.inspectorTitle')}
      onCollapsedChange={onCollapsedChange}
      className="animate-fade-in"
    >
      <SidePanel.Header>
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
      </SidePanel.Header>

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
          <SidePanel.Body className="pt-0 pb-3">
            <Tabs.Panel tabId="properties" activeTab={tab} keepMounted>
              <div className="px-4">
                <InspectorContent {...content} board={board} />
              </div>
            </Tabs.Panel>
            {/* keepMounted so expanded/collapsed groups survive tab switches. */}
            <Tabs.Panel tabId="shapes" activeTab={tab} keepMounted>
              {shapeList}
            </Tabs.Panel>
          </SidePanel.Body>
        </Tabs.Root>
      ) : (
        <SidePanel.Body className="px-4 pt-0 pb-3">
          <InspectorContent {...content} board={board} />
        </SidePanel.Body>
      )}
    </SidePanel.Root>
  );
}
