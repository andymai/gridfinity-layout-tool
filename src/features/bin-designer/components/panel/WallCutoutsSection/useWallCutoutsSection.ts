import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import type { WallSide } from '@/features/bin-designer/types';
import type { SectionMeta } from '../types';

const OUTER_SIDES: readonly WallSide[] = ['front', 'back', 'left', 'right'];
const STEP = 5;

export function useWallCutoutsSection() {
  const { walls, updateWalls, updateWallSide, params } = useDesignerStore(
    useShallow((s) => ({
      walls: s.params.walls,
      updateWalls: s.updateWalls,
      updateWallSide: s.updateWallSide,
      params: s.params,
    }))
  );
  const t = useTranslation();

  const featureStatus = getFeatureStatus(params, 'wallCutouts');
  const isUnavailable = !featureStatus.available;

  // Count active sides for summary
  const activeSideCount = useMemo(() => {
    let count = 0;
    for (const side of OUTER_SIDES) {
      if (walls[side].enabled) count++;
    }
    if (walls.interior.enabled) count++;
    return count;
  }, [walls]);

  const toggleEnabled = useCallback(() => {
    updateWalls({ enabled: !walls.enabled });
  }, [walls.enabled, updateWalls]);

  const setGlobalWidth = useCallback(
    (width: number) => {
      updateWalls({ width: Math.max(0, Math.min(100, width)) });
    },
    [updateWalls]
  );

  const setGlobalDepth = useCallback(
    (depth: number) => {
      updateWalls({ depth: Math.max(0, Math.min(100, depth)) });
    },
    [updateWalls]
  );

  const toggleSide = useCallback(
    (side: WallSide) => {
      const current = walls[side];
      if (current.enabled) {
        // Disable: clear per-side overrides
        updateWallSide(side, { enabled: false, width: 0, depth: 0 });
      } else {
        // Enable: copy global defaults as starting point
        updateWallSide(side, { enabled: true, width: walls.width, depth: walls.depth });
      }
    },
    [walls, updateWallSide]
  );

  const setSideWidth = useCallback(
    (side: WallSide, width: number) => {
      updateWallSide(side, { width: Math.max(0, Math.min(100, width)) });
    },
    [updateWallSide]
  );

  const setSideDepth = useCallback(
    (side: WallSide, depth: number) => {
      updateWallSide(side, { depth: Math.max(0, Math.min(100, depth)) });
    },
    [updateWallSide]
  );

  const summary = useMemo(() => {
    if (!walls.enabled) return undefined;
    if (activeSideCount === 0) return `${walls.width}% × ${walls.depth}%`;
    return `${walls.width}% × ${walls.depth}%, ${t('binDesigner.wallCutouts.summary', { count: activeSideCount })}`;
  }, [walls.enabled, walls.width, walls.depth, activeSideCount, t]);

  const disabledReason = featureStatus.reason ? t(featureStatus.reason) : undefined;

  const meta: SectionMeta = useMemo(
    () => ({
      summary: isUnavailable ? undefined : summary,
      disabledReason,
    }),
    [isUnavailable, summary, disabledReason]
  );

  return {
    state: { walls, activeSideCount },
    handlers: {
      toggleEnabled,
      setGlobalWidth,
      setGlobalDepth,
      toggleSide,
      setSideWidth,
      setSideDepth,
    },
    meta,
    t,
    STEP,
    OUTER_SIDES,
  };
}
