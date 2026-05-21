import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { useLabsStore } from '@/core/store/labs';
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
  const { compartments, setDividerOverride, removeDividerOverride, clearDividerOverrides } =
    useDesignerStore(
      useShallow((s) => ({
        compartments: s.params.compartments,
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
  // overrides — no useEffect needed. When a future canvas-drag path
  // creates the first override, `hasAnyOverride` flips true and `isOpen`
  // becomes true on the next render, no state-sync logic required.
  const [isOpenLocal, setIsOpenLocal] = useState(false);
  const isOpen = isOpenLocal || hasAnyOverride;

  const setOffset = useCallback(
    (row: AngledDividerRow, which: 'start' | 'end', value: number) => {
      const clamped = Math.max(-ANGLED_DIVIDER_UI_MAX, Math.min(ANGLED_DIVIDER_UI_MAX, value));
      const nextStart = which === 'start' ? clamped : row.offsetStart;
      const nextEnd = which === 'end' ? clamped : row.offsetEnd;
      setDividerOverride(row.compartmentA, row.compartmentB, nextStart, nextEnd);
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

  const isUnavailable = rows.length === 0;
  const disabledReason = isUnavailable
    ? t('binDesigner.angledDividers.unavailableNoBoundary')
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
