import { useShallow } from 'zustand/react/shallow';
import { SegmentedControl, Select } from '@/design-system';
import { FieldLabel, Hint } from '@/shared/components/PanelText';
import { useTranslation } from '@/i18n';
import { useLabelListStore } from '../../store/labelListStore';
import {
  LABEL_PRINTER_IDS,
  LABEL_PRINTERS,
  TAPE_LENGTHS,
  isLabelPrinterId,
  resolveLabelMedia,
} from '../../utils/labelMedia';

export function LabelPrinterSettings() {
  const t = useTranslation();
  const { printerId, mediaId, tapeLength, setPrinter, setMediaId, setTapeLength } =
    useLabelListStore(
      useShallow((state) => ({
        printerId: state.printerId,
        mediaId: state.mediaId,
        tapeLength: state.tapeLength,
        setPrinter: state.setPrinter,
        setMediaId: state.setMediaId,
        setTapeLength: state.setTapeLength,
      }))
    );
  const printer = LABEL_PRINTERS[printerId];
  const media = resolveLabelMedia(printer, mediaId);

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>{t('labels.printer')}</FieldLabel>
        <Select
          fullWidth
          aria-label={t('labels.printer')}
          value={printerId}
          onValueChange={(value) => {
            if (isLabelPrinterId(value)) setPrinter(value, LABEL_PRINTERS[value].defaultMediaId);
          }}
          options={LABEL_PRINTER_IDS.map((id) => ({ id, name: t(`labels.printer.${id}`) }))}
        />
      </div>

      <div>
        <FieldLabel>{t('labels.media')}</FieldLabel>
        <Select
          fullWidth
          aria-label={t('labels.media')}
          value={media.id}
          onValueChange={setMediaId}
          options={printer.media.map((option) => ({
            id: option.id,
            name:
              option.lengthMm === undefined
                ? t('labels.media.tape', { width: option.widthMm })
                : t('labels.media.dieCut', { width: option.widthMm, length: option.lengthMm }),
          }))}
        />
      </div>

      {printer.kind === 'tape' && (
        <div>
          <FieldLabel>{t('labels.length')}</FieldLabel>
          <SegmentedControl
            fullWidth
            size="sm"
            aria-label={t('labels.length')}
            value={String(tapeLength)}
            onChange={(value) => {
              const next = TAPE_LENGTHS.find((length) => String(length) === value);
              if (next !== undefined) setTapeLength(next);
            }}
            options={TAPE_LENGTHS.map((length) => ({
              value: String(length),
              label: length === 'fit' ? t('labels.length.fit') : `${length}U`,
            }))}
          />
          <div className="mt-1.5">
            <Hint>{t('labels.length.hint')}</Hint>
          </div>
        </div>
      )}

      <Hint>{t('labels.howTo')}</Hint>
    </div>
  );
}
