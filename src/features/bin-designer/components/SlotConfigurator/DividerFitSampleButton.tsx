import { SampleExportButton } from '@/shared/components/SampleExportButton';
import { useTranslation } from '@/i18n';
import {
  useDividerFitSampleExport,
  DIVIDER_FIT_SAMPLE_BASE_NAME,
} from '../../hooks/useDividerFitSampleExport';

export function DividerFitSampleButton() {
  const t = useTranslation();
  const sample = useDividerFitSampleExport();
  return (
    <SampleExportButton
      {...sample}
      defaultBaseName={DIVIDER_FIT_SAMPLE_BASE_NAME}
      label={t('binDesigner.dividerFitSample.button')}
      dialogTitle={t('binDesigner.dividerFitSample.dialogTitle')}
      dialogDescription={t('binDesigner.dividerFitSample.dialogDescription')}
      exportCompleteMessage={t('binDesigner.dividerFitSample.exportComplete')}
      tips={{
        title: t('binDesigner.dividerFitSample.tipsTitle'),
        items: [
          t('binDesigner.dividerFitSample.tip1'),
          t('binDesigner.dividerFitSample.tip2'),
          t('binDesigner.dividerFitSample.tip3'),
        ],
      }}
    />
  );
}
