import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '../../../constants';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import type { HandleWallSide } from '@/features/bin-designer/types';
import type { SectionMeta } from '../types';

export const HANDLE_SIDES: readonly HandleWallSide[] = ['front', 'back', 'left', 'right'];

export function useHandleSection() {
  const { handles, updateHandles, updateHandleSide, params, width, depth, wallThickness } =
    useDesignerStore(
      useShallow((s) => ({
        handles: s.params.handles,
        updateHandles: s.updateHandles,
        updateHandleSide: s.updateHandleSide,
        params: s.params,
        width: s.params.width,
        depth: s.params.depth,
        wallThickness: s.params.wallThickness,
      }))
    );
  const t = useTranslation();

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
      updateHandleSide(side, { enabled: !handles[side].enabled });
    },
    [handles, updateHandleSide, isBackDisabled]
  );

  const setWidth = useCallback(
    (width: number) => {
      updateHandles({ width });
    },
    [updateHandles]
  );

  const setDepth = useCallback(
    (depth: number) => {
      updateHandles({ depth });
    },
    [updateHandles]
  );

  const setFilletRadius = useCallback(
    (filletRadius: number) => {
      updateHandles({ filletRadius });
    },
    [updateHandles]
  );

  const handleWidthMm = useMemo(() => {
    const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
    const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
    const innerW = outerW - 2 * wallThickness;
    const innerD = outerD - 2 * wallThickness;
    // Front/back use innerW, left/right use innerD. Show the applicable value
    // based on which sides are enabled; for mixed, show the smallest (most constrained).
    const fbEnabled = handles.front.enabled || (handles.back.enabled && !isBackDisabled);
    const lrEnabled = handles.left.enabled || handles.right.enabled;
    const span = fbEnabled && lrEnabled ? Math.min(innerW, innerD) : lrEnabled ? innerD : innerW;
    return Math.round(span * (handles.width / 100) * 10) / 10;
  }, [width, depth, wallThickness, handles, isBackDisabled]);

  const summary = useMemo(() => {
    if (!handles.enabled || activeSides.length === 0) return undefined;
    const sideNames = activeSides.map((s) => t(`binDesigner.handles.${s}`)).join(', ');
    return t('binDesigner.handles.summary', {
      sides: sideNames,
      depth: String(handles.depth),
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

  return {
    state: { handles, isBackDisabled, handleWidthMm },
    handlers: { toggleEnabled, toggleSide, setWidth, setDepth, setFilletRadius },
    meta,
    t,
  };
}
