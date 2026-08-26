/**
 * Parameter panel for the bin designer.
 *
 * Scrollable container composing collapsible sections for all bin parameters.
 *
 * After Shape, the groups read DOWN the part (the lid caps the top, the
 * interior is inside, the base is underneath), so their order is the one the
 * object has rather than the one the features were added in:
 * - Shape:     Dimensions, Fit, Style, Split Options (conditional), Walls
 * - Lid:       The companion part that caps the bin
 * - Interior:  Interior Dividers, Label Tabs, Finger Scoop
 * - Base:      Body type, stacking lip, mounting, feet, floor
 * - Finishing: Multi-color, Physical Units
 */

import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/design-system';
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
import { DimensionsSection } from '../panel/DimensionsSection';
import { ShapeSection } from '../panel/ShapeSection';
import { InteriorSection } from '../panel/InteriorSection';
import { BaseSection } from '../panel/BaseSection';
import { LabelTabsSection } from '../panel/LabelTabsSection';
import { ScoopSection } from '../panel/ScoopSection';
import { TypeSection } from '../panel/TypeSection';
import { KnifeRestSection } from '../panel/KnifeRestSection';
import { WallsSection } from '../panel/WallsSection';
import { OverhangSection } from '../panel/OverhangSection';
import { LidSection } from '../panel/LidSection';
import { PhysicalUnitsSection } from '../panel/PhysicalUnitsSection';
import { SplitOptionsSection } from '../panel/SplitOptionsSection';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useIntentPrefetch } from '@/shared/hooks/useIntentPrefetch';
import { warmDesignGallery } from '@/shared/hooks/usePrefetchChunks';
import { StickyGroupHeader } from '../panel/StickyGroupHeader';
import { PanelSection } from '../panel/PanelSection';
import { ColorsSection } from '../panel/ColorsSection';
import { FeatureGate } from '../panel/FeatureGate';
import { SetDefaultFooter } from '../panel/SetDefaultFooter';
import { useShapeGroupSummary } from './useShapeGroupSummary';
import { useInteriorGroupSummary } from './useInteriorGroupSummary';
import { useBaseGroupSummary } from './useBaseGroupSummary';
import { useLidGroupSummary } from './useLidGroupSummary';
import { useFinishingGroupSummary } from './useFinishingGroupSummary';
import { modifiedGroups } from './groupModified';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';
import { useCommunityDigestStore } from '@/core/store/communityDigest';
import { useSplitOptionsSection } from '../panel/SplitOptionsSection/useSplitOptionsSection';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { isPartialMask } from '@/shared/utils/cellMask';
import { UserDock } from '@/shared/components/UserDock';
import { AttributionFooter } from '@/shared/components/AttributionFooter';
import { helpJumpEventName } from '@/shared/help/helpJumpDispatcher';
import { ToolRackParameterPanel } from '../panel/ToolRackSection/ToolRackParameterPanel';
import { ImportedMeshPanel } from '../panel/ImportedMeshSection/ImportedMeshPanel';
import { WorkshopPanel } from '../Workshop/WorkshopPanel/WorkshopPanel';

export function ParameterPanel() {
  const itemKind = useDesignerStore((s) => s.itemKind);
  if (itemKind === 'toolRack') return <ToolRackParameterPanel />;
  if (itemKind === 'importedMesh') return <ImportedMeshPanel />;
  if (itemKind === 'assembly') return <WorkshopPanel />;
  return <BinParameterPanel />;
}

