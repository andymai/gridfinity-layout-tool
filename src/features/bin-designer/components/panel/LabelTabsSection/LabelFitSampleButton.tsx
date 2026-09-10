/**
 * "Print fit test" control for socket-mode label tabs.
 *
 * Opens the shared ExportDialog to download a one-file calibration card:
 * five 1U sockets across a fit-offset ladder plus a nominal reference plate.
 * The best-clicking coupon's embossed offset is the value to enter in the
 * fit-offset field above.
 */

import { SampleExportButton } from '@/shared/components/SampleExportButton';
import { useTranslation } from '@/i18n';
import {
  useLabelFitSampleExport,
  LABEL_FIT_SAMPLE_BASE_NAME,
} from '../../../hooks/useLabelFitSampleExport';

export function LabelFitSampleButton() {
  const t = useTranslation();
  const sample = useLabelFitSampleExport();
  return (
    <SampleExportButton
      {...sample}
      defaultBaseName={LABEL_FIT_SAMPLE_BASE_NAME}
      label={t('binDesigner.fitSample.button')}
      dialogTitle={t('binDesigner.fitSample.dialogTitle')}
      dialogDescription={t('binDesigner.fitSample.dialogDescription')}
      exportCompleteMessage={t('binDesigner.fitSample.exportComplete')}
      tips={{
        title: t('binDesigner.fitSample.tipsTitle'),
        items: [
          t('binDesigner.fitSample.tip1'),
          t('binDesigner.fitSample.tip2'),
          t('binDesigner.fitSample.tip3'),
        ],
      }}
    />
  );
}
