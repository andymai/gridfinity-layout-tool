import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import {
  resolveScoopRadius,
  computeLipOffset,
  computeInteriorHeight,
} from '@/shared/utils/scoopCalculations';
import { getFeatureStatus } from '@/shared/constraints';

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
  const manualRadius = typeof scoop.radius === 'number' ? scoop.radius : 10;

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
    const radii: number[] = [];

    for (let row = 0; row < compartments.rows; row++) {
      for (let col = 0; col < compartments.cols; col++) {
        const compId = compartments.cells[row * compartments.cols + col];
        if (processedCompartments.has(compId)) continue;
        processedCompartments.add(compId);

        const bounds = getCompartmentBounds(compartments, compId);
        if (!bounds) continue;

        const { minCol, maxCol, minRow, maxRow } = bounds;
        const compW = (maxCol - minCol + 1) * cellW;
        const compD = (maxRow - minRow + 1) * cellD;
        const isMinRow = minRow === 0;
        const lipOffset = computeLipOffset(hasLip, isMinRow, lipTaperWidth, params.wallThickness);

        const radius = resolveScoopRadius(
          'auto',
          compW,
          compD,
          isMinRow,
          hasLip,
          wallHeight,
          interiorHeight,
          lipOffset
        );
        if (radius > 0) radii.push(radius);
      }
    }

    if (radii.length === 0) return t('binDesigner.scoopRadiusAuto');

    const rounded = radii.map((r) => Math.round(r));
    const min = Math.min(...rounded);
    const max = Math.max(...rounded);

    if (min === max) {
      return t('binDesigner.scoopRadiusAutoValue', { value: String(min) });
    }
    return t('binDesigner.scoopRadiusAutoRange', { min: String(min), max: String(max) });
  }, [isAutoRadius, params, t]);

  const toggleScoop = useCallback(() => {
    updateScoop({ enabled: !scoop.enabled });
  }, [scoop.enabled, updateScoop]);

  const toggleAutoRadius = useCallback(() => {
    updateScoop({ radius: isAutoRadius ? manualRadius : 'auto' });
  }, [isAutoRadius, manualRadius, updateScoop]);

  const setRadius = useCallback(
    (radius: number) => {
      updateScoop({ radius });
    },
    [updateScoop]
  );

  const sectionSummary = useMemo(() => {
    if (!scoop.enabled) return undefined;
    return isAutoRadius ? autoDisplayText : `${manualRadius}mm`;
  }, [scoop.enabled, isAutoRadius, autoDisplayText, manualRadius]);

  const disabledReason = scoopStatus.reason ? t(scoopStatus.reason) : undefined;

  const meta = useMemo(
    () => ({
      summary: isUnavailable ? undefined : sectionSummary,
      disabledReason,
    }),
    [isUnavailable, sectionSummary, disabledReason]
  );

  return {
    state: { scoop, isAutoRadius, manualRadius, autoDisplayText },
    handlers: { toggleScoop, toggleAutoRadius, setRadius },
    meta,
    t,
  };
}
