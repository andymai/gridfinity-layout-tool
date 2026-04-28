import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { useTranslation } from '@/i18n';
import type { LidFit } from '@/features/bin-designer/types';
import type { SnappingSliderOption } from '../../controls/SnappingSlider';

export const FIT_OPTIONS: readonly LidFit[] = ['loose', 'standard', 'tight'] as const;

export function useLidSection() {
  const t = useTranslation();
  const { lid, base, updateLid } = useDesignerStore(
    useShallow((s) => ({
      lid: s.params.lid,
      base: s.params.base,
      updateLid: s.updateLid,
    }))
  );

  const requiresStackingLipReason = !base.stackingLip
    ? t('binDesigner.lid.requiresStackingLip')
    : undefined;

  // Effective enabled: the lid only renders/exports when both `lid.enabled`
  // is set AND the bin has a stacking lip to mate with. The persisted flag
  // is preserved so flipping the lip back on restores the user's choice;
  // the UI just reflects the gated state until then.
  const effectiveEnabled = lid.enabled && base.stackingLip;

  // Bin has magnets when its base style includes them. Used as the smart
  // default for lid magnetHoles each time the lid is enabled.
  const binHasMagnets = base.style === 'magnet' || base.style === 'magnet_and_screw';

  const thicknessOptions: SnappingSliderOption[] = useMemo(
    () =>
      WALL_THICKNESS_OPTIONS.map((value) => ({
        value,
        description: t(`binDesigner.wallThickness.${value}`),
      })),
    [t]
  );

  const toggleEnabled = useCallback(() => {
    if (lid.enabled) {
      updateLid({ enabled: false });
    } else {
      // First enable (or re-enable) auto-syncs magnetHoles to bin's magnet
      // state so the lid matches by default. User can override afterwards.
      updateLid({ enabled: true, magnetHoles: binHasMagnets });
    }
  }, [lid.enabled, binHasMagnets, updateLid]);

  const setFit = useCallback(
    (fit: LidFit) => {
      updateLid({ fit });
    },
    [updateLid]
  );

  const toggleStackableTop = useCallback(() => {
    updateLid({ stackableTop: !lid.stackableTop });
  }, [lid.stackableTop, updateLid]);

  const toggleMagnetHoles = useCallback(() => {
    updateLid({ magnetHoles: !lid.magnetHoles });
  }, [lid.magnetHoles, updateLid]);

  const setWallThickness = useCallback(
    (wallThickness: number) => {
      updateLid({ wallThickness });
    },
    [updateLid]
  );

  const setTopThickness = useCallback(
    (topThickness: number) => {
      updateLid({ topThickness });
    },
    [updateLid]
  );

  const valueSummary = useMemo(() => t(`binDesigner.lid.fit.${lid.fit}`), [t, lid.fit]);

  return {
    state: {
      enabled: effectiveEnabled,
      fit: lid.fit,
      stackableTop: lid.stackableTop,
      magnetHoles: lid.magnetHoles,
      wallThickness: lid.wallThickness,
      topThickness: lid.topThickness,
      requiresStackingLipReason,
      thicknessOptions,
      valueSummary,
    },
    handlers: {
      toggleEnabled,
      setFit,
      toggleStackableTop,
      toggleMagnetHoles,
      setWallThickness,
      setTopThickness,
    },
    t,
  };
}
