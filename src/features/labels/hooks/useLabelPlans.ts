import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTypeMeasurer } from '@/shared/hooks/useTypeMeasurer';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import { useLabelListStore } from '../store/labelListStore';
import { LABEL_PRINTERS, labelBoxFor, resolveLabelMedia } from '../utils/labelMedia';
import type { LabelMedia, LabelPrinter } from '../utils/labelMedia';
import { LABEL_DETAIL_FONT, LABEL_NAME_FONT, planLabel } from '../utils/planLabel';
import type { LabelPlan } from '../utils/planLabel';

const LABEL_FONTS = [LABEL_NAME_FONT, LABEL_DETAIL_FONT] as const;

export interface LabelPlans {
  readonly printer: LabelPrinter;
  readonly media: LabelMedia;
  /** Null until both faces have loaded. */
  readonly measurer: TypeMeasurer | null;
  readonly plans: ReadonlyMap<string, LabelPlan>;
}

/** Plan every label in the list for the chosen printer and media. */
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
  const printer = LABEL_PRINTERS[printerId];
  const media = resolveLabelMedia(printer, mediaId);

  const plans = useMemo(() => {
    const planned = new Map<string, LabelPlan>();
    if (measurer === null) return planned;
    const box = labelBoxFor(printer, media, tapeLength);
    for (const entry of entries) planned.set(entry.id, planLabel(entry, box, measurer));
    return planned;
  }, [entries, measurer, printer, media, tapeLength]);

  return { printer, media, measurer, plans };
}
