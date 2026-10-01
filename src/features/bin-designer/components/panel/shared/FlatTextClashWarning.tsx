import { useMemo } from 'react';
import { Button, InfoIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  contrastingTextColor,
  hiddenFlatTextSurfaces,
  type TextSurface,
} from '@/features/bin-designer/utils/flatTextContrast';

interface FlatTextClashWarningProps {
  /** Narrows the check to these surfaces; omit to check every flat caption. */
  readonly surfaces?: readonly TextSurface[];
}

/** Says when flat letters would vanish into their surface, and offers a colour that shows. */
export function FlatTextClashWarning({ surfaces }: FlatTextClashWarningProps) {
  const t = useTranslation();
  const params = useDesignerStore((s) => s.params);
  const updateFeatureColors = useDesignerStore((s) => s.updateFeatureColors);
  const hidden = useMemo(() => hiddenFlatTextSurfaces(params, surfaces), [params, surfaces]);
  if (hidden.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="flex items-start gap-1 text-label leading-relaxed text-warning">
        <InfoIcon size="xs" className="mt-0.5 shrink-0" />
        <span>{t('binDesigner.textColor.hidden')}</span>
      </p>
      <Button
        type="button"
        variant="ghost"
        onClick={() => updateFeatureColors({ text: contrastingTextColor(params, hidden) })}
        className="h-auto rounded border border-stroke-subtle bg-surface-elevated px-1.5 py-0.5 text-micro font-medium text-content-secondary hover:bg-surface-hover"
      >
        {t('binDesigner.textColor.useContrasting')}
      </Button>
    </div>
  );
}
