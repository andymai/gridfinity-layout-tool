import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import { getEligibleDividers } from '@/features/bin-designer/utils/compartments';
import type { EligibleDivider } from '@/features/bin-designer/utils/compartments';

/** ±50 mm UI cap (validator allows ±200 mm; this matches typical bin dimensions). */
export const TILT_UI_MAX = 50;
export const TILT_UI_STEP = 0.5;

export interface TiltRow extends EligibleDivider {
  readonly key: string;
  /** True when data is non-mirrored OR the user forced the asymmetric view. */
  readonly showAsymmetric: boolean;
  /** Symmetric magnitude (= offsetStart when mirrored); 0 for asymmetric data. */
  readonly symmetricTilt: number;
}

const rowKey = (a: number, b: number): string => `${a}-${b}`;
const clamp = (n: number): number => Math.max(-TILT_UI_MAX, Math.min(TILT_UI_MAX, n));

export function useDividerTiltSubsection() {
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

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // Decoupled from data so users can edit independent start/end values
  // even when current data happens to be mirrored.
  const [forcedAsymmetricKeys, setForcedAsymmetricKeys] = useState<ReadonlySet<string>>(new Set());

  const rows: readonly TiltRow[] = useMemo(() => {
    return getEligibleDividers(compartments).map((d) => {
      const key = rowKey(d.compartmentA, d.compartmentB);
      const isMirrored = d.offsetStart === -d.offsetEnd;
      return {
        ...d,
        key,
        showAsymmetric: !isMirrored || forcedAsymmetricKeys.has(key),
        symmetricTilt: isMirrored ? d.offsetStart : 0,
      };
    });
  }, [compartments, forcedAsymmetricKeys]);

  const hasAnyOverride = useMemo(
    () => rows.some((r) => r.offsetStart !== 0 || r.offsetEnd !== 0),
    [rows]
  );

  const activeExpandedKey = useMemo(
    () => (rows.some((r) => r.key === expandedKey) ? expandedKey : null),
    [rows, expandedKey]
  );

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  const setAsymmetricMode = useCallback((key: string, on: boolean) => {
    setForcedAsymmetricKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const setSymmetricTilt = useCallback(
    (row: TiltRow, tilt: number) => {
      const clamped = clamp(tilt);
      setAsymmetricMode(row.key, false);
      if (clamped === row.offsetStart && -clamped === row.offsetEnd) return;
      setDividerOverride(row.compartmentA, row.compartmentB, clamped, -clamped);
      trackEvent('divider_offset_changed', {
        axis: row.axis,
        offset_start_mm: clamped,
        offset_end_mm: -clamped,
        source: 'panel_input',
      });
    },
    [setDividerOverride, setAsymmetricMode]
  );

  const setAsymmetricOffset = useCallback(
    (row: TiltRow, which: 'start' | 'end', value: number) => {
      const clamped = clamp(value);
      const nextStart = which === 'start' ? clamped : row.offsetStart;
      const nextEnd = which === 'end' ? clamped : row.offsetEnd;
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
    (row: TiltRow) => {
      removeDividerOverride(row.compartmentA, row.compartmentB);
    },
    [removeDividerOverride]
  );

  const resetAll = useCallback(() => {
    clearDividerOverrides();
  }, [clearDividerOverrides]);

  return {
    compartments,
    rows,
    hasAnyOverride,
    expandedKey: activeExpandedKey,
    handlers: {
      toggleExpanded,
      setAsymmetricMode,
      setSymmetricTilt,
      setAsymmetricOffset,
      resetRow,
      resetAll,
    },
    t,
  };
}
