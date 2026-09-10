/**
 * "Print fit test" control for the sliding tray.
 *
 * Opens the shared ExportDialog to download a one-file calibration card: five
 * rail stubs across a clearance ladder plus one tray stub that runs in all of
 * them. The rung the stub slides best in names the clearance to enter above.
 *
 * The rungs are ordered rather than labelled, so the tips explain how to read
 * the card. Embossing five numbers would smear on a 0.4mm nozzle, which is the
 * nozzle most of these will be printed on.
 */

import { SampleExportButton } from '@/shared/components/SampleExportButton';
import { useTranslation } from '@/i18n';
import {
  useSlideFitSampleExport,
  SLIDE_FIT_SAMPLE_BASE_NAME,
} from '../../../hooks/useSlideFitSampleExport';

export function SlideFitSampleButton() {
  const t = useTranslation();
  const sample = useSlideFitSampleExport();
  return (
    <SampleExportButton
      {...sample}
      defaultBaseName={SLIDE_FIT_SAMPLE_BASE_NAME}
      label={t('binDesigner.slideTray.fitSample.button')}
      dialogTitle={t('binDesigner.slideTray.fitSample.dialogTitle')}
      dialogDescription={t('binDesigner.slideTray.fitSample.dialogDescription')}
      exportCompleteMessage={t('binDesigner.slideTray.fitSample.exportComplete')}
      tips={{
        title: t('binDesigner.slideTray.fitSample.tipsTitle'),
        items: [
          t('binDesigner.slideTray.fitSample.tip1'),
          t('binDesigner.slideTray.fitSample.tip2'),
          t('binDesigner.slideTray.fitSample.tip3'),
        ],
      }}
    />
  );
}
