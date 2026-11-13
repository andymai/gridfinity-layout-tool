import { SegmentedControl } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { PaperChoice } from '../../paperChoice';

export interface PaperSizeSwitchProps {
  readonly value: PaperChoice;
  readonly onChange: (choice: PaperChoice) => void;
  readonly size?: 'sm' | 'md';
}

/** The sheet the scan took its scale from, for the user to correct or rule out. */
export function PaperSizeSwitch({ value, onChange, size = 'md' }: PaperSizeSwitchProps) {
  const t = useTranslation();
  return (
    <div className="flex w-full flex-col gap-1">
      <SegmentedControl
        aria-label={t('binDesigner.cutouts.traceView.paper.size')}
        size={size}
        fullWidth
        value={value}
        onChange={onChange}
        options={[
          { value: 'a4', label: t('binDesigner.cutouts.traceView.paper.a4') },
          { value: 'letter', label: t('binDesigner.cutouts.traceView.paper.letter') },
          { value: 'off', label: t('scan.paper.notPaper') },
        ]}
      />
      {value !== 'off' && <p className="text-xs text-content-tertiary">{t('scan.paper.hint')}</p>}
    </div>
  );
}
