import { useTranslation } from '@/i18n';
import { jumpToDesignerControl } from '@/features/bin-designer/settingsManifest';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DependencyHint } from './DependencyHint';

/** Flat text is a colour change and nothing else, so it always points at the colours. */
export function FlatTextHint() {
  const t = useTranslation();
  const multiColor = useDesignerStore((s) => s.params.featureColors.enabled);
  return (
    <DependencyHint
      reason={t(
        multiColor ? 'binDesigner.textMode.flatHint' : 'binDesigner.textMode.flatNeedsMultiColor'
      )}
      actionLabel={t('binDesigner.textMode.flatColorsAction')}
      onAction={() => jumpToDesignerControl('bd-colors')}
    />
  );
}
