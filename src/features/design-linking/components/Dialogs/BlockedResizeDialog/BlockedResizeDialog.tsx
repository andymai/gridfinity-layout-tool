/**
 * Dialog shown when a bin resize can't propagate to its linked design
 * because the design has complex geometry (inserts, cutouts, custom compartments).
 *
 * The layout bin is already resized -- this dialog just informs the user
 * that the design was not updated and offers to navigate to the designer.
 */

import { useCallback } from 'react';
import { Dialog, Button, AlertTriangleIcon } from '@/design-system';
import { useLinkingStore } from '../../../store';
import { useBinLinking } from '../../../hooks';
import { useTranslation } from '@/i18n';
import type { ComplexityReason } from '../../../domain/complexGeometry';

const REASON_KEYS: Record<ComplexityReason, string> = {
  inserts: 'designLinking.blockedResize.reasons.inserts',
  cutouts: 'designLinking.blockedResize.reasons.cutouts',
  'non-default-compartments': 'designLinking.blockedResize.reasons.compartments',
};

export function BlockedResizeDialog() {
  const t = useTranslation();
  const { pendingBlockedResize, hideBlockedResizeDialog } = useLinkingStore();
  const { editLinkedDesign } = useBinLinking();

  const handleDismiss = useCallback(() => {
    hideBlockedResizeDialog();
  }, [hideBlockedResizeDialog]);

  const handleEditDesign = useCallback(() => {
    if (!pendingBlockedResize) return;
    hideBlockedResizeDialog();
    editLinkedDesign(pendingBlockedResize.designId);
  }, [pendingBlockedResize, hideBlockedResizeDialog, editLinkedDesign]);

  return (
    <Dialog.Root open={pendingBlockedResize !== null} onClose={handleDismiss} size="sm">
      <Dialog.Header title={t('designLinking.blockedResize.title')} showCloseButton={false}>
        <AlertTriangleIcon size="sm" className="text-status-warning" />
      </Dialog.Header>
      <Dialog.Body>
        <p className="mb-3 text-sm text-content-secondary">
          {t('designLinking.blockedResize.description', {
            name: pendingBlockedResize?.designName ?? '',
          })}
        </p>

        {/* Complexity reasons */}
        <div className="p-2.5 bg-surface rounded-lg border border-stroke-subtle space-y-1">
          {pendingBlockedResize?.reasons.map((reason) => (
            <div key={reason} className="flex items-center gap-2 text-sm text-content-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-status-warning flex-shrink-0" />
              {t(REASON_KEYS[reason])}
            </div>
          ))}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={handleDismiss}>
          {t('common.dismiss')}
        </Button>
        <Button variant="primary" onClick={handleEditDesign}>
          {t('designLinking.inspector.editDesign')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
