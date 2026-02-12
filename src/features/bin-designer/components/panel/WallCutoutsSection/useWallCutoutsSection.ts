import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import type { WallSide, WallCutoutShape } from '@/features/bin-designer/types';
import type { SectionMeta } from '../types';

const ALL_SIDES: readonly WallSide[] = ['front', 'back', 'left', 'right', 'interior'];
const STEP = 5;
const DEFAULT_SPAN = 70;
const DEFAULT_HEIGHT = 50;

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
  const [linked, setLinked] = useState(true);

  const featureStatus = getFeatureStatus(params, 'wallCutouts');
  const isUnavailable = !featureStatus.available;

  const activeSides = useMemo(() => {
    const sides: WallSide[] = [];
    for (const side of ALL_SIDES) {
      if (walls[side].enabled) sides.push(side);
    }
    return sides;
  }, [walls]);

  const toggleEnabled = useCallback(() => {
    updateWalls({ enabled: !walls.enabled });
  }, [walls.enabled, updateWalls]);

  const toggleSide = useCallback(
    (side: WallSide) => {
      const current = walls[side];
      if (current.enabled) {
        updateWallSide(side, { enabled: false, width: 0, depth: 0 });
      } else {
        // When linked, copy values from first active side; otherwise use defaults
        const source =
          linked && activeSides.length > 0
            ? walls[activeSides[0]]
            : { width: DEFAULT_SPAN, depth: DEFAULT_HEIGHT };
        updateWallSide(side, { enabled: true, width: source.width, depth: source.depth });
      }
    },
    [walls, updateWallSide, linked, activeSides]
  );

  const setSideWidth = useCallback(
    (side: WallSide, width: number) => {
      const clamped = Math.max(0, Math.min(100, width));
      if (linked) {
        for (const s of activeSides) {
          updateWallSide(s, { width: clamped });
        }
      } else {
        updateWallSide(side, { width: clamped });
      }
    },
    [updateWallSide, linked, activeSides]
  );

  const setSideDepth = useCallback(
    (side: WallSide, depth: number) => {
      const clamped = Math.max(0, Math.min(100, depth));
      if (linked) {
        for (const s of activeSides) {
          updateWallSide(s, { depth: clamped });
        }
      } else {
        updateWallSide(side, { depth: clamped });
      }
    },
    [updateWallSide, linked, activeSides]
  );

  const toggleLinked = useCallback(() => {
    setLinked((prev) => !prev);
  }, []);

  const setShape = useCallback(
    (shape: WallCutoutShape) => {
      updateWalls({ shape });
    },
    [updateWalls]
  );

  const summary = useMemo(() => {
    if (!walls.enabled) return undefined;
    if (activeSides.length === 0) return undefined;
    const sideNames = activeSides.map((s) => t(`binDesigner.wallCutouts.${s}`)).join(', ');
    const first = walls[activeSides[0]];
    return t('binDesigner.wallCutouts.summary', {
      sides: sideNames,
      span: String(first.width),
      height: String(first.depth),
    });
  }, [walls, activeSides, t]);

  const disabledReason = featureStatus.reason ? t(featureStatus.reason) : undefined;

  const meta: SectionMeta = useMemo(
    () => ({
      summary: isUnavailable ? undefined : summary,
      disabledReason,
    }),
    [isUnavailable, summary, disabledReason]
  );

  return {
    state: { walls, activeSides, linked },
    handlers: {
      toggleEnabled,
      toggleSide,
      setSideWidth,
      setSideDepth,
      toggleLinked,
      setShape,
    },
    meta,
    t,
    STEP,
  };
}
