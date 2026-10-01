import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { TextMode } from '@/features/bin-designer/types';
import { textModeChoices } from '@/features/bin-designer/utils/textModeChoices';
import { SegmentGrid } from './SegmentGrid';

interface TextFinishGridProps {
  /** The finishes this host builds; Flat is appended for a multi-colour design. */
  readonly modes: readonly TextMode[];
  readonly value: TextMode;
  readonly onChange: (mode: TextMode) => void;
  readonly disabled?: boolean;
}

/** The finish picker every text host shares, laid out in a grid so no label wraps. */
export function TextFinishGrid({ modes, value, onChange, disabled = false }: TextFinishGridProps) {
  const t = useTranslation();
  const multiColor = useDesignerStore((s) => s.params.featureColors.enabled);
  const choices = textModeChoices(modes, multiColor, value);
  return (
    <SegmentGrid
      aria-label={t('binDesigner.textMode')}
      value={value}
      onChange={onChange}
      columns={choices.length === 3 ? 3 : 2}
      options={choices.map((mode) => ({
        value: mode,
        label: t(`binDesigner.textMode.${mode}`),
        disabled,
      }))}
    />
  );
}
