/**
 * Assembled-height readout for the designer.
 *
 * Joins three stores: the design being edited, the active layout's baseplate
 * (which decides how much the plate actually lifts the bin), and the user's
 * measured drawer height (which turns the total into a fit answer). The
 * baseplate lives on the layout in `core/`, so reading it here crosses no
 * feature boundary.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { assembledHeight, type AssembledHeight } from '@/shared/printSettings/assembledHeight';

export interface DrawerClearance {
  /** The user's measured internal drawer height, in mm. */
  readonly drawerMm: number;
  /** Drawer height minus assembled height. Negative means it does not fit. */
  readonly slackMm: number;
  readonly fits: boolean;
}

export interface AssembledHeightView {
  readonly breakdown: AssembledHeight;
  /** Whether the per-component bands are shown instead of a single total. */
  readonly expanded: boolean;
  readonly toggleExpanded: () => void;
  /**
   * Fit against the measured drawer, or null when the layout has no tape
   * reading. Deliberately does NOT fall back to `layout.drawer.height`: that
   * value is the measurement floored to whole height units, so comparing
   * against it would report a false overflow on a design that actually fits.
   */
  readonly clearance: DrawerClearance | null;
}

export function useAssembledHeight(): AssembledHeightView {
  const params = useDesignerStore((s) => s.params);

  const { plate, drawerMm } = useLayoutStore(
    useShallow((s) => ({
      // An unconfigured layout still seats bins on a standard plate, so fall
      // back to the defaults rather than dropping the row — "adds 0mm" is the
      // answer users came for.
      plate: s.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
      drawerMm: s.layout.drawer.measuredMm?.height,
    }))
  );

  const expanded = useSettingsStore((s) => s.settings.showAssembledHeightBreakdown);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const toggleExpanded = useCallback(() => {
    updateSetting('showAssembledHeightBreakdown', !expanded);
  }, [updateSetting, expanded]);

  const breakdown = assembledHeight(params, plate);

  const clearance =
    drawerMm === undefined
      ? null
      : {
          drawerMm,
          slackMm: drawerMm - breakdown.totalMm,
          fits: breakdown.totalMm <= drawerMm,
        };

  return { breakdown, expanded, toggleExpanded, clearance };
}
