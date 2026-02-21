/**
 * Dialog shown when a bin resize has been pushed to an open designer session.
 *
 * Informs the user that the designer's dimensions were updated to match the
 * resized bin, with an option to navigate to the designer to review.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Dialog, Button, InfoIcon } from '@/design-system';
import { useLinkingStore } from '../../../store';
import { useBinLinking } from '../../../hooks';
import { useTranslation } from '@/i18n';

export function DesignerUpdatedDialog() {
  const t = useTranslation();
  const { pendingDesignerUpdated, hideDesignerUpdatedDialog } = useLinkingStore(
    useShallow((s) => ({
      pendingDesignerUpdated: s.pendingDesignerUpdated,
      hideDesignerUpdatedDialog: s.hideDesignerUpdatedDialog,
    }))
  );
  const { editLinkedDesign } = useBinLinking();

  const handleGoToDesigner = useCallback(() => {
    if (!pendingDesignerUpdated) return;
    hideDesignerUpdatedDialog();
    editLinkedDesign(pendingDesignerUpdated.designId);
  }, [pendingDesignerUpdated, hideDesignerUpdatedDialog, editLinkedDesign]);

  return (
    <Dialog.Root
      open={pendingDesignerUpdated !== null}
      onClose={hideDesignerUpdatedDialog}
      size="sm"
    >
      <Dialog.Header title={t('designLinking.designerUpdated.title')} showCloseButton={false}>
        <InfoIcon size="sm" className="text-status-info" />
      </Dialog.Header>
      <Dialog.Body>
        <p className="text-sm text-content-secondary">
          {t('designLinking.designerUpdated.description', {
            name: pendingDesignerUpdated?.designName ?? '',
          })}
        </p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={hideDesignerUpdatedDialog}>
          {t('common.dismiss')}
        </Button>
        <Button variant="primary" onClick={handleGoToDesigner}>
          {t('designLinking.inspector.editDesign')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
