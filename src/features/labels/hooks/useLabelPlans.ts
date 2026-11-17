import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ensureTypeFonts } from '@/shared/fonts/typeFontRegistry';
import { useTypeFontsFailed, useTypeMeasurer } from '@/shared/hooks/useTypeMeasurer';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import { useLabelListStore } from '../store/labelListStore';
import type { LabelEntry } from '../store/labelListStore';
import { LABEL_PRINTERS, labelBoxFor, resolveLabelMedia } from '../utils/labelMedia';
import type { LabelMedia, LabelPrinter } from '../utils/labelMedia';
import { LABEL_DETAIL_FONT, LABEL_NAME_FONT, planLabel } from '../utils/planLabel';
import type { LabelPlan } from '../utils/planLabel';

const LABEL_FONTS = [LABEL_NAME_FONT, LABEL_DETAIL_FONT] as const;

function retryFonts(): void {
  ensureTypeFonts(LABEL_FONTS);
}

export interface LabelPlans {
  readonly printer: LabelPrinter;
  readonly media: LabelMedia;
  readonly measurer: TypeMeasurer | null;
  readonly plans: ReadonlyMap<string, LabelPlan>;
  readonly fontsFailed: boolean;
  readonly retryFonts: () => void;
}

export function useLabelPlans(): LabelPlans {
  const { entries, printerId, mediaId, tapeLength } = useLabelListStore(
    useShallow((state) => ({
      entries: state.entries,
      printerId: state.printerId,
      mediaId: state.mediaId,
      tapeLength: state.tapeLength,
    }))
  );
  const measurer = useTypeMeasurer(LABEL_FONTS);
  const fontsFailed = useTypeFontsFailed(LABEL_FONTS);
  const printer = LABEL_PRINTERS[printerId];
  const media = resolveLabelMedia(printer, mediaId);

  // An edit replaces only its own entry, so plans keyed on the entry object
  // re-plan just that row; a keystroke would otherwise re-plan the whole list.
  const planFor = useMemo(() => {
    if (measurer === null) return null;
    const box = labelBoxFor(printer, media, tapeLength);
    const cache = new WeakMap<LabelEntry, LabelPlan>();
    return (entry: LabelEntry): LabelPlan => {
      let plan = cache.get(entry);
      if (!plan) {
        plan = planLabel(entry, box, measurer);
        cache.set(entry, plan);
      }
      return plan;
    };
  }, [measurer, printer, media, tapeLength]);

  const plans = useMemo(
    () =>
      new Map<string, LabelPlan>(
        planFor === null ? [] : entries.map((entry) => [entry.id, planFor(entry)])
      ),
    [entries, planFor]
  );

  return { printer, media, measurer, plans, fontsFailed, retryFonts };
}
