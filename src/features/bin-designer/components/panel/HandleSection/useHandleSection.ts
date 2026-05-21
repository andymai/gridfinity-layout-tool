import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import { isPartialMask } from '@/shared/utils/cellMask';
import { DEFAULT_HANDLE_SIDE } from '../../../constants/defaults';
import type { HandleWallSide, HandleCutoutShape, HandleSide } from '@/features/bin-designer/types';
import type { SectionMeta } from '../types';

/** Side chip order matches WallCutoutsSection: L R F B */
export const HANDLE_SIDES: readonly HandleWallSide[] = ['left', 'right', 'front', 'back'];

export function useHandleSection() {
  const { handles, updateHandles, updateHandleSide, params } = useDesignerStore(
    useShallow((s) => ({
      handles: s.params.handles,
      updateHandles: s.updateHandles,
      updateHandleSide: s.updateHandleSide,
      params: s.params,
    }))
  );
  const t = useTranslation();
  const [linked, setLinked] = useState(true);

  const featureStatus = getFeatureStatus(params, 'handles');
  const isUnavailable = !featureStatus.available;
  const isBackDisabled = params.label.enabled;

  const activeSides = useMemo(
    () =>
      HANDLE_SIDES.filter((side) => {
        if (side === 'back' && isBackDisabled) return false;
        return handles[side].enabled;
      }),
    [handles, isBackDisabled]
  );

  const toggleEnabled = useCallback(() => {
    updateHandles({ enabled: !handles.enabled });
  }, [handles.enabled, updateHandles]);

  const toggleSide = useCallback(
    (side: HandleWallSide) => {
      if (side === 'back' && isBackDisabled) return;
      if (handles[side].enabled) {
        updateHandleSide(side, { ...DEFAULT_HANDLE_SIDE, enabled: false });
      } else {
        // When linked, copy values from first active side; otherwise use defaults
        const source =
          linked && activeSides.length > 0 ? handles[activeSides[0]] : DEFAULT_HANDLE_SIDE;
        updateHandleSide(side, { ...source, enabled: true });
      }
    },
    [handles, updateHandleSide, isBackDisabled, linked, activeSides]
  );

  /** Apply a partial update to the target side, or all active sides when linked. */
  const applySideUpdate = useCallback(
    (side: HandleWallSide, patch: Partial<HandleSide>) => {
      const targets = linked ? activeSides : [side];
      for (const s of targets) {
        updateHandleSide(s, patch);
      }
    },
    [updateHandleSide, linked, activeSides]
  );

  // Global setters
  const setWidth = useCallback((w: number) => updateHandles({ width: w }), [updateHandles]);
  const setHeight = useCallback((h: number) => updateHandles({ height: h }), [updateHandles]);
  const setCornerRadius = useCallback(
    (r: number) => updateHandles({ cornerRadius: r }),
    [updateHandles]
  );
  const setShape = useCallback(
    (shape: HandleCutoutShape) => updateHandles({ shape }),
    [updateHandles]
  );
  const setVerticalPosition = useCallback(
    (v: number) => updateHandles({ verticalPosition: v }),
    [updateHandles]
  );
  const setCount = useCallback((count: number) => updateHandles({ count }), [updateHandles]);
  const toggleChamfer = useCallback(
    () => updateHandles({ chamfer: !handles.chamfer }),
    [handles.chamfer, updateHandles]
  );
  const toggleInterior = useCallback(
    () => updateHandles({ interior: !handles.interior }),
    [handles.interior, updateHandles]
  );
  const toggleLinked = useCallback(() => setLinked((prev) => !prev), []);

  // Per-side setters
  const setSideWidth = useCallback(
    (side: HandleWallSide, w: number) => applySideUpdate(side, { width: w }),
    [applySideUpdate]
  );
  const setSideHeight = useCallback(
    (side: HandleWallSide, h: number) => applySideUpdate(side, { height: h }),
    [applySideUpdate]
  );
  const setSideCornerRadius = useCallback(
    (side: HandleWallSide, r: number) => applySideUpdate(side, { cornerRadius: r }),
    [applySideUpdate]
  );

  const isCustomShape = isPartialMask(params.cellMask);

  // On polygon bins the actual handle spans a polygon-edge wallSpan (computed
  // by the generator), not the AABB — so the AABB-derived preview would lie.
  // Returning null here lets the UI suppress the mm readout for custom shapes.
  const handleWidthMm = useMemo(() => {
    if (isCustomShape) return null;
    const { innerW, innerD } = binDimensions(params);
    const fbEnabled = handles.front.enabled || (handles.back.enabled && !isBackDisabled);
    const lrEnabled = handles.left.enabled || handles.right.enabled;
    let span = innerW;
    if (fbEnabled && lrEnabled) {
      span = Math.min(innerW, innerD);
    } else if (lrEnabled) {
      span = innerD;
    }
    return Math.round(span * (handles.width / 100) * 10) / 10;
  }, [params, handles, isBackDisabled, isCustomShape]);

  const summary = useMemo(() => {
    if (!handles.enabled || activeSides.length === 0) return undefined;
    const sideNames = activeSides.map((s) => t(`binDesigner.handles.${s}`)).join(', ');
    const shapeName = t(
      `binDesigner.handles.shape.${handles.shape === 'u-shape' ? 'uShape' : handles.shape}`
    );
    const countSuffix = handles.count > 1 ? ` ×${handles.count}` : '';
    return t('binDesigner.handles.summary', {
      shape: shapeName + countSuffix,
      sides: sideNames,
      height: String(handles.height),
    });
  }, [handles, activeSides, t]);

  const disabledReason = featureStatus.reason ? t(featureStatus.reason) : undefined;

  const meta: SectionMeta = useMemo(
    () => ({
      summary: isUnavailable ? undefined : summary,
      disabledReason,
    }),
    [isUnavailable, summary, disabledReason]
  );

  const isUShape = handles.shape === 'u-shape';
  const showCornerRadius = handles.shape === 'rectangle' || handles.shape === 'u-shape';
  // Interior handles are skipped on polygon bins (no compartment walls exist
  // for custom shapes), so hide the toggle there to prevent a silent no-op.
  const hasCompartments =
    !isCustomShape && (params.compartments.cols > 1 || params.compartments.rows > 1);

  return {
    state: {
      handles,
      isBackDisabled,
      handleWidthMm,
      linked,
      isUShape,
      showCornerRadius,
      hasCompartments,
      activeSides,
    },
    handlers: {
      toggleEnabled,
      toggleSide,
      setWidth,
      setHeight,
      setCornerRadius,
      setShape,
      setVerticalPosition,
      setCount,
      toggleChamfer,
      toggleInterior,
      toggleLinked,
      setSideWidth,
      setSideHeight,
      setSideCornerRadius,
    },
    meta,
    t,
  };
}
