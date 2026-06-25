import { IconButton } from '@/design-system';
import { XIcon } from '@/design-system/Icon';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { useSelectedElement } from './useSelectedElement';
import { CompartmentSelectionEditor } from './CompartmentSelectionEditor';
import { DividerSelectionEditor } from './DividerSelectionEditor';
import { ColorZoneSelectionEditor } from './ColorZoneSelectionEditor';

export function SelectionEditor() {
  const t = useTranslation();
  const selected = useSelectedElement();
  const clear = useDesignerStore((s) => s.clearInspectorSelection);

  if (!selected) return null;

  return (
    <section
      className="animate-fade-in border-b border-stroke-subtle px-4 py-3"
      aria-label={t('binDesigner.inspector.selection.title')}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
          {t('binDesigner.inspector.selection.title')}
        </span>
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={clear}
          aria-label={t('binDesigner.inspector.selection.clear')}
          title={t('binDesigner.inspector.selection.clear')}
        >
          <XIcon size="sm" />
        </IconButton>
      </div>
      {selected.kind === 'compartment' && <CompartmentSelectionEditor id={selected.id} />}
      {selected.kind === 'divider' && <DividerSelectionEditor />}
      {selected.kind === 'colorZone' && <ColorZoneSelectionEditor zone={selected.zone} />}
    </section>
  );
}
