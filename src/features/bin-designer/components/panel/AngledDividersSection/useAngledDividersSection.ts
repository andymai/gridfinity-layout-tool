import { useCallback, useMemo } from 'react';
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
    // Toggle semantics: "off" = clear all overrides; "on" = keep storage as-is
    // (with eligible rows visible at 0/0 for the user to populate). This
    // matches the FeatureToggle pattern used by sibling sections.
    if (hasAnyOverride) clearDividerOverrides();
  }, [hasAnyOverride, clearDividerOverrides]);

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
    },
    handlers: { setOffset, resetRow, toggleEnabled },
    meta: { summary, disabledReason },
    t,
  };
}
