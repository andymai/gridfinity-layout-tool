import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';

export interface ToolSetEditButtonProps {
  /** The selected group's id; renders nothing unless it is a tool set. */
  readonly groupId: string;
  readonly disabled?: boolean;
}

/** "Edit set" for a selected tool set, which reopens its generator. */
export function ToolSetEditButton({ groupId, disabled }: ToolSetEditButtonProps) {
  const t = useTranslation();
  const isSet = useDesignerStore((s) => s.params.cutoutToolSets?.[groupId] !== undefined);
  const openToolSetDialog = useDesignerStore((s) => s.openToolSetDialog);
  if (!isSet) return null;
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="w-full"
      disabled={disabled}
      onClick={() => openToolSetDialog(groupId)}
    >
      {t('binDesigner.toolSets.edit')}
    </Button>
  );
}
