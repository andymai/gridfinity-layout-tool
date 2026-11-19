import { useState } from 'react';
import { useToastStore } from '@/core/store';
import { trackEvent } from '@/shared/analytics/posthog';
import { primeExportFolder } from '@/shared/exportDestination/exportFolder';
import { useTranslation } from '@/i18n';
import { useLabelListStore } from '../store/labelListStore';
import { downloadLabels } from '../utils/downloadLabels';
import { useLabelPlans } from './useLabelPlans';
import type { LabelPlans } from './useLabelPlans';

export interface LabelsWorkspace extends LabelPlans {
  readonly hasEntries: boolean;
  readonly skipped: number;
  readonly printable: number;
  readonly busy: boolean;
  readonly download: () => Promise<void>;
}

export function useLabelsWorkspace(): LabelsWorkspace {
  const t = useTranslation();
  const entries = useLabelListStore((state) => state.entries);
  const plans = useLabelPlans();
  const [busy, setBusy] = useState(false);

  const { printer, media, measurer } = plans;
  const skipped = entries.filter(
    (entry) => (plans.plans.get(entry.id)?.problem ?? null) !== null
  ).length;

  const download = async (): Promise<void> => {
    if (measurer === null) return;
    primeExportFolder();
    setBusy(true);
    try {
      const saved = await downloadLabels(entries, plans.plans, measurer, printer, media);
      if (saved > 0) {
        trackEvent('labels_downloaded', { printer: printer.id, media: media.id, labels: saved });
      }
    } catch {
      useToastStore.getState().addToast(t('labels.downloadFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return {
    ...plans,
    hasEntries: entries.length > 0,
    skipped,
    printable: measurer === null ? 0 : entries.length - skipped,
    busy,
    download,
  };
}
