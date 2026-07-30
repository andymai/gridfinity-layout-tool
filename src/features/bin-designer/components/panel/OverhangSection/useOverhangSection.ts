import { useCallback, useEffect, useMemo } from 'react';
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

type Sides = Record<OverhangSide, number>;

const ZERO_SIDES: Sides = { left: 0, right: 0, front: 0, back: 0 };

function sidesOf(taper: WallTaperConfig | undefined): Sides {
  if (!taper) return ZERO_SIDES;
  return { left: taper.left, right: taper.right, front: taper.front, back: taper.back };
}

function total(s: Sides): number {
  return s.left + s.right + s.front + s.back;
}

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

  const taper = overhang.taper;
  // Mirror resolveTaper / the OverhangConfig.enabled pattern: a legacy config
  // with `enabled` absent is on when any side is non-zero, not off.
  const storedFlare = useMemo(() => sidesOf(taper), [taper]);
  const taperEnabled = taper?.enabled ?? (taper ? total(storedFlare) > 0 : false);

  // The stored `overhang` is the width at the rim and `taper` the inset back
  // down to the base, but the panel presents the base-anchored view the drawer
  // is actually measured in: `base` fills the flat gap, `flare` adds width above
  // it. Only an *enabled* taper is subtracted — a dormant one keeps its per-side
  // values for re-enabling while the stored overhang already reads as the base.
  const flare = useMemo(
    () => (taperEnabled ? storedFlare : ZERO_SIDES),
    [taperEnabled, storedFlare]
  );
  const base: Sides = useMemo(
    () => ({
      left: Math.max(0, overhang.left - flare.left),
      right: Math.max(0, overhang.right - flare.right),
      front: Math.max(0, overhang.front - flare.front),
      back: Math.max(0, overhang.back - flare.back),
    }),
    [overhang, flare]
  );

  const setSide = useCallback(
    (side: OverhangSide, value: number) => {
      updateOverhang({ [side]: value + flare[side] });
    },
    [flare, updateOverhang]
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

  const baseTotal = total(base);
  const hasOverhang = overhang.left + overhang.right + overhang.front + overhang.back > 0;
  const enabled = overhang.enabled ?? hasOverhang;
  const feet = overhang.feet ?? false;

  const toggle = useCallback(() => {
    updateOverhang({ enabled: !enabled });
  }, [enabled, updateOverhang]);

  const toggleFeet = useCallback(() => {
    updateOverhang({ feet: !feet });
  }, [feet, updateOverhang]);

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

  // Flare is additive, so the stored rim overhang has to move with it in the
  // same update — writing the taper alone would silently widen or narrow the
  // base the user set.
  const setTaperSide = useCallback(
    (side: OverhangSide, value: number) => {
      const c = overhang.taper;
      updateOverhang({
        [side]: base[side] + value,
        taper: {
          enabled: true,
          profile: c?.profile ?? 'chamfer',
          bandHeight: c?.bandHeight ?? 0,
          ...storedFlare,
          [side]: value,
        },
      });
    },
    [base, overhang.taper, storedFlare, updateOverhang]
  );

  const toggleTaper = useCallback(() => {
    // Toggling either way holds the base width steady: the stored overhang is
    // the rim, so it has to gain the flare on enable and shed it on disable.
    const prev = overhang.taper;
    if (prev && taperEnabled) {
      updateOverhang({
        left: base.left,
        right: base.right,
        front: base.front,
        back: base.back,
        taper: { ...prev, enabled: false },
      });
      return;
    }
    const defaultBand = Math.max(DESIGNER_CONSTRAINTS.TAPER_BAND_STEP, Math.round(wallHeight / 3));
    const prevBand = prev?.bandHeight ?? 0;
    // Re-enabling restores the dormant per-side values; a first enable seeds
    // each side's flare from its own base overhang, so an asymmetric bin stays
    // asymmetric and a side left at zero is not flared behind the user's back.
    const seed = total(storedFlare) > 0 ? storedFlare : base;
    updateOverhang({
      left: base.left + seed.left,
      right: base.right + seed.right,
      front: base.front + seed.front,
      back: base.back + seed.back,
      taper: {
        enabled: true,
        profile: prev?.profile ?? 'chamfer',
        bandHeight: prevBand > 0 ? prevBand : defaultBand,
        ...seed,
      },
    });
  }, [base, overhang.taper, storedFlare, taperEnabled, wallHeight, updateOverhang]);

  const setTaperProfile = useCallback(
    (profile: WallTaperProfile) => updateTaper({ profile }),
    [updateTaper]
  );
  const setBandHeight = useCallback((v: number) => updateTaper({ bandHeight: v }), [updateTaper]);

  // Overhang is suppressed for custom-shape (mask) bins in the generator, so
  // surface that as a disabled state rather than silently ignoring input.
  const disabledReason = isCustomShape ? t('binDesigner.shape.custom.hint') : undefined;

  // The one-line row shrinks the track to ~84px, below a comfortable touch
  // target; anything touch-driven keeps the stacked full-width slider.
  const stackedSliders = isMobile || isTablet || isTouchDevice;

  return {
    state: {
      overhang,
      base,
      isCustomShape,
      feet,
      hasOverhang,
      // Feet sit under the base footprint, so a bin that is all flare has no
      // ground for them even though its rim overhangs.
      hasBaseOverhang: baseTotal > 0,
      enabled,
      taper: {
        enabled: taperEnabled,
        profile: taper?.profile ?? 'chamfer',
        bandHeight: taper?.bandHeight ?? 0,
        sides: flare,
        maxPerSide: DESIGNER_CONSTRAINTS.MAX_TAPER,
        maxBand: Math.max(DESIGNER_CONSTRAINTS.TAPER_BAND_STEP, Math.round(wallHeight)),
        availableForBin: taperAvailable,
        canTaper: taperAvailable,
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
