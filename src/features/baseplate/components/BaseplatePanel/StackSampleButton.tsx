/**
 * "Print fit sample" control for the vertical-stack section.
 *
 * Opens the shared ExportDialog to download a single stack of two 1×1 plates so
 * makers can dial in the air-gap separation before printing a full stack. STEP
 * is disabled — stacking is a print arrangement, not a CAD interchange concept.
 */

import { LayoutGridIcon } from '@/design-system/Icon';
import { SampleExportButton } from '@/shared/components/SampleExportButton';
import { useTranslation } from '@/i18n';
import { useStackSampleExport, STACK_SAMPLE_BASE_NAME } from '../../hooks/useStackSampleExport';

export function StackSampleButton() {
  const t = useTranslation();
  const sample = useStackSampleExport();
  return (
    <SampleExportButton
      {...sample}
      defaultBaseName={STACK_SAMPLE_BASE_NAME}
      label={t('baseplate.stackPrint.sampleButton')}
      leftIcon={<LayoutGridIcon className="h-4 w-4" />}
      dialogTitle={t('baseplate.stackPrint.sampleTitle')}
      dialogDescription={t('baseplate.stackPrint.sampleDescription')}
      exportCompleteMessage={t('baseplate.stackPrint.sampleExportComplete')}
      formatStates={{ step: { disabled: true } }}
    />
  );
}
