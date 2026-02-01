/**
 * Hook for the Eco section panel state and handlers.
 *
 * Follows the useBaseSection/useDimensionsSection pattern:
 * returns { state, handlers, meta } with memoized values.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { WallHoneycombMode } from '@/features/bin-designer/types';
import type { SectionMeta } from '../types';
import { calculateEcoSavings } from '@/features/bin-designer/utils/printEstimates';
import { useTranslation } from '@/i18n';

export function useEcoSection() {
  const t = useTranslation();

  const {
    eco,
    params,
    updateHoneycombFloor,
    updateHoneycombWall,
    updateSinusoidalWall,
    applyEcoPreset,
  } = useDesignerStore(
    useShallow((s) => ({
      eco: s.params.eco,
      params: s.params,
      updateHoneycombFloor: s.updateHoneycombFloor,
      updateHoneycombWall: s.updateHoneycombWall,
      updateSinusoidalWall: s.updateSinusoidalWall,
      applyEcoPreset: s.applyEcoPreset,
    }))
  );

  // Determine which walls have slot grooves (eco walls skip those)
  const allWallsSlotted = useMemo(() => {
    if (params.style !== 'slotted') return false;
    return params.slotConfig.x.enabled && params.slotConfig.y.enabled;
  }, [params.style, params.slotConfig.x.enabled, params.slotConfig.y.enabled]);

  const someWallsSlotted = useMemo(() => {
    if (params.style !== 'slotted') return false;
    return params.slotConfig.x.enabled || params.slotConfig.y.enabled;
  }, [params.style, params.slotConfig.x.enabled, params.slotConfig.y.enabled]);

  // Derive active feature count and eco savings
  const { activeCount, savingsPercent } = useMemo(() => {
    let count = 0;
    if (eco.honeycombFloor.enabled) count++;
    if (eco.honeycombWall.mode !== 'none') count++;
    if (eco.sinusoidalWall.enabled) count++;

    const hasAnyEco = count > 0;
    const savings = hasAnyEco ? calculateEcoSavings(params) : undefined;

    return {
      activeCount: count,
      savingsPercent: savings?.savingsPercent ?? 0,
    };
  }, [eco, params]);

  // Handlers
  const toggleHoneycombFloor = useCallback(() => {
    updateHoneycombFloor({ enabled: !eco.honeycombFloor.enabled });
  }, [eco.honeycombFloor.enabled, updateHoneycombFloor]);

  const setHoneycombFloorCellSize = useCallback(
    (value: number) => {
      updateHoneycombFloor({ cellSize: value });
    },
    [updateHoneycombFloor]
  );

  const setHoneycombFloorMargin = useCallback(
    (value: number) => {
      updateHoneycombFloor({ margin: value });
    },
    [updateHoneycombFloor]
  );

  const setHoneycombWallMode = useCallback(
    (mode: WallHoneycombMode) => {
      updateHoneycombWall({ mode });
      // Wave walls and honeycomb walls are mutually exclusive
      if (mode !== 'none' && eco.sinusoidalWall.enabled) {
        updateSinusoidalWall({ enabled: false });
      }
    },
    [eco.sinusoidalWall.enabled, updateHoneycombWall, updateSinusoidalWall]
  );

  const toggleHoneycombWall = useCallback(() => {
    const newMode = eco.honeycombWall.mode === 'none' ? 'pocketed' : 'none';
    setHoneycombWallMode(newMode);
  }, [eco.honeycombWall.mode, setHoneycombWallMode]);

  const setHoneycombWallCellSize = useCallback(
    (value: number) => {
      updateHoneycombWall({ cellSize: value });
    },
    [updateHoneycombWall]
  );

  const setHoneycombWallTopMargin = useCallback(
    (value: number) => {
      updateHoneycombWall({ topMargin: value });
    },
    [updateHoneycombWall]
  );

  const setHoneycombWallBottomMargin = useCallback(
    (value: number) => {
      updateHoneycombWall({ bottomMargin: value });
    },
    [updateHoneycombWall]
  );

  const toggleSinusoidalWall = useCallback(() => {
    const enabling = !eco.sinusoidalWall.enabled;
    updateSinusoidalWall({ enabled: enabling });
    // Mutually exclusive with honeycomb walls
    if (enabling && eco.honeycombWall.mode !== 'none') {
      updateHoneycombWall({ mode: 'none' });
    }
  }, [
    eco.sinusoidalWall.enabled,
    eco.honeycombWall.mode,
    updateSinusoidalWall,
    updateHoneycombWall,
  ]);

  const setWaveAmplitude = useCallback(
    (value: number) => {
      updateSinusoidalWall({ amplitude: value });
    },
    [updateSinusoidalWall]
  );

  const setWaveFrequency = useCallback(
    (value: number) => {
      updateSinusoidalWall({ frequency: value });
    },
    [updateSinusoidalWall]
  );

  const setWaveBaseThickness = useCallback(
    (value: number) => {
      updateSinusoidalWall({ baseThickness: value });
    },
    [updateSinusoidalWall]
  );

  const meta: SectionMeta = useMemo(() => {
    if (activeCount === 0) return { summary: 'Off' };
    const parts: string[] = [];
    if (eco.honeycombFloor.enabled) parts.push('Floor');
    if (eco.honeycombWall.mode !== 'none') parts.push('Walls');
    if (eco.sinusoidalWall.enabled) parts.push('Wave');
    const summary =
      savingsPercent > 0 ? `${parts.join(' + ')} · ~${savingsPercent}% saved` : parts.join(' + ');
    return { summary };
  }, [activeCount, eco, savingsPercent]);

  // Disabled reason for wall eco features when all walls have slots
  const wallEcoDisabledReason = useMemo(() => {
    if (allWallsSlotted) return t('binDesigner.eco.allWallsSlotted');
    return undefined;
  }, [allWallsSlotted, t]);

  // Informational note when some (but not all) walls have slots
  const wallEcoPartialNote = useMemo(() => {
    if (someWallsSlotted && !allWallsSlotted) return t('binDesigner.eco.someWallsSlotted');
    return undefined;
  }, [someWallsSlotted, allWallsSlotted, t]);

  return {
    state: {
      eco,
      activeCount,
      savingsPercent,
      wallEcoDisabledReason,
      wallEcoPartialNote,
    },
    handlers: {
      toggleHoneycombFloor,
      setHoneycombFloorCellSize,
      setHoneycombFloorMargin,
      toggleHoneycombWall,
      setHoneycombWallMode,
      setHoneycombWallCellSize,
      setHoneycombWallTopMargin,
      setHoneycombWallBottomMargin,
      toggleSinusoidalWall,
      setWaveAmplitude,
      setWaveFrequency,
      setWaveBaseThickness,
      applyEcoPreset,
    },
    meta,
  };
}
