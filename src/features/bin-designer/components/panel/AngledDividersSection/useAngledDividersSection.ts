import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { useLabsStore } from '@/core/store/labs';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import { getEligibleDividers } from '@/features/bin-designer/utils/compartments';
import type { EligibleDivider } from '@/features/bin-designer/utils/compartments';

/** Maximum mm offset surfaced in the panel inputs. The validator allows up
 *  to ±200 mm at the storage layer; the UI clamps to a more reasonable
 *  ±50 mm range that matches typical bin dimensions. */
export const ANGLED_DIVIDER_UI_MAX = 50;
export const ANGLED_DIVIDER_UI_STEP = 0.5;

export interface AngledDividerRow extends EligibleDivider {
  /** Stable 1-based display index for "Divider 1", "Divider 2", etc. */
  readonly displayNumber: number;
}

export function useAngledDividersSection() {
  const { compartments, style, setDividerOverride, removeDividerOverride, clearDividerOverrides } =
    useDesignerStore(
      useShallow((s) => ({
        compartments: s.params.compartments,
        style: s.params.style,
        setDividerOverride: s.setDividerOverride,
        removeDividerOverride: s.removeDividerOverride,
        clearDividerOverrides: s.clearDividerOverrides,
      }))
    );
  const t = useTranslation();
  const flagEnabled = useLabsStore((s) => s.isFeatureEnabled('angled_dividers'));

  const eligible = useMemo(() => getEligibleDividers(compartments), [compartments]);
  const rows: AngledDividerRow[] = useMemo(
    () => eligible.map((d, idx) => ({ ...d, displayNumber: idx + 1 })),
    [eligible]
  );

  const hasAnyOverride = useMemo(
    () => rows.some((r) => r.offsetStart !== 0 || r.offsetEnd !== 0),
    [rows]
  );

  // Section open/closed state. Local — the toggle is UI affordance, not
  // schema. Default: open whenever the user already has at least one
  // override (so reload preserves intent via the data). When the user
  // toggles open with no overrides, the section stays open until they
  // explicitly toggle off (which also clears any overrides they added in
  // the meantime).
  //
  // The previous version of this hook tied `checked` directly to
  // `hasAnyOverride`, which created a catch-22: with no overrides the
  // toggle was off → FeatureToggle hid the controls → user couldn't
  // create the first override.
  // `isOpen` derives from EITHER a manual open OR the data already having
  // overrides — no useEffect needed. When a canvas drag creates the first
  // override, `hasAnyOverride` flips true and `isOpen` becomes true on
  // the next render, no state-sync logic required.
  //
  // Gated on `rows.length > 0` (computed below) so changing the grid mid-
  // session to a layout with no interior dividers visually closes the
  // section instead of showing a checked-but-disabled toggle.
  const [isOpenLocal, setIsOpenLocal] = useState(false);
  const hasEligibleDividers = rows.length > 0;
  const isOpen = hasEligibleDividers && (isOpenLocal || hasAnyOverride);

  const setOffset = useCallback(
    (row: AngledDividerRow, which: 'start' | 'end', value: number) => {
      const clamped = Math.max(-ANGLED_DIVIDER_UI_MAX, Math.min(ANGLED_DIVIDER_UI_MAX, value));
      const nextStart = which === 'start' ? clamped : row.offsetStart;
      const nextEnd = which === 'end' ? clamped : row.offsetEnd;
      // No-op guard before the analytics emit so a noisy keystroke loop
      // (StepperControl can fire on hold-arrow) doesn't saturate PostHog.
      if (nextStart === row.offsetStart && nextEnd === row.offsetEnd) return;
      setDividerOverride(row.compartmentA, row.compartmentB, nextStart, nextEnd);
      trackEvent('divider_offset_changed', {
        axis: row.axis,
        offset_start_mm: nextStart,
        offset_end_mm: nextEnd,
        source: 'panel_input',
      });
    },
    [setDividerOverride]
  );

  const resetRow = useCallback(
    (row: AngledDividerRow) => {
      removeDividerOverride(row.compartmentA, row.compartmentB);
    },
    [removeDividerOverride]
  );

  const toggleEnabled = useCallback(() => {
    // Toggle semantics:
    //   - currently open → close the section AND clear any overrides
    //     (matches user expectation of "feature off")
    //   - currently closed → open the section so eligible rows surface at
    //     0/0 for the user to populate (no data change)
    if (isOpen) {
      setIsOpenLocal(false);
      if (hasAnyOverride) clearDividerOverrides();
    } else {
      setIsOpenLocal(true);
    }
  }, [isOpen, hasAnyOverride, clearDividerOverrides]);

  // `standard` is the only interior style that uses the compartment-grid
  // path. Slotted (divider slots) and solid (cutouts) bypass it entirely
  // and dividerOverrides would have no effect — hide the section so
  // users in those modes don't see a knob that does nothing. Closes the
  // one-directional gap Greptile flagged on #1840 (the reverse direction
  // — slotted-mode-already-set then add an override — was previously
  // unguarded).
  const styleSupportsOverrides = style === 'standard';
  const isUnavailable = !styleSupportsOverrides || !hasEligibleDividers;
  const disabledReason = isUnavailable
    ? styleSupportsOverrides
      ? t('binDesigner.angledDividers.unavailableNoBoundary')
      : t('binDesigner.angledDividers.unavailableNonStandardMode')
    : undefined;

  const summary = useMemo(() => {
    if (isUnavailable) return undefined;
    const tilted = rows.filter((r) => r.offsetStart !== 0 || r.offsetEnd !== 0).length;
    if (tilted === 0) return t('binDesigner.angledDividers.summaryAllStraight');
    return t('binDesigner.angledDividers.summaryTilted', {
      tilted: String(tilted),
      total: String(rows.length),
    });
  }, [isUnavailable, rows, t]);

  return {
    state: {
      flagEnabled,
      isUnavailable,
      rows,
      hasAnyOverride,
      isOpen,
    },
    handlers: { setOffset, resetRow, toggleEnabled },
    meta: { summary, disabledReason },
    t,
  };
}
