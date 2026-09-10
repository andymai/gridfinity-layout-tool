/**
 * "Print fit sample" control for the baseplate connector section.
 *
 * Opens the shared ExportDialog to download a one-file calibration tray that
 * sweeps the selected connector style across a fit-offset ladder, so makers can
 * dial in the fit that clicks before committing to a full split baseplate.
 */

import { LayoutGridIcon } from '@/design-system/Icon';
import { SampleExportButton } from '@/shared/components/SampleExportButton';
import { useTranslation } from '@/i18n';
import {
  useConnectorSampleExport,
  CONNECTOR_SAMPLE_BASE_NAME,
} from '../../hooks/useConnectorSampleExport';

export function ConnectorSampleButton() {
  const t = useTranslation();
  const sample = useConnectorSampleExport();
  return (
    <SampleExportButton
      {...sample}
      defaultBaseName={CONNECTOR_SAMPLE_BASE_NAME}
      label={t('baseplate.connectorSample.button')}
      leftIcon={<LayoutGridIcon className="h-4 w-4" />}
      dialogTitle={t('baseplate.connectorSample.dialogTitle')}
      dialogDescription={t('baseplate.connectorSample.dialogDescription')}
      exportCompleteMessage={t('baseplate.connectorSample.exportComplete')}
      tips={{
        title: t('baseplate.connectorSample.tipsTitle'),
        items: [
          t('baseplate.connectorSample.tip1'),
          t('baseplate.connectorSample.tip2'),
          t('baseplate.connectorSample.tip3'),
          t('baseplate.connectorSample.tip4'),
        ],
      }}
    />
  );
}
