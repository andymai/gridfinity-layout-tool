/**
 * Parameter panel for the standalone baseplate page.
 *
 * Top-to-bottom information hierarchy:
 * 1. Dimensions: sync-with-layout toggle + grid steppers (the unit readout)
 *    + click-to-edit mm summary + spatial padding schematic. Single unified section.
 * 2. Stack for printing (experimental) — placed above Base because enabling it
 *    strips and hides the Base controls below.
 * 3. Base: magnet holes, dovetails (when split), corner radius
 * 4. Physical Units: grid unit, print bed size (rarely changed)
 * 5. Split pieces mini-map (only when baseplate is split across print beds)
 *
 * Each section is its own component reading the stores directly; shared
 * derivations (shape/stack gating) live in `panelState.ts`.
 */

import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useToastStore } from '@/core/store/toast';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { RotateCcwIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { Button, ConfirmDialog } from '@/design-system';
import { UserDock } from '@/shared/components/UserDock';
import { AttributionFooter } from '@/shared/components/AttributionFooter';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { HelpTargetMarker } from '@/shared/help/HelpTargetMarker';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { SplitViewStrip } from './SplitViewStrip';
import { StackPrintSection } from './StackPrintSection';
import { DimensionsSection } from './DimensionsSection';
import { BaseSection } from './BaseSection';
import { PhysicalUnitsSection } from './PhysicalUnitsSection';
import type { SplitOverride, StackPrintParams } from '@/core/types';
import { updateBaseplateParams, useBaseplatePanelDerived } from './panelState';

export function BaseplatePanel() {
  const t = useTranslation();
  const cloudSyncEnabled = useFeatureFlag('cloud_sync');

  const stackPrint = useLayoutStore(
    (state) => (state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS).stackPrint
  );
  const printBedSize = useLayoutStore((state) => state.layout.printBedSize);
  const { effectiveFractionalEdgeX, effectiveFractionalEdgeY, gridUnitMm, gridUnitMmY } =
    useBaseplatePanelDerived();

  const { tiling, hoveredPieceLabel, selectedPieceLabel } = useBaseplatePageStore(
    useShallow((s) => ({
      tiling: s.tiling,
      hoveredPieceLabel: s.hoveredPieceLabel,
      selectedPieceLabel: s.selectedPieceLabel,
    }))
  );
  const setHoveredPieceLabel = useBaseplatePageStore((s) => s.setHoveredPieceLabel);
  const setSelectedPieceLabel = useBaseplatePageStore((s) => s.setSelectedPieceLabel);

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const handleReset = useCallback(() => {
    useLayoutStore.getState().setBaseplateParams({ ...DEFAULT_BASEPLATE_PARAMS });
    useToastStore.getState().addToast(t('toast.baseplateReset'), 'success', 3000);
    setResetConfirmOpen(false);
  }, [t]);

  // Stacking strips connectors functionally (in buildFullParams), not by
  // mutating stored params — so the user's connector settings return intact
  // when stacking is turned off. The connector controls are hidden meanwhile.
  const setStackPrint = useCallback(
    (next: StackPrintParams | undefined) => updateBaseplateParams({ stackPrint: next }),
    []
  );

  // Each seam toggle is its own command, so it is one undo step — matching every
  // other panel control rather than collapsing an editing session into one.
  const setSplitOverride = useCallback(
    (next: SplitOverride | undefined) => updateBaseplateParams({ splitOverride: next }),
    []
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <DimensionsSection />
        <StackPrintSection stackPrint={stackPrint} onChange={setStackPrint} />
        <BaseSection />
        <PhysicalUnitsSection />

        {/* Split pieces mini-map + seam editor. `isCustomSplit` keeps it mounted
            when the user merges their plan back down to a single piece — the
            reset-to-automatic control lives inside it. */}
        {(tiling?.isSplit || tiling?.isCustomSplit) && (
          <SplitViewStrip
            tiling={tiling}
            hoveredPieceLabel={hoveredPieceLabel}
            selectedPieceLabel={selectedPieceLabel}
            onHoverPiece={setHoveredPieceLabel}
            onSelectPiece={setSelectedPieceLabel}
            printBedSize={printBedSize}
            gridUnitMm={gridUnitMm}
            gridUnitMmY={gridUnitMmY}
            fractionalEdgeX={effectiveFractionalEdgeX}
            fractionalEdgeY={effectiveFractionalEdgeY}
            onChangeSplit={setSplitOverride}
          />
        )}

        <HelpTargetMarker id="bp-reset" className="px-3 pt-2">
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            leftIcon={<RotateCcwIcon />}
            onClick={() => setResetConfirmOpen(true)}
          >
            {t('baseplate.reset')}
          </Button>
        </HelpTargetMarker>

        <AttributionFooter />
      </div>
      {cloudSyncEnabled && <UserDock />}
      <ConfirmDialog
        isOpen={resetConfirmOpen}
        title={t('baseplate.resetConfirmTitle')}
        message={t('baseplate.resetConfirmMessage')}
        confirmText={t('baseplate.resetConfirmButton')}
        cancelText={t('common.cancel')}
        destructive
        onConfirm={handleReset}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </div>
  );
}