function BinParameterPanel() {
  const t = useTranslation();
  const shapeSummary = useShapeGroupSummary();
  const interiorSummary = useInteriorGroupSummary();
  const baseSummary = useBaseGroupSummary();
  const lidSummary = useLidGroupSummary();
  const finishingSummary = useFinishingGroupSummary();
  // A dot on the groups holding an edit, so a collapsed panel still says where
  // the work is. `modifiedLabel` is the accessible name, not a second flag.
  // Selected through `useShallow` over the derived flags rather than
  // subscribing to `params` wholesale: this is the panel ROOT, and an
  // `Object.is` subscription on an immer object re-renders every section on
  // every params write — dragging the scoop slider re-ran the whole tree per
  // frame. The selector still runs per write; the render only happens when a
  // group's flag flips.
  const modified = useDesignerStore(useShallow((s) => modifiedGroups(s.params)));
  const modifiedLabel = t('binDesigner.group.modified');
  const markIf = (isModified: boolean): string | undefined =>
    isModified ? modifiedLabel : undefined;
  const { showLabelTabs, isCustomShape } = useDesignerStore(
    useShallow((s) => ({
      showLabelTabs: s.params.style === 'standard',
      isCustomShape: isPartialMask(s.params.cellMask),
    }))
  );
  const { needsSplit } = useSplitOptionsSection();
  const openExampleGallery = useBinExampleGalleryStore((s) => s.open);
  const hasUnseenDigest = useCommunityDigestStore((s) => s.hasUnseenDeltas);
  const workshopEnabled = useFeatureFlag('workshop');
  const newDesign = useDesignerStore((s) => s.newDesign);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const loadDesignIntoStore = useDesignerStore((s) => s.loadDesign);
  const variant = useVariantContext(currentDesignId);
  const [variantBusy, setVariantBusy] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

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
  const customShapeReason = t('binDesigner.shape.custom.hint');

  // Group expansion state — controlled so help-modal deep-links can force a
  // section open before the dispatcher scrolls and pulses its target.
  const [shapeExpanded, setShapeExpanded] = useState(true);
  const [interiorExpanded, setInteriorExpanded] = useState(true);
  const [baseExpanded, setBaseExpanded] = useState(true);
  const [lidExpanded, setLidExpanded] = useState(true);
  const [finishingExpanded, setFinishingExpanded] = useState(true);

  useEffect(() => {
    const handlers: Record<string, () => void> = {
      [helpJumpEventName('binDesigner:shape')]: () => setShapeExpanded(true),
      [helpJumpEventName('binDesigner:interior')]: () => setInteriorExpanded(true),
      [helpJumpEventName('binDesigner:base')]: () => setBaseExpanded(true),
      [helpJumpEventName('binDesigner:lid')]: () => setLidExpanded(true),
      [helpJumpEventName('binDesigner:finishing')]: () => setFinishingExpanded(true),
    };
    for (const [name, fn] of Object.entries(handlers)) {
      window.addEventListener(name, fn);
    }
    return () => {
      for (const [name, fn] of Object.entries(handlers)) {
        window.removeEventListener(name, fn);
      }
    };
  }, []);

  const galleryIntent = useIntentPrefetch('modal:designGallery', warmDesignGallery);

  return (
    <div className="flex h-full flex-col">
      {/* `relative` makes this the containing block for `sr-only` (position:absolute)
          toggle inputs inside; without it their CB is the ICB, so their static
          position deep in the scroll area extends the document and lets the whole
          page scroll into blank space below the panel. */}
      <div className="relative flex-1 overflow-y-scroll scrollbar-thin">
        {/* Community entry, first in the panel. It is the app's main way into
            the showcase now that the tool switcher holds only the three
            editors, so it opens the gallery on the tab it names rather than on
            whichever tab was last used. Examples sits beside it in that
            modal's tab bar. */}
        <div className="px-4 py-3 border-b border-stroke-subtle">
          <Button
            variant="ghost"
            onClick={() => openExampleGallery('community')}
            {...galleryIntent}
            className="w-full flex items-center gap-3 text-left p-3 rounded-lg bg-gradient-to-r from-accent/10 to-info/10 hover:from-accent/20 hover:to-info/20 border border-accent/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <svg
                className="w-5 h-5 text-accent"
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
            <div className="flex-1 min-w-0">
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
              className="w-4 h-4 text-content-tertiary group-hover:translate-x-0.5 transition-transform"
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

        {/* Every section below is the PARENT's, for a variant. `inert` rather
            than a `disabled` prop on each control: a variant's params is a
            materialized cache that the next propagation rewrites, so an edit
            here would be silently discarded, and one gate is the only version of
            this guard that cannot be forgotten when a section is added.
            Also locked WHILE RESOLVING: the variant relationship is read from
            IndexedDB, and staying editable until that returns leaves exactly the
            window this guard exists to close. */}
        <VariantLock
          locked={variant.isVariant || variant.isLoading}
          parentName={variant.parentName}
          onOpenParent={
            variant.parentId ? () => void openParentDesign(variant.parentId) : undefined
          }
        >
          {/* Shape group */}
          <StickyGroupHeader
            title={t('binDesigner.group.shape')}
            expanded={shapeExpanded}
            onExpandedChange={setShapeExpanded}
            summary={shapeSummary}
            modifiedLabel={markIf(modified.shape)}
          >
            <div className="divide-y divide-stroke-subtle/50">
              <PanelSection helpTarget="bd-dimensions">
                <DimensionsSection />
              </PanelSection>
              <PanelSection helpTarget="bd-overhang">
                {/* Advanced drawer-fit control next to the dimensions; collapsed by
                  default and gated off internally for custom-shape (mask) bins. */}
                <OverhangSection />
              </PanelSection>
              <PanelSection helpTarget="bd-shape">
                <ShapeSection />
              </PanelSection>
              {needsSplit && (
                <PanelSection>
                  {/* Splits work for any footprint — axis-aligned cut planes
                    intersect the polygon naturally. Pieces may be irregular
                    but each has positive volume; tested in the polygon
                    scenario suite. */}
                  <SplitOptionsSection />
                </PanelSection>
              )}
              <PanelSection helpTarget="bd-walls">
                <WallsSection />
              </PanelSection>
            </div>
          </StickyGroupHeader>

          {/* Lid group. The lid is a distinct companion part, so it gets its own
            top-level group rather than being buried under Walls. It sits here,
            between Shape and Interior, because the groups below Shape read down
            the part: the lid caps the top, the interior is inside, the base is
            underneath. */}
          <StickyGroupHeader
            title={t('binDesigner.group.lid')}
            expanded={lidExpanded}
            onExpandedChange={setLidExpanded}
            summary={lidSummary}
            modifiedLabel={markIf(modified.lid)}
          >
            <div className="divide-y divide-stroke-subtle/50">
              <PanelSection helpTarget="bd-lid">
                <LidSection />
              </PanelSection>
            </div>
          </StickyGroupHeader>

          {/* Interior group */}
          <StickyGroupHeader
            title={t('binDesigner.group.interior')}
            expanded={interiorExpanded}
            onExpandedChange={setInteriorExpanded}
            summary={interiorSummary}
            modifiedLabel={markIf(modified.interior)}
          >
            <div className="divide-y divide-stroke-subtle/50">
              <PanelSection helpTarget="bd-interior">
                {/* Per-mode gating lives inside InteriorSection: Solid (cutouts) stays
                  interactive on custom shapes; Standard/Slotted remain gated. */}
                <InteriorSection />
              </PanelSection>
              {showLabelTabs && (
                <PanelSection helpTarget="bd-label-tabs">
                  <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
                    <LabelTabsSection />
                  </FeatureGate>
                </PanelSection>
              )}
              <PanelSection helpTarget="bd-scoop">
                <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
                  <ScoopSection />
                </FeatureGate>
              </PanelSection>
              <PanelSection helpTarget="bd-knife-rest">
                <KnifeRestSection />
              </PanelSection>
            </div>
          </StickyGroupHeader>

          {/* Base group */}
          <StickyGroupHeader
            title={t('binDesigner.group.base')}
            expanded={baseExpanded}
            onExpandedChange={setBaseExpanded}
            summary={baseSummary}
            modifiedLabel={markIf(modified.base)}
          >
            <div className="divide-y divide-stroke-subtle/50">
              <PanelSection helpTarget="bd-base">
                <BaseSection />
              </PanelSection>
            </div>
          </StickyGroupHeader>

          {/* Finishing group: how the part is coloured and what the grid it is
            built against measures. Neither describes the base it used to be
            filed under; both are the last things you set, and physical units
            are rarely touched at all. */}
          <StickyGroupHeader
            title={t('binDesigner.group.finishing')}
            expanded={finishingExpanded}
            onExpandedChange={setFinishingExpanded}
            summary={finishingSummary}
            modifiedLabel={markIf(modified.finishing)}
          >
            <div className="divide-y divide-stroke-subtle/50">
              <PanelSection helpTarget="bd-type">
                <TypeSection />
              </PanelSection>
              <PanelSection helpTarget="bd-colors">
                <ColorsSection />
              </PanelSection>
              <PanelSection helpTarget="bd-physical-units">
                <PhysicalUnitsSection />
              </PanelSection>
            </div>
          </StickyGroupHeader>

          {workshopEnabled && (
            <div className="px-4 py-3 border-b border-stroke-subtle">
              <Button variant="secondary" onClick={() => newDesign('assembly')} className="w-full">
                {t('binDesigner.newWorkshop')}
              </Button>
            </div>
          )}

          {/* Capture the current settings as the default for new bins, right
            where the user has been editing them. */}
          <SetDefaultFooter />
        </VariantLock>

        <AttributionFooter />
      </div>
      <UserDock />
    </div>
  );
}
