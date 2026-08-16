import { useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import { isLidBlockedBySection } from '@/features/bin-designer/utils/lidCompatibility';
import type {
  WallSide,
  WallCutout,
  WallCutoutShape,
  LabelTabAlignment,
} from '@/features/bin-designer/types';
import { DISABLED_WALL_CUTOUT } from '@/features/bin-designer/constants/defaults';
import { MAX_CUTOUT_CORNER_RADIUS } from '@/shared/utils/wallCutoutPosition';
import type { SectionMeta } from '../types';

const ALL_SIDES: readonly WallSide[] = ['front', 'back', 'left', 'right', 'interior'];
const OUTER_SIDES: readonly WallSide[] = ['front', 'back', 'left', 'right'];
const STEP = 5;
const DEFAULT_SPAN = 70;
const DEFAULT_HEIGHT = 50;
/** Stepper granularity for the two corner radii, in mm. */
const CORNER_STEP = 0.5;
/**
 * Where the bottom fillet starts when the user steps out of Auto.
 *
 * A fixed seed rather than the automatic value, which is 15% of the cut's span
 * in mm and so is not knowable from the panel — the interior dividers have no
 * span the panel can measure at all. Landing somewhere predictable and visibly
 * rounded beats landing on a number derived from the wrong wall.
 */
const CORNER_SEED = 2;

/**
 * Compartment count at or above which wall cutouts read as a stack of slats.
 * Drives the expectation hint rather than any geometry change.
 */
const DENSITY_HINT_THRESHOLD = 5;

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
  const { linked, updateSetting } = useSettingsStore(
    useShallow((s) => ({
      linked: s.settings.wallCutoutsLinked,
      updateSetting: s.updateSetting,
    }))
  );

  // True once the user has made an explicit interior choice this session, so
  // the auto-coupling below won't resurrect an interior they turned off.
  const interiorUserSet = useRef(false);

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
    if (walls.enabled) {
      updateWalls({ enabled: false });
      return;
    }
    // Enabling on a multi-compartment bin: also cut the interior dividers so
    // the opening carries through the bin instead of leaving full-height
    // dividers behind notched outer walls. Skipped once the user
    // has made an explicit interior choice, so turning it off stays off.
    const hasDividers = params.compartments.cols > 1 || params.compartments.rows > 1;
    if (hasDividers && !walls.interior.enabled && !interiorUserSet.current) {
      const source = OUTER_SIDES.map((s) => walls[s]).find((c) => c.enabled);
      updateWalls({
        enabled: true,
        interior: {
          enabled: true,
          width: source?.width ?? DEFAULT_SPAN,
          depth: source?.depth ?? DEFAULT_HEIGHT,
          alignment: source?.alignment ?? 'center',
          offset: source?.offset ?? 0,
          widthMm: source?.widthMm ?? null,
        },
      });
      return;
    }
    updateWalls({ enabled: true });
  }, [walls, updateWalls, params.compartments]);

  const toggleSide = useCallback(
    (side: WallSide) => {
      // An explicit interior toggle opts out of the auto-coupling above.
      if (side === 'interior') interiorUserSet.current = true;
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
    updateSetting('wallCutoutsLinked', !linked);
  }, [updateSetting, linked]);

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

  const setSideCornerTop = useCallback(
    (side: WallSide, radius: number) => {
      applySideUpdate(side, {
        cornerRadiusTop: Math.max(0, Math.min(MAX_CUTOUT_CORNER_RADIUS, radius)),
      });
    },
    [applySideUpdate]
  );

  /** Null puts the bottom fillet back on the automatic 15%-of-span rule. */
  const setSideCornerBottom = useCallback(
    (side: WallSide, radius: number | null) => {
      applySideUpdate(side, {
        cornerRadiusBottom:
          radius === null ? null : Math.max(0, Math.min(MAX_CUTOUT_CORNER_RADIUS, radius)),
      });
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

  // Dense bins render wall cutouts as a stack of slats no matter what — surface
  // a quiet expectation hint rather than changing geometry.
  const showDensityHint = useMemo(() => {
    if (!walls.enabled || activeSides.length === 0) return false;
    return (
      params.compartments.cols >= DENSITY_HINT_THRESHOLD ||
      params.compartments.rows >= DENSITY_HINT_THRESHOLD
    );
  }, [walls.enabled, activeSides.length, params.compartments.cols, params.compartments.rows]);

  const disabledReason = featureStatus.reason ? t(featureStatus.reason) : undefined;

  // True when the user's wall-cutout config is blocking the click-lock
  // lid right now (lid is enabled but all four walls have cutouts → no
  // lip remaining for the lid to mate with). Drives the small red dot
  // on the section header so users editing wall cutouts see the conflict.
  const blocksLid = isLidBlockedBySection(params, 'walls');

  const meta: SectionMeta = useMemo(
    () => ({
      summary: isUnavailable ? undefined : summary,
      disabledReason,
    }),
    [isUnavailable, summary, disabledReason]
  );

  return {
    state: { walls, activeSides, linked, blocksLid, showDensityHint },
    handlers: {
      toggleEnabled,
      toggleSide,
      setSideWidth,
      setSideDepth,
      setSideAlignment,
      setSideOffset,
      setSideWidthMm,
      setSideCornerTop,
      setSideCornerBottom,
      toggleLinked,
      setShape,
    },
    meta,
    t,
    STEP,
    CORNER_STEP,
    CORNER_SEED,
  };
}
