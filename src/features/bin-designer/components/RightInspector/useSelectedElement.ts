/**
 * Derives the single element currently selected for the right inspector from
 * the three mutually-exclusive store scalars.
 *
 * Selection is validated against *live* params every render, so a selection
 * that became invalid after undo/redo, a grid merge/split (compartment ids
 * renumber — see CLAUDE.md gotcha #6), a mode switch, multi-color disable, or
 * an angled-dividers toggle self-heals: the stale arm is dropped from the union
 * (the underlying scalar may linger harmlessly, matching how `selectedDividerKey`
 * already tolerates stale keys). This is why no eager clear-on-transition wiring
 * is needed elsewhere.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { getEligibleDividers } from '@/features/bin-designer/utils/compartments';
import { computeActiveZones } from '@/features/bin-designer/types/featureColors';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';

export type SelectedElement =
  | { readonly kind: 'divider'; readonly key: string }
  | { readonly kind: 'colorZone'; readonly zone: ColorZone }
  | { readonly kind: 'compartment'; readonly id: number };

export function useSelectedElement(): SelectedElement | null {
  const { selectedDividerKey, selectedColorZone, selectedCompartmentId, params } = useDesignerStore(
    useShallow((s) => ({
      selectedDividerKey: s.ui.selectedDividerKey,
      selectedColorZone: s.ui.selectedColorZone,
      selectedCompartmentId: s.ui.selectedCompartmentId,
      params: s.params,
    }))
  );
  const angledDividersEnabled = useSettingsStore((s) => s.settings.angledDividersEnabled);

  return useMemo<SelectedElement | null>(() => {
    // The setters keep these mutually exclusive (only one non-null at a time);
    // the precedence below is a safe fallback. Each arm is gated on the same
    // precondition that makes it reachable in the UI so it can't outlive it.
    if (selectedDividerKey !== null && angledDividersEnabled) {
      const exists = getEligibleDividers(params.compartments).some(
        (d) => `${d.compartmentA}-${d.compartmentB}` === selectedDividerKey
      );
      if (exists) return { kind: 'divider', key: selectedDividerKey };
    }
    if (selectedColorZone !== null && params.featureColors.enabled) {
      if (computeActiveZones(params).has(selectedColorZone)) {
        return { kind: 'colorZone', zone: selectedColorZone };
      }
    }
    if (
      selectedCompartmentId !== null &&
      params.compartments.cells.includes(selectedCompartmentId)
    ) {
      return { kind: 'compartment', id: selectedCompartmentId };
    }
    return null;
  }, [selectedDividerKey, selectedColorZone, selectedCompartmentId, params, angledDividersEnabled]);
}
