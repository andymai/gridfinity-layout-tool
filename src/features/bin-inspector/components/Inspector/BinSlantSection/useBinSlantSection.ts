import { useCallback, useState } from 'react';
import { batch } from '@/core/cqrs';
import { isOk } from '@/core/result';
import { SLANT_MAX_DEG, SLANT_WARN_DEG } from '@/core/types';
import type { Bin, Layout, SlantConfig, SlantSide } from '@/core/types';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useLinkedRiseKey } from '@/shared/hooks/useLinkedRiseKey';
import { linkedDesignSlant, placedSlant, slantHeldUprightBy } from '@/shared/utils/placedSlant';
import { matchRowSlants, slantIssue } from '@/shared/utils/slantRow';

export const SLANT_DEFAULT: SlantConfig = { angleDeg: 45, side: 'back' };
export const SLANT_MIN_DEG = 1;

function withoutSupport({ endSupport: _, ...upright }: SlantConfig): SlantConfig {
  return upright;
}

export function useBinSlantSection(bin: Bin, layout: Layout) {
  const { updateBin } = useMutations();
  const labsOn = useFeatureFlag('slant');
  // A design re-saved with a new slant changes nothing in the layout store.
  useLinkedRiseKey();
  const [refused, setRefused] = useState(false);

  const designSlant = linkedDesignSlant(bin);
  const config = bin.slant ?? designSlant;
  const heldBy = slantHeldUprightBy(bin, layout);
  const issue = slantIssue(bin, layout, placedSlant(bin, layout));

  const write = useCallback(
    (next: SlantConfig | null) => {
      setRefused(!isOk(updateBin(bin.id, { slant: next })));
    },
    [bin.id, updateBin]
  );

  const toggle = useCallback((on: boolean) => write(on ? SLANT_DEFAULT : null), [write]);

  const setAngle = useCallback(
    (deg: number) => {
      if (!config || !Number.isFinite(deg)) return;
      const angleDeg = Math.min(SLANT_MAX_DEG, Math.max(SLANT_MIN_DEG, Math.round(deg)));
      write({ ...config, angleDeg });
    },
    [config, write]
  );

  const setSide = useCallback(
    (side: SlantSide) => {
      if (config) write({ ...config, side });
    },
    [config, write]
  );

  const setEndSupport = useCallback(
    (on: boolean) => {
      if (config) write(on ? { ...config, endSupport: true } : withoutSupport(config));
    },
    [config, write]
  );

  const matchRow = useCallback(() => {
    const slants = matchRowSlants(bin, layout);
    const lead = slants.at(-1);
    if (!lead) return;
    let applied = true;
    batch(() => {
      for (const { id, slant } of slants.slice(0, -1)) {
        applied = isOk(updateBin(id, { slant })) && applied;
      }
      // With no room past the row, it still matches; the detector then asks for room.
      if (!isOk(updateBin(lead.id, { slant: lead.slant }))) {
        applied = isOk(updateBin(lead.id, { slant: withoutSupport(lead.slant) })) && applied;
      }
    });
    setRefused(!applied);
  }, [bin, layout, updateBin]);

  return {
    state: {
      visible: labsOn || config !== undefined,
      config,
      designSlant,
      placed: bin.slant,
      heldBy,
      steep: config !== undefined && config.angleDeg > SLANT_WARN_DEG,
      issue,
      refused,
    },
    handlers: { toggle, setAngle, setSide, setEndSupport, useDesign: () => write(null), matchRow },
  };
}
