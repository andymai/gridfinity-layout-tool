/**
 * The bin designer's single-scroll panel: five collapsible groups read down the
 * part the way it is built — Dimensions, then Lid (caps the top), Interior
 * (inside), Base (underneath), Finishing (appearance + output). The sibling
 * BinPanelShell offers the same sections as a compact category rail; a persisted
 * toggle picks between them.
 *
 * Groups own their collapse state so a help deep-link can force the owning group
 * open before the dispatcher scrolls and pulses its target.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SidePanel } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isPartialMask } from '@/shared/utils/cellMask';
import { HELP_JUMP_EVENT_PREFIX, type HelpJumpEventDetail } from '@/shared/help/helpJumpDispatcher';
import { useDesignerStore } from '@/features/bin-designer/store';
import { jumpToDesignerControl } from '@/features/bin-designer/settingsManifest';
import { binHasText } from '@/features/bin-designer/utils/binText';

import { StickyGroupHeader } from '../../panel/StickyGroupHeader';
import { PanelSection } from '../../panel/PanelSection';
import { FeatureGate } from '../../panel/FeatureGate';
import { DependencyHint } from '../../panel/shared';
import { DimensionsSection } from '../../panel/DimensionsSection';
import { OverhangSection } from '../../panel/OverhangSection';
import { ShapeSection } from '../../panel/ShapeSection';
import { WallThicknessSection, WallSurfaceSection } from '../../panel/WallsSection';
import { WallCutoutsSection } from '../../panel/WallCutoutsSection';
import { SplitOptionsSection } from '../../panel/SplitOptionsSection';
import { useSplitOptionsSection } from '../../panel/SplitOptionsSection/useSplitOptionsSection';
import { LidSection } from '../../panel/LidSection';
import { HandleSection } from '../../panel/HandleSection';
import { InteriorSection } from '../../panel/InteriorSection';
import { LabelTabsSection } from '../../panel/LabelTabsSection';
import { ScoopSection } from '../../panel/ScoopSection';
import { KnifeRestSection } from '../../panel/KnifeRestSection';
import { SlideTraySection } from '../../panel/SlideTraySection';
import { BaseSection, FloorPatternSection } from '../../panel/BaseSection';
import { TypeSection } from '../../panel/TypeSection';
import { ColorsSection } from '../../panel/ColorsSection';
import { PhysicalUnitsSection } from '../../panel/PhysicalUnitsSection';
import { SetDefaultFooter } from '../../panel/SetDefaultFooter';
import { modifiedGroups, type PanelGroup } from '../groupModified';
import { GROUP_OF_CONTROL, HELP_SURFACES } from './groupControls';

export interface BinScrollPanelProps {
  /** docked = desktop frame (resizable, collapsible); plain = fill the parent. */
  readonly frame: 'docked' | 'plain';
  /** Pinned at the very top, above the toolbar: the control search bar. */
  readonly searchBar?: ReactNode;
  /** Pinned above the scroll: the view-mode toggle bar. */
  readonly toolbar?: ReactNode;
  /** Scrolls at the top of the list: community card + variant section. */
  readonly header?: ReactNode;
  /** Wraps the editable groups (VariantLock); toolbar/header/dock stay outside. */
  readonly wrapContent?: (node: ReactNode) => ReactNode;
  /** Pinned below the scroll: the user dock. */
  readonly dock?: ReactNode;
}

