import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import { toolSetOf } from './toolSetOf';

export interface ToolSetEditButtonProps {
  /** The selected cutouts; the button shows when all of them sit in one tool set. */
  readonly selected: readonly Cutout[];
  readonly disabled?: boolean;
}

/** "Edit set" for a selected tool set, or any of its pockets, which reopens its generator. */
export function ToolSetEditButton({ selected, disabled }: ToolSetEditButtonProps) {
  const t = useTranslation();
  const setId = useDesignerStore((s) => toolSetOf(selected, s.params.cutoutToolSets));
  const openToolSetDialog = useDesignerStore((s) => s.openToolSetDialog);
  if (setId === null) return null;
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="w-full"
      disabled={disabled}
      onClick={() => openToolSetDialog(setId)}
    >
      {t('binDesigner.toolSets.edit')}
    </Button>
  );
}
