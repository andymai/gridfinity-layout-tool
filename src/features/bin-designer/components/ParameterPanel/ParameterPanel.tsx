/**
 * Parameter panel for the bin designer.
 *
 * A persisted view toggle picks the layout: `BinScrollPanel` (the default) lays
 * the sections out as one top-to-bottom scroll of collapsible groups, while
 * `BinPanelShell` puts them behind a task-category rail. Both draw on the same
 * section components and share the community card, variant controls, and dock.
 *
 * The non-bin item kinds keep their own single-page panels inside the same
 * resizable frame.
 */

import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, IconButton, SidePanel, Tooltip } from '@/design-system';
import { isErr, isOk } from '@/core/result';
import { designId as toDesignId } from '@/core/types';
import { useToastStore } from '@/core/store/toast';
import { showErrorToast } from '@/shared/hooks/useResultToast';
import {
  loadDesign,
  updateVariantOverrides,
  detachVariant,
} from '@/features/bin-designer/storage/DesignerStorage';
import { useVariantContext } from '@/features/bin-designer/hooks/useVariantContext';
import { VariantSection } from '../panel/VariantSection';
import { VariantLock } from '../panel/VariantSection/VariantLock';
import { openParentDesign } from '@/features/bin-designer/utils/openParentDesign';
import type { DesignOverrides } from '@/features/bin-designer/types';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useIntentPrefetch } from '@/shared/hooks/useIntentPrefetch';
import { warmDesignGallery } from '@/shared/hooks/usePrefetchChunks';
import { BinPanelShell } from '../BinPanelShell';
import { BinScrollPanel } from './BinScrollPanel';
import { loadViewMode, saveViewMode, type BinPanelViewMode } from './binViewModeStorage';
import { ShapePage } from '../panel/pages/ShapePage';
import { InteriorPage } from '../panel/pages/InteriorPage';
import { FeaturesPage } from '../panel/pages/FeaturesPage';
import { StylePage } from '../panel/pages/StylePage';
import { PrintPage } from '../panel/pages/PrintPage';
import { useShapeGroupSummary } from './useShapeGroupSummary';
import { useInteriorGroupSummary } from './useInteriorGroupSummary';
import { useLidGroupSummary } from './useLidGroupSummary';
import { usePrintSummary } from './usePrintSummary';
import { useStyleSummary } from './useStyleSummary';
import { modifiedCategories } from './categoryModified';
import { useTranslation } from '@/i18n';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DesignerSearchBar } from './DesignerSearchBar/DesignerSearchBar';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';
import { useCommunityDigestStore } from '@/core/store/communityDigest';
import { useSplitOptionsSection } from '../panel/SplitOptionsSection/useSplitOptionsSection';
import { UserDock } from '@/shared/components/UserDock';
import { AttributionFooter } from '@/shared/components/AttributionFooter';
import { ToolRackParameterPanel } from '../panel/ToolRackSection/ToolRackParameterPanel';
import { ImportedMeshPanel } from '../panel/ImportedMeshSection/ImportedMeshPanel';
import { WorkshopPanel } from '../Workshop/WorkshopPanel/WorkshopPanel';

export interface ParameterPanelProps {
  /** docked = desktop frame (resizable, collapsible); plain = fill the parent. */
  readonly frame?: 'docked' | 'plain';
}

export function ParameterPanel({ frame = 'plain' }: ParameterPanelProps) {
  const itemKind = useDesignerStore((s) => s.itemKind);
  if (itemKind === 'toolRack')
    return <SinglePagePanel frame={frame} panel={<ToolRackParameterPanel />} />;
  if (itemKind === 'importedMesh')
    return <SinglePagePanel frame={frame} panel={<ImportedMeshPanel />} />;
  if (itemKind === 'assembly') return <SinglePagePanel frame={frame} panel={<WorkshopPanel />} />;
  return <BinParameterPanel frame={frame} />;
}

/** The non-bin panels inherit the resizable frame without a category rail. */
function SinglePagePanel({
  frame,
  panel,
}: {
  readonly frame: 'docked' | 'plain';
  readonly panel: React.ReactNode;
}) {
  const t = useTranslation();
  if (frame === 'plain') return <>{panel}</>;
  return (
    <SidePanel.Root
      side="left"
      minWidth={280}
      maxWidth={480}
      defaultWidth={320}
      persistKey="gridfinity-designer-panel"
      labels={{
        collapse: t('binDesigner.panel.collapse'),
        expand: t('binDesigner.panel.expand'),
        resize: t('binDesigner.panel.resize'),
      }}
      railTitle={t('binDesigner.panel.railTitle')}
    >
      {panel}
    </SidePanel.Root>
  );
}