export function BinScrollPanel({
  frame,
  searchBar,
  toolbar,
  header,
  wrapContent,
  dock,
}: BinScrollPanelProps) {
  const t = useTranslation();
  const modified = useDesignerStore(useShallow((s) => modifiedGroups(s.params)));
  const { showLabelTabs, isCustomShape, hasText } = useDesignerStore(
    useShallow((s) => ({
      showLabelTabs: s.params.style === 'standard',
      isCustomShape: isPartialMask(s.params.cellMask),
      hasText: binHasText(s.params),
    }))
  );
  const { needsSplit } = useSplitOptionsSection();

  const [open, setOpen] = useState<Record<PanelGroup, boolean>>({
    shape: true,
    lid: true,
    interior: true,
    base: true,
    finishing: true,
  });
  const openGroup = useCallback((group: PanelGroup) => {
    setOpen((prev) => (prev[group] ? prev : { ...prev, [group]: true }));
  }, []);
  const setGroup = useCallback(
    (group: PanelGroup, next: boolean) => setOpen((prev) => ({ ...prev, [group]: next })),
    []
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<HelpJumpEventDetail>).detail;
      const group = detail.controlId ? GROUP_OF_CONTROL[detail.controlId] : undefined;
      if (group) openGroup(group);
    };
    for (const surface of HELP_SURFACES) {
      window.addEventListener(`${HELP_JUMP_EVENT_PREFIX}${surface}`, handler);
    }
    return () => {
      for (const surface of HELP_SURFACES) {
        window.removeEventListener(`${HELP_JUMP_EVENT_PREFIX}${surface}`, handler);
      }
    };
  }, [openGroup]);

  const modifiedLabel = t('binDesigner.group.modified');
  const markIf = (isModified: boolean): string | undefined =>
    isModified ? modifiedLabel : undefined;

  const customShapeReason = t('binDesigner.shape.custom.hint');
  const footprintFix = isCustomShape ? (
    <DependencyHint
      reason={customShapeReason}
      actionLabel={t('binDesigner.dependency.editFootprint')}
      onAction={() => jumpToDesignerControl('bd-shape')}
    />
  ) : null;

  const groups = (
    <>
      <StickyGroupHeader
        title={t('binDesigner.group.shape')}
        expanded={open.shape}
        onExpandedChange={(next) => setGroup('shape', next)}
        modifiedLabel={markIf(modified.shape)}
      >
        <div className="divide-y divide-stroke-subtle/50">
          <PanelSection helpTarget="bd-dimensions">
            <DimensionsSection />
          </PanelSection>
          <PanelSection helpTarget="bd-overhang">
            <OverhangSection />
          </PanelSection>
          <PanelSection helpTarget="bd-shape">
            <ShapeSection />
          </PanelSection>
          <PanelSection helpTarget="bd-walls">
            <WallThicknessSection />
          </PanelSection>
          <PanelSection helpTarget="bd-wall-cutouts">
            <WallCutoutsSection />
          </PanelSection>
          {/* Shown only when the bin overflows the bed; no all-clear row when it fits. */}
          {needsSplit && (
            <PanelSection helpTarget="bd-print-fit">
              <SplitOptionsSection />
            </PanelSection>
          )}
        </div>
      </StickyGroupHeader>

      <StickyGroupHeader
        title={t('binDesigner.group.lid')}
        expanded={open.lid}
        onExpandedChange={(next) => setGroup('lid', next)}
        modifiedLabel={markIf(modified.lid)}
      >
        <div className="divide-y divide-stroke-subtle/50">
          <PanelSection helpTarget="bd-lid">
            <LidSection />
          </PanelSection>
          <PanelSection helpTarget="bd-handles">
            <HandleSection />
          </PanelSection>
        </div>
      </StickyGroupHeader>

      <StickyGroupHeader
        title={t('binDesigner.group.interior')}
        expanded={open.interior}
        onExpandedChange={(next) => setGroup('interior', next)}
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
              {footprintFix}
              <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
                <LabelTabsSection />
              </FeatureGate>
            </PanelSection>
          )}
          <PanelSection helpTarget="bd-scoop">
            {footprintFix}
            <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
              <ScoopSection />
            </FeatureGate>
          </PanelSection>
          <PanelSection helpTarget="bd-knife-rest">
            <KnifeRestSection />
          </PanelSection>
          <SlideTraySection />
        </div>
      </StickyGroupHeader>

      <StickyGroupHeader
        title={t('binDesigner.group.base')}
        expanded={open.base}
        onExpandedChange={(next) => setGroup('base', next)}
        modifiedLabel={markIf(modified.base)}
      >
        <div className="divide-y divide-stroke-subtle/50">
          <PanelSection helpTarget="bd-base">
            <BaseSection />
          </PanelSection>
        </div>
      </StickyGroupHeader>

      <StickyGroupHeader
        title={t('binDesigner.group.finishing')}
        expanded={open.finishing}
        onExpandedChange={(next) => setGroup('finishing', next)}
        modifiedLabel={markIf(modified.finishing)}
      >
        <div className="divide-y divide-stroke-subtle/50">
          {hasText && (
            <PanelSection helpTarget="bd-type">
              <TypeSection />
            </PanelSection>
          )}
          <PanelSection helpTarget="bd-colors">
            <ColorsSection />
          </PanelSection>
          <PanelSection helpTarget="bd-wall-style">
            <WallSurfaceSection />
          </PanelSection>
          <PanelSection helpTarget="bd-floor-pattern">
            <FloorPatternSection />
          </PanelSection>
          <PanelSection helpTarget="bd-physical-units">
            <PhysicalUnitsSection />
          </PanelSection>
        </div>
      </StickyGroupHeader>

      <SetDefaultFooter />
    </>
  );

  const column = (
    <div className="flex h-full min-h-0 flex-col">
      {searchBar}
      {toolbar}
      {/* `relative` is the containing block for the `sr-only` (position:absolute)
          toggle inputs the sections render; without it their block is the
          viewport and their static position deep in the list extends the
          document, letting the page scroll into blank space below the panel. */}
      <div className="relative min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {header}
        {wrapContent ? wrapContent(groups) : groups}
      </div>
      {dock}
    </div>
  );

  if (frame === 'plain') return column;

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
      {column}
    </SidePanel.Root>
  );
}
