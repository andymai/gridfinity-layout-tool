import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import { partsOf } from '../panel/CutoutsSection/toolSets/planToolSetPlacement';
import { toolSetOf } from './toolSetOf';

export interface ToolSetEditButtonProps {
  /** The selected cutouts; the button shows when all of them sit in one tool set. */
  readonly selected: readonly Cutout[];
  readonly disabled?: boolean;
}

/**
 * "Edit set" for a selected tool set, or any of its pockets. Bin only: the
 * dialog rebuilds into the bin, so a set pasted into the lid has nothing to
 * rebuild there.
 */
export function ToolSetEditButton({ selected, disabled }: ToolSetEditButtonProps) {
  const t = useTranslation();
  const onLid = useDesignerStore((s) => s.ui.cutoutTarget === 'lid');
  const setId = useDesignerStore((s) => toolSetOf(selected, s.params.cutoutToolSets));
  const locked = useDesignerStore(
    (s) =>
      setId !== null &&
      partsOf(s.params.cutouts, setId, s.params.cutoutToolSets).some((c) => c.locked === true)
  );
  const openToolSetDialog = useDesignerStore((s) => s.openToolSetDialog);
  if (setId === null || onLid) return null;
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={disabled === true || locked}
        onClick={() => openToolSetDialog(setId)}
      >
        {t('binDesigner.toolSets.edit')}
      </Button>
      {locked && (
        <p className="text-micro text-content-tertiary">{t('binDesigner.toolSets.locked')}</p>
      )}
    </div>
  );
}