function BinParameterPanel({ frame }: { readonly frame: 'docked' | 'plain' }) {
  const t = useTranslation();
  const shapeSummary = useShapeGroupSummary();
  const interiorSummary = useInteriorGroupSummary();
  const lidSummary = useLidGroupSummary();
  const printSummary = usePrintSummary();
  const styleSummary = useStyleSummary();
  // Selected through `useShallow` over derived flags rather than subscribing
  // to `params` wholesale: this is the panel ROOT, and an `Object.is`
  // subscription on an immer object re-renders the whole shell on every params
  // write — dragging a slider re-ran the tree per frame. The selector still
  // runs per write; the render only happens when a flag flips.
  const modified = useDesignerStore(useShallow((s) => modifiedCategories(s.params)));
  const { needsSplit } = useSplitOptionsSection();
  const searchEnabled = useFeatureFlag('designer_settings_search');
  const openExampleGallery = useBinExampleGalleryStore((s) => s.open);
  const hasUnseenDigest = useCommunityDigestStore((s) => s.hasUnseenDeltas);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const loadDesignIntoStore = useDesignerStore((s) => s.loadDesign);
  const variant = useVariantContext(currentDesignId);
  const [variantBusy, setVariantBusy] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const [viewMode, setViewMode] = useState<BinPanelViewMode>(loadViewMode);
  const selectViewMode = useCallback((mode: BinPanelViewMode) => {
    setViewMode(mode);
    saveViewMode(mode);
  }, []);

  // Every variant action rewrites the design's params in storage, so the open
  // design is reloaded from there rather than patched in place: the store would
  // otherwise hold the pre-propagation params and autosave them straight back.
  const reloadOpenDesign = useCallback(
    async (id: string) => {
      const reloaded = await loadDesign(toDesignId(id));
      if (isOk(reloaded)) loadDesignIntoStore(reloaded.value);
      variant.reload();
    },
    [loadDesignIntoStore, variant]
  );

  const handleOverridesChange = useCallback(
    (next: DesignOverrides) => {
      if (!currentDesignId) return;
      setVariantBusy(true);
      void (async () => {
        try {
          const result = await updateVariantOverrides(toDesignId(currentDesignId), next);
          if (isErr(result)) {
            showErrorToast(result.error);
            return;
          }
          await reloadOpenDesign(currentDesignId);
        } finally {
          setVariantBusy(false);
        }
      })();
    },
    [currentDesignId, reloadOpenDesign]
  );

  const handleDetach = useCallback(() => {
    if (!currentDesignId) return;
    setVariantBusy(true);
    void (async () => {
      try {
        const result = await detachVariant(toDesignId(currentDesignId));
        if (isErr(result)) {
          showErrorToast(result.error);
          return;
        }
        addToast(t('binDesigner.variants.detached', { name: result.value.name }), 'info');
        await reloadOpenDesign(currentDesignId);
      } finally {
        setVariantBusy(false);
      }
    })();
  }, [currentDesignId, reloadOpenDesign, addToast, t]);

  // Orphans are dropped only on request: they are kept in case the upstream
  // deletion is undone, and forgetting them is the user's call, not ours.
  const handleClearOrphans = useCallback(() => {
    const live = new Set((variant.parentParams?.cutouts ?? []).map((c) => c.id));
    const cutouts = Object.fromEntries(
      Object.entries(variant.overrides.cutouts ?? {}).filter(([id]) => live.has(id))
    );
    handleOverridesChange({ ...variant.overrides, cutouts });
  }, [variant.parentParams, variant.overrides, handleOverridesChange]);

  const galleryIntent = useIntentPrefetch('modal:designGallery', warmDesignGallery);

  const communityAndVariant = (
    <>
      {/* Community entry, first in the panel. It is the app's main way into
          the showcase now that the tool switcher holds only the three
          editors, so it opens the gallery on the tab it names rather than on
          whichever tab was last used. */}
      <div className="border-b border-stroke-subtle px-4 py-3">
        <Button
          variant="ghost"
          onClick={() => openExampleGallery('community')}
          {...galleryIntent}
          className="group flex w-full items-center gap-3 rounded-lg border border-accent/20 bg-gradient-to-r from-accent/10 to-info/10 p-3 text-left transition-all hover:from-accent/20 hover:to-info/20"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 transition-transform group-hover:scale-105">
            <svg
              className="h-5 w-5 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={ICON_PATHS.community[0]}
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-content">
              {t('binExamples.sidebarEntry')}
              {hasUnseenDigest && (
                <>
                  <span
                    aria-hidden="true"
                    data-testid="community-digest-dot"
                    className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent"
                  />
                  {/* The dot is aria-hidden; without this the news signal is
                      visual-only (GalleryTabBar folds it into the tab label). */}
                  <span className="sr-only">{` ${t('binExamples.gallery.tabs.newBadge')}`}</span>
                </>
              )}
            </div>
            <div className="text-xs text-content-tertiary">{t('binExamples.sidebarHint')}</div>
          </div>
          <svg
            className="h-4 w-4 text-content-tertiary transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>

      {variant.isVariant && variant.parentParams && (
        <VariantSection
          parentName={variant.parentName}
          parentParams={variant.parentParams}
          overrides={variant.overrides}
          orphans={variant.orphans}
          busy={variantBusy}
          onChange={handleOverridesChange}
          onDetach={handleDetach}
          onClearOrphans={handleClearOrphans}
        />
      )}
    </>
  );

  // One view switch, reused by both layouts: the scroll's pinned toolbar and the
  // rail's header.
  const viewModes = [
    { mode: 'scroll' as const, paths: ICON_PATHS.menu, label: t('binDesigner.panel.viewAsScroll') },
    {
      mode: 'rail' as const,
      paths: ICON_PATHS.dashboard,
      label: t('binDesigner.panel.viewAsRail'),
    },
  ];
  const viewSwitch = (
    <div className="flex flex-shrink-0 items-center justify-end px-3 py-1.5">
      <div className="inline-flex items-center gap-0.5 rounded-md border border-stroke-subtle p-0.5">
        {viewModes.map(({ mode, paths, label }) => (
          <Tooltip key={mode} content={label} placement="bottom">
            <IconButton
              variant="ghost"
              size="sm"
              touchTarget={false}
              pressed={viewMode === mode}
              aria-label={label}
              onClick={() => selectViewMode(mode)}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                {paths.map((d) => (
                  <path
                    key={d}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={d}
                  />
                ))}
              </svg>
            </IconButton>
          </Tooltip>
        ))}
      </div>
    </div>
  );

  // Every section edits the PARENT's params for a variant. `inert` via one
  // VariantLock gate rather than a `disabled` prop on each control: a variant's
  // params is a materialized cache the next propagation rewrites, and one gate
  // is the only version of this guard that cannot be forgotten when a section is
  // added. Also locked WHILE RESOLVING — staying editable until the IndexedDB
  // read returns leaves exactly the window the guard closes.
  const wrapEditable = (content: React.ReactNode, fill: boolean) => (
    <VariantLock
      locked={variant.isVariant || variant.isLoading}
      parentName={variant.parentName}
      onOpenParent={variant.parentId ? () => void openParentDesign(variant.parentId) : undefined}
      fill={fill}
    >
      {content}
    </VariantLock>
  );

  const searchBar = searchEnabled ? (
    <DesignerSearchBar viewMode={viewMode} needsSplit={needsSplit} />
  ) : null;

  if (viewMode === 'scroll') {
    return (
      <BinScrollPanel
        frame={frame}
        searchBar={searchBar}
        toolbar={viewSwitch}
        header={communityAndVariant}
        wrapContent={(content) => wrapEditable(content, false)}
        dock={<UserDock />}
      />
    );
  }

  return (
    <BinPanelShell
      frame={frame}
      searchBar={searchBar}
      header={
        <>
          {viewSwitch}
          {/* Scrolls on its own when the variant section runs long — pinned
              above the rail, not part of any page's scroll. */}
          <div className="max-h-[45%] flex-shrink-0 overflow-y-auto scrollbar-thin">
            {communityAndVariant}
          </div>
        </>
      }
      pages={{
        shape: <ShapePage />,
        interior: <InteriorPage />,
        features: <FeaturesPage />,
        style: <StylePage />,
        print: <PrintPage />,
      }}
      pageFooter={<AttributionFooter />}
      wrapPages={(pages) => wrapEditable(pages, true)}
      summaries={{
        shape: shapeSummary,
        interior: interiorSummary,
        features: lidSummary,
        style: styleSummary,
        print: printSummary,
      }}
      modified={modified}
      warnings={{ print: needsSplit }}
      dock={<UserDock />}
    />
  );
}
