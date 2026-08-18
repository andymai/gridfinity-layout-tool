import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import type { KnifeRestConfig, KnifeRestStyle } from '@/features/bin-designer/types';
import {
  knifeRestStyle,
  KNIFE_REST_DEFAULT_GAP_MM,
  KNIFE_REST_GROOVE_DEPTH_MM,
} from '@/features/bin-designer/types';
import { planKnifeRest } from '@/shared/utils/knifeRestPlan';
import type { SectionMeta } from '../types';

/** Companion footprint along the knife axis when the design doesn't say — mirrors `planKnifeRest`. */
const DEFAULT_DEPTH_U = 1;

export function useKnifeRestSection() {
  const { params, setParams } = useDesignerStore(
    useShallow((s) => ({ params: s.params, setParams: s.setParams }))
  );
  const t = useTranslation();

  const rest = params.knifeRest;
  const enabled = rest?.enabled === true;
  const style: KnifeRestStyle = rest ? knifeRestStyle(rest) : 'companion';

  // Probed with the feature ON regardless of the toggle: the section needs to
  // know whether this DESIGN could carry a rest before deciding whether the
  // toggle is offerable at all. Same resolver the worker builds from, so the
  // panel can never explain a refusal the generator did not make.
  const plan = useMemo(
    () => planKnifeRest({ ...params, knifeRest: { ...(rest ?? {}), enabled: true } }),
    [params, rest]
  );

  const write = useCallback(
    (patch: Partial<KnifeRestConfig>) => {
      setParams({ knifeRest: { ...(rest ?? { enabled: true }), ...patch } });
    },
    [rest, setParams]
  );

  const toggle = useCallback(() => write({ enabled: !enabled }), [enabled, write]);
  const setStyle = useCallback((next: KnifeRestStyle) => write({ style: next }), [write]);
  const setGapMm = useCallback((gapMm: number) => write({ gapMm }), [write]);
  const setDepthU = useCallback((depthU: number) => write({ depthU }), [write]);
  const setGrooveDepthMm = useCallback(
    (grooveDepthMm: number) => write({ grooveDepthMm }),
    [write]
  );

  const meta: SectionMeta = {
    // Height in mm rather than units: only the companion snaps to whole height
    // units, so units would describe the integrated shelf's saddle wrongly.
    summary:
      enabled && plan
        ? t('binDesigner.knifeRest.summary', {
            style: t(`binDesigner.knifeRest.style.${style}`),
            height: Math.round(plan.bodyTopZMm),
          })
        : undefined,
    disabledReason: plan === null ? t('binDesigner.knifeRest.needsSlots') : undefined,
  };

  return {
    state: {
      enabled,
      style,
      gapMm: rest?.gapMm ?? KNIFE_REST_DEFAULT_GAP_MM,
      depthU: rest?.depthU ?? DEFAULT_DEPTH_U,
      grooveDepthMm: rest?.grooveDepthMm ?? KNIFE_REST_GROOVE_DEPTH_MM,
    },
    meta,
    handlers: { toggle, setStyle, setGapMm, setDepthU, setGrooveDepthMm },
  };
}
