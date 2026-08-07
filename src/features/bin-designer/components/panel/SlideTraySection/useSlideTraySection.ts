import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { isPartialMask } from '@/shared/utils/cellMask';
import { resolveSlideGeometry } from '@/shared/utils/slideGeometry';
import type { SlideRejection } from '@/shared/utils/slideGeometry';
import type { SlideRailMount } from '@/features/bin-designer/types';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { SLIDE_CONSTRAINTS } from '@/features/bin-designer/types/slide';
import type { SectionMeta } from '../types';

/**
 * Every rejection except `disabled` maps to copy explaining why nothing
 * appeared. Exhaustive by construction: a new reason added to the resolver
 * fails the switch's type check rather than silently rendering nothing, which
 * is the whole reason the reasons are typed.
 */
function rejectionKey(rejection: Exclude<SlideRejection, 'disabled'>): string {
  switch (rejection) {
    case 'no-cavity':
      return 'binDesigner.slideTray.unavailable.noCavity';
    case 'slot-conflict':
      return 'binDesigner.slideTray.unavailable.slotConflict';
    case 'unsupported-shape':
      return 'binDesigner.slideTray.unavailable.unsupportedShape';
    case 'no-bearing':
      return 'binDesigner.slideTray.unavailable.noBearing';
    case 'rail-below-floor':
      return 'binDesigner.slideTray.unavailable.railBelowFloor';
    case 'bin-too-shallow':
      return 'binDesigner.slideTray.unavailable.binTooShallow';
    case 'bin-too-narrow':
    case 'tray-too-thin':
      return 'binDesigner.slideTray.unavailable.trayTooSmall';
  }
}

export function useSlideTraySection() {
  const { slide, updateSlide, params } = useDesignerStore(
    useShallow((s) => ({
      slide: s.params.slide,
      updateSlide: s.updateSlide,
      params: s.params,
    }))
  );
  const t = useTranslation();

  // Resolved from the SAME function the worker builds from, so the panel can
  // never explain a rejection the generator did not actually make. The designer's
  // `binDimensions` deliberately mirrors the worker's `deriveDimensions`.
  const geometry = useMemo(() => {
    const dim = binDimensions(params);
    return resolveSlideGeometry({
      // Probe with the feature ON regardless of the toggle: the panel needs to
      // know whether this BIN could carry a tray in order to decide whether the
      // toggle is even offerable.
      slide: { ...slide, enabled: true },
      isSlotted: params.style === 'slotted',
      isSolid: params.base.solid,
      isPolygon: isPartialMask(params.cellMask),
      innerW: dim.innerW,
      innerD: dim.innerD,
      outerW: dim.outerW,
      outerD: dim.outerD,
      wallThickness: params.wallThickness,
      wallHeight: dim.wallHeight,
      collarHeight: Math.max(0, params.extraWallHeightMm ?? 0),
      hasLip: params.base.stackingLip,
      gridUnitMmX: params.gridUnitMm,
    });
  }, [params, slide]);

  const blockedReason =
    geometry.rejection && geometry.rejection !== 'disabled'
      ? t(rejectionKey(geometry.rejection))
      : undefined;

  const setMount = useCallback(
    (railMount: SlideRailMount) => updateSlide({ railMount }),
    [updateSlide]
  );
  const setTrayWidthUnits = useCallback(
    (trayWidthUnits: number) => updateSlide({ trayWidthUnits }),
    [updateSlide]
  );
  const setTrayDepthMm = useCallback(
    (trayDepthMm: number) => updateSlide({ trayDepthMm }),
    [updateSlide]
  );
  const setRailDropMm = useCallback(
    (railDropMm: number) => updateSlide({ railDropMm }),
    [updateSlide]
  );
  const setClearanceMm = useCallback(
    (clearanceMm: number) => updateSlide({ clearanceMm }),
    [updateSlide]
  );
  const toggle = useCallback(() => updateSlide({ enabled: !slide.enabled }), [updateSlide, slide]);

  /**
   * How far the tray stands proud of the bin's rim, in mm, or null when it sits
   * inside. Surfaced because the shipped default only keeps the tray inside for
   * a bin tall enough to give it the drop, and a tray sticking out of the top
   * reads as a bug rather than a setting.
   */
  const protrusionMm = useMemo(() => {
    const tray = geometry.tray;
    if (!tray) return null;
    const over = tray.restZ + tray.heightMm - binDimensions(params).wallHeight;
    return over > 0.05 ? over : null;
  }, [geometry, params]);

  const meta: SectionMeta = {
    summary: slide.enabled
      ? t('binDesigner.slideTray.summary', {
          width: slide.trayWidthUnits,
          mount: t(`binDesigner.slideTray.mount.${slide.railMount}`),
        })
      : undefined,
    disabledReason: blockedReason,
  };

  return {
    slide,
    meta,
    blockedReason,
    protrusionMm,
    constraints: SLIDE_CONSTRAINTS,
    handlers: {
      toggle,
      setMount,
      setTrayWidthUnits,
      setTrayDepthMm,
      setRailDropMm,
      setClearanceMm,
    },
  };
}
