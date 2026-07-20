import { useState } from 'react';
import { Dialog, Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { TagInput } from '../TagInput';

interface TagEditDialogProps {
  open: boolean;
  title: string;
  initialTags: readonly string[];
  saveLabel: string;
  /** Tags already in use across all designs, offered as one-click suggestions. */
  suggestions?: readonly string[];
  onSave: (tags: string[]) => void;
  onClose: () => void;
}

/** Modal for editing a tag set — used for a single design and for bulk tagging. */
export function TagEditDialog({
  open,
  title,
  initialTags,
  saveLabel,
  suggestions,
  onSave,
  onClose,
}: TagEditDialogProps) {
  const t = useTranslation();
  // Mounted on demand by the parent (keyed per open), so useState seeds the
  // editor once per open — no reseed effect needed.
  const [tags, setTags] = useState<readonly string[]>(initialTags);

  if (!open) return null;

  const handleSave = () => {
    onSave([...tags]);
    onClose();
  };

  return (
    <Dialog.Root open={open} onClose={onClose} size="sm">
      <Dialog.Header title={title} closeAriaLabel={t('common.closeDialog')} />
      <Dialog.Body>
        <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSave}>
          {saveLabel}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
