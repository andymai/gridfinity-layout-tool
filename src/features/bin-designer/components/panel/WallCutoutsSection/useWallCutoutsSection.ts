import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import type {
  WallSide,
  WallCutout,
  WallCutoutShape,
  LabelTabAlignment,
} from '@/features/bin-designer/types';
import { DISABLED_WALL_CUTOUT } from '@/features/bin-designer/constants/defaults';
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
        updateWallSide(side, DISABLED_WALL_CUTOUT);
      } else {
        // When linked, copy values from first active side; otherwise use defaults
        const source =
          linked && activeSides.length > 0
            ? walls[activeSides[0]]
            : {
                width: DEFAULT_SPAN,
                depth: DEFAULT_HEIGHT,
                alignment: 'center' as const,
                offset: 0,
                widthMm: null,
              };
        updateWallSide(side, {
          enabled: true,
          width: source.width,
          depth: source.depth,
          alignment: source.alignment,
          offset: source.offset,
          widthMm: source.widthMm,
        });
      }
    },
    [walls, updateWallSide, linked, activeSides]
  );

  /** Apply a partial update to the target side, or all active sides when linked. */
  const applySideUpdate = useCallback(
    (side: WallSide, patch: Partial<WallCutout>) => {
      const targets = linked ? activeSides : [side];
      for (const s of targets) {
        updateWallSide(s, patch);
      }
    },
    [updateWallSide, linked, activeSides]
  );

  const setSideWidth = useCallback(
    (side: WallSide, width: number) => {
      applySideUpdate(side, { width: Math.max(0, Math.min(100, width)) });
    },
    [applySideUpdate]
  );

  const setSideDepth = useCallback(
    (side: WallSide, depth: number) => {
      applySideUpdate(side, { depth: Math.max(0, Math.min(100, depth)) });
    },
    [applySideUpdate]
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

  const setSideAlignment = useCallback(
    (side: WallSide, alignment: LabelTabAlignment) => {
      applySideUpdate(side, { alignment });
    },
    [applySideUpdate]
  );

  const setSideOffset = useCallback(
    (side: WallSide, offset: number) => {
      applySideUpdate(side, { offset: Math.max(-50, Math.min(50, offset)) });
    },
    [applySideUpdate]
  );

  const setSideWidthMm = useCallback(
    (side: WallSide, widthMm: number | null) => {
      applySideUpdate(side, { widthMm });
    },
    [applySideUpdate]
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
      setSideAlignment,
      setSideOffset,
      setSideWidthMm,
      toggleLinked,
      setShape,
    },
    meta,
    t,
    STEP,
  };
}
