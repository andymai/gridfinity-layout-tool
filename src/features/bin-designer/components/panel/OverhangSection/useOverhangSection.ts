import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { isPartialMask } from '@/shared/utils/cellMask';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import type { OverhangConfig, WallTaperConfig } from '@/features/bin-designer/types';
import type { WallTaperProfile } from '@/core/types';

const ZERO_OVERHANG: OverhangConfig = { left: 0, right: 0, front: 0, back: 0, feet: false };

export type OverhangSide = 'left' | 'right' | 'front' | 'back';

export function useOverhangSection() {
  const { params, updateOverhang, setHoveredOverhangSide } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      updateOverhang: s.updateOverhang,
      setHoveredOverhangSide: s.setHoveredOverhangSide,
    }))
  );
  const t = useTranslation();
  const { isMobile, isTablet, isTouchDevice } = useResponsive();

  const overhang = params.overhang ?? ZERO_OVERHANG;
  const isCustomShape = isPartialMask(params.cellMask);
  const { wallHeight } = binDimensions(params);
  // Taper is v1-scoped to hollow, single-compartment bins (the generator strips
  // it otherwise); gate the control to match so it can't silently no-op.
  const taperAvailable = !params.base.solid && new Set(params.compartments.cells).size <= 1;

  const setSide = useCallback(
    (side: OverhangSide, value: number) => {
      updateOverhang({ [side]: value });
    },
    [updateOverhang]
  );

  const setHovered = useCallback(
    (side: OverhangSide | 'feet' | null) => {
      setHoveredOverhangSide(side);
    },
    [setHoveredOverhangSide]
  );

  // Leave/blur handlers can't fire if the section unmounts or gets disabled
  // (inert custom-shape) mid-hover, which would strand the preview overlay.
  // Clear the transient highlight on unmount and whenever the section disables.
  useEffect(() => {
    if (isCustomShape) setHoveredOverhangSide(null);
    return () => setHoveredOverhangSide(null);
  }, [isCustomShape, setHoveredOverhangSide]);

  const total = overhang.left + overhang.right + overhang.front + overhang.back;
  const hasOverhang = total > 0;
  const enabled = overhang.enabled ?? hasOverhang;
  const feet = overhang.feet ?? false;

  const toggle = useCallback(() => {
    updateOverhang({ enabled: !enabled });
  }, [enabled, updateOverhang]);

  const toggleFeet = useCallback(() => {
    updateOverhang({ feet: !feet });
  }, [feet, updateOverhang]);

  // Taper insets each side within its overhang, so a side can only taper when it
  // has overhang; it is mutually exclusive with `feet` (frame feet would poke
  // past a tapered base).
  const taper = overhang.taper;
  // Mirror resolveTaper / the OverhangConfig.enabled pattern: a legacy config
  // with `enabled` absent is on when any side is non-zero, not off.
  const taperEnabled =
    taper?.enabled ??
    (taper ? taper.left > 0 || taper.right > 0 || taper.front > 0 || taper.back > 0 : false);

  const updateTaper = useCallback(
    (partial: Partial<WallTaperConfig>) => {
      const c = overhang.taper;
      updateOverhang({
        taper: {
          enabled: c?.enabled ?? true,
          profile: c?.profile ?? 'chamfer',
          bandHeight: c?.bandHeight ?? 0,
          left: c?.left ?? 0,
          right: c?.right ?? 0,
          front: c?.front ?? 0,
          back: c?.back ?? 0,
          ...partial,
        },
      });
    },
    [overhang.taper, updateOverhang]
  );

  const toggleTaper = useCallback(() => {
    const prev = overhang.taper;
    if (prev?.enabled) {
      updateTaper({ enabled: false });
      return;
    }
    // Seed a drawer-fit default: taper each side back to nominal over a band ~a
    // third of the wall. Feet are mutually exclusive, so clear them.
    const defaultBand = Math.max(DESIGNER_CONSTRAINTS.TAPER_BAND_STEP, Math.round(wallHeight / 3));
    const prevBand = prev?.bandHeight ?? 0;
    const seedSides =
      prev && (prev.left > 0 || prev.right > 0 || prev.front > 0 || prev.back > 0)
        ? { left: prev.left, right: prev.right, front: prev.front, back: prev.back }
        : {
            left: overhang.left,
            right: overhang.right,
            front: overhang.front,
            back: overhang.back,
          };
    updateOverhang({
      feet: false,
      taper: {
        enabled: true,
        profile: prev?.profile ?? 'chamfer',
        bandHeight: prevBand > 0 ? prevBand : defaultBand,
        ...seedSides,
      },
    });
  }, [overhang, wallHeight, updateOverhang, updateTaper]);

  const setTaperProfile = useCallback(
    (profile: WallTaperProfile) => updateTaper({ profile }),
    [updateTaper]
  );
  const setBandHeight = useCallback((v: number) => updateTaper({ bandHeight: v }), [updateTaper]);
  const setTaperSide = useCallback(
    (side: OverhangSide, v: number) => updateTaper({ [side]: v }),
    [updateTaper]
  );

  // Overhang is suppressed for custom-shape (mask) bins in the generator, so
  // surface that as a disabled state rather than silently ignoring input.
  const disabledReason = isCustomShape ? t('binDesigner.shape.custom.hint') : undefined;

  // The one-line row shrinks the track to ~84px, below a comfortable touch
  // target; anything touch-driven keeps the stacked full-width slider.
  const stackedSliders = isMobile || isTablet || isTouchDevice;

  return {
    state: {
      overhang,
      isCustomShape,
      feet,
      hasOverhang,
      enabled,
      taper: {
        enabled: taperEnabled,
        profile: taper?.profile ?? 'chamfer',
        bandHeight: taper?.bandHeight ?? 0,
        sides: {
          left: taper?.left ?? 0,
          right: taper?.right ?? 0,
          front: taper?.front ?? 0,
          back: taper?.back ?? 0,
        },
        maxPerSide: {
          left: overhang.left,
          right: overhang.right,
          front: overhang.front,
          back: overhang.back,
        },
        maxBand: Math.max(DESIGNER_CONSTRAINTS.TAPER_BAND_STEP, Math.round(wallHeight)),
        availableForBin: taperAvailable,
        canTaper: hasOverhang && taperAvailable,
      },
    },
    handlers: {
      setSide,
      toggleFeet,
      setHovered,
      toggle,
      toggleTaper,
      setTaperProfile,
      setBandHeight,
      setTaperSide,
    },
    meta: { disabledReason, stackedSliders },
    t,
  };
}
