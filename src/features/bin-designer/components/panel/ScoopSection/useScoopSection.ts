import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { GRIDFINITY, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import {
  resolveScoopProfile,
  computeLipOffset,
  computeInteriorHeight,
} from '@/shared/utils/scoopCalculations';
import type { ScoopStyle } from '@/shared/types/bin';
import { getFeatureStatus } from '@/shared/constraints';

const DEFAULT_MANUAL_RADIUS = 10;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function useScoopSection() {
  const { scoop, updateScoop, params } = useDesignerStore(
    useShallow((s) => ({
      scoop: s.params.scoop,
      updateScoop: s.updateScoop,
      params: s.params,
    }))
  );
  const t = useTranslation();

  const scoopStatus = getFeatureStatus(params, 'scoop');
  const isUnavailable = !scoopStatus.available;
  const isAutoRadius = scoop.radius === 'auto';
  const style: ScoopStyle = scoop.style ?? 'curved';
  const manualHeight = typeof scoop.radius === 'number' ? scoop.radius : DEFAULT_MANUAL_RADIUS;
  const manualRun = scoop.run ?? manualHeight;
  const autoMaxHeight = scoop.autoMaxHeight ?? DESIGNER_CONSTRAINTS.MAX_SCOOP_RADIUS;

  // Steppers bound to the bin's real geometry; the generator clamps precisely
  // per compartment, so these are generous UI ceilings, not hard limits.
  const bounds = useMemo(() => {
    const { innerD, wallHeight } = binDimensions(params);
    const interiorHeight = computeInteriorHeight(
      wallHeight,
      params.base.stackingLip,
      GRIDFINITY.LIP_SMALL_TAPER
    );
    const min = DESIGNER_CONSTRAINTS.MIN_SCOOP_RADIUS;
    return {
      heightMax: clamp(Math.round(wallHeight), min, DESIGNER_CONSTRAINTS.MAX_SCOOP_HEIGHT),
      runMax: clamp(
        Math.round(innerD / params.compartments.rows),
        min,
        DESIGNER_CONSTRAINTS.MAX_SCOOP_RUN
      ),
      autoMaxHeightMax: clamp(
        Math.round(interiorHeight),
        min,
        DESIGNER_CONSTRAINTS.MAX_SCOOP_HEIGHT
      ),
    };
  }, [params]);

  // Very steep scoops (tall rise, short run) print with rough overhangs and are
  // awkward to reach into. Warn (non-blocking) only in custom mode; auto stays
  // proportional and never trips this.
  const isSteep =
    !isAutoRadius &&
    manualRun > 0 &&
    manualHeight / manualRun > DESIGNER_CONSTRAINTS.SCOOP_STEEP_WARN_RATIO;

  const autoDisplayText = useMemo(() => {
    if (!isAutoRadius) return '';

    const { base, compartments } = params;
    const { innerW, innerD, wallHeight } = binDimensions(params);
    const cellW = innerW / compartments.cols;
    const cellD = innerD / compartments.rows;

    const hasLip = base.stackingLip;
    const interiorHeight = computeInteriorHeight(wallHeight, hasLip, GRIDFINITY.LIP_SMALL_TAPER);
    const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;

    const processedCompartments = new Set<number>();
    const heights: number[] = [];

    for (let row = 0; row < compartments.rows; row++) {
      for (let col = 0; col < compartments.cols; col++) {
        const compId = compartments.cells[row * compartments.cols + col];
        if (processedCompartments.has(compId)) continue;
        processedCompartments.add(compId);

        const compBounds = getCompartmentBounds(compartments, compId);
        if (!compBounds) continue;

        const { minCol, maxCol, minRow, maxRow } = compBounds;
        const compW = (maxCol - minCol + 1) * cellW;
        const compD = (maxRow - minRow + 1) * cellD;
        const isMinRow = minRow === 0;
        const lipOffset = computeLipOffset(hasLip, isMinRow, lipTaperWidth, params.wallThickness);

        const profile = resolveScoopProfile(
          scoop,
          compW,
          compD,
          isMinRow,
          hasLip,
          wallHeight,
          interiorHeight,
          lipOffset
        );
        if (profile) heights.push(profile.height);
      }
    }

    if (heights.length === 0) return t('binDesigner.scoopRadiusAuto');

    const rounded = heights.map((h) => Math.round(h));
    const min = Math.min(...rounded);
    const max = Math.max(...rounded);

    if (min === max) {
      return t('binDesigner.scoopRadiusAutoValue', { value: String(min) });
    }
    return t('binDesigner.scoopRadiusAutoRange', { min: String(min), max: String(max) });
  }, [isAutoRadius, params, scoop, t]);

  const toggleScoop = useCallback(() => {
    updateScoop({ enabled: !scoop.enabled });
  }, [scoop.enabled, updateScoop]);

  const toggleAutoRadius = useCallback(() => {
    // Entering custom mode: pin both axes to concrete values so the two
    // steppers are independent from the first interaction.
    updateScoop(isAutoRadius ? { radius: manualHeight, run: manualRun } : { radius: 'auto' });
  }, [isAutoRadius, manualHeight, manualRun, updateScoop]);

  const setHeight = useCallback(
    (radius: number) => {
      updateScoop({ radius });
    },
    [updateScoop]
  );

  const setRun = useCallback(
    (run: number) => {
      updateScoop({ run });
    },
    [updateScoop]
  );

  const setStyle = useCallback(
    (next: ScoopStyle) => {
      updateScoop({ style: next });
    },
    [updateScoop]
  );

  const setAutoMaxHeight = useCallback(
    (value: number) => {
      updateScoop({ autoMaxHeight: value });
    },
    [updateScoop]
  );

  const sectionSummary = useMemo(() => {
    if (!scoop.enabled) return undefined;
    return isAutoRadius ? autoDisplayText : `${manualHeight}×${manualRun}mm`;
  }, [scoop.enabled, isAutoRadius, autoDisplayText, manualHeight, manualRun]);

  const disabledReason = scoopStatus.reason ? t(scoopStatus.reason) : undefined;

  const meta = useMemo(
    () => ({
      summary: isUnavailable ? undefined : sectionSummary,
      disabledReason,
    }),
    [isUnavailable, sectionSummary, disabledReason]
  );

  return {
    state: {
      scoop,
      isAutoRadius,
      style,
      manualHeight,
      manualRun,
      autoMaxHeight,
      autoDisplayText,
      isSteep,
      bounds,
    },
    handlers: {
      toggleScoop,
      toggleAutoRadius,
      setHeight,
      setRun,
      setStyle,
      setAutoMaxHeight,
    },
    meta,
    t,
  };
}
