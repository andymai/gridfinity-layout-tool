/**
 * Print-report dialog: post or edit the caller's own print for one design.
 *
 * Mounted by the detail overlay rather than at app level, because unlike
 * publishing there is no cross-feature handoff: everything it needs is the
 * design id and the caller's session.
 */

import { useState } from 'react';
import { Button, ConfirmDialog, Dialog, Spinner } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { signInUrl } from '@/core/sync/session/sessionApi';
import type { AuthProvider } from '@/core/sync/session/sessionApi';
import { trackEvent } from '@/shared/analytics/posthog';
import type { CommunityPrint } from '@/shared/types/communityPrint';
import { COMMUNITY_PRINTER_OTHER } from '@/shared/types/communityPrinters';
import type { CommunityClientError } from '../../api/client';
import { deletePrint, savePrint } from '../../api/printsClient';
import type { CommunityPrintInput } from '../../api/printsClient';
import {
  draftPrintMinutes,
  hasPrintDraftIssues,
  usePrintDialogStore,
  validatePrintDraft,
} from '../../store/printDialogStore';
import type { PrintDraft, PrintDraftIssues } from '../../store/printDialogStore';
import { saveDisplayName } from '../../utils/displayName';
import { PrintForm } from './PrintForm';

export interface PrintDialogProps {
  /** Fired after a successful write so the host can refresh its list and count. */
  onSaved: (print: CommunityPrint, count: number) => void;
  onDeleted: (count: number) => void;
}

const ERROR_KEYS: Partial<Record<CommunityClientError['kind'], string>> = {
  disabled: 'community.print.error.disabled',
  rateLimited: 'community.print.error.rateLimited',
  forbidden: 'community.print.error.forbidden',
  notFound: 'community.print.error.notFound',
  contentBlocked: 'community.print.error.blocked',
};

function errorMessageKey(error: CommunityClientError): string {
  return ERROR_KEYS[error.kind] ?? 'community.print.error.generic';
}

function toNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Optional measurements only mean something above zero, and the server's floor
 * is 0.1, so a typed 0 or -5 is an unset field rather than a value worth a
 * round trip to have rejected.
 */
function toPositiveNumber(value: string): number | null {
  const parsed = toNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function toInput(
  draft: PrintDraft,
  displayName: string,
  photos: readonly { url: string }[]
): CommunityPrintInput | null {
  const printMinutes = draftPrintMinutes(draft);
  const nozzleMm = toNumber(draft.nozzleMm);
  const layerHeightMm = toNumber(draft.layerHeightMm);
  if (printMinutes === null || nozzleMm === null || layerHeightMm === null) return null;
  if (draft.fitVerdict === null) return null;
  return {
    authorName: displayName.trim(),
    material: draft.material,
    nozzleMm,
    layerHeightMm,
    printMinutes,
    filamentGrams: toPositiveNumber(draft.filamentGrams),
    printer: draft.printer,
    ...(draft.printer === COMMUNITY_PRINTER_OTHER && {
      printerOther: draft.printerOther.trim(),
    }),
    fitVerdict: draft.fitVerdict,
    note: draft.note.trim(),
    // Kept URLs and new data URLs travel in one ordered array; the server
    // classifies each and verifies a kept URL belongs to this record.
    photos: photos.map((photo) => photo.url),
  };
}

function goTo(url: string): void {
  if (typeof window !== 'undefined') window.location.href = url;
}

/**
 * Closed is genuinely unmounted rather than hidden: `issues`, the delete
 * confirmation and its busy flag are local state, and a component that merely
 * returns null keeps all three across a close and reopen (stale validation
 * errors, or a delete confirmation from a previous session reappearing).
 */
export function PrintDialog(props: PrintDialogProps) {
  const phase = usePrintDialogStore((s) => s.phase);
  if (phase === 'closed') return null;
  return <PrintDialogOpen {...props} />;
}

function PrintDialogOpen({ onSaved, onDeleted }: PrintDialogProps) {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const phase = usePrintDialogStore((s) => s.phase);
  const mode = usePrintDialogStore((s) => s.mode);
  const designId = usePrintDialogStore((s) => s.designId);
  const designName = usePrintDialogStore((s) => s.designName);
  const draft = usePrintDialogStore((s) => s.draft);
  const displayName = usePrintDialogStore((s) => s.displayName);
  const photos = usePrintDialogStore((s) => s.photos);
  const photoError = usePrintDialogStore((s) => s.photoError);
  const error = usePrintDialogStore((s) => s.error);
  const setDraft = usePrintDialogStore((s) => s.setDraft);
  const setDisplayName = usePrintDialogStore((s) => s.setDisplayName);
  const addPhoto = usePrintDialogStore((s) => s.addPhoto);
  const removePhoto = usePrintDialogStore((s) => s.removePhoto);
  const setPhotoError = usePrintDialogStore((s) => s.setPhotoError);
  const beginSaving = usePrintDialogStore((s) => s.beginSaving);
  const fail = usePrintDialogStore((s) => s.fail);
  const backToForm = usePrintDialogStore((s) => s.backToForm);
  const reset = usePrintDialogStore((s) => s.reset);

  const [issues, setIssues] = useState<PrintDraftIssues>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const saving = phase === 'saving';
  const busy = saving || deleteBusy;

  const handleSignIn = (provider: AuthProvider) => {
    goTo(signInUrl(provider));
  };

  const handleSubmit = () => {
    const found = validatePrintDraft(draft, displayName);
    setIssues(found);
    if (hasPrintDraftIssues(found)) return;

    const input = toInput(draft, displayName, photos);
    if (input === null) return;

    beginSaving();
    saveDisplayName(input.authorName);
    void savePrint(designId, input).then((result) => {
      if (isOk(result)) {
        trackEvent('community_print_saved', {
          mode,
          fit_verdict: input.fitVerdict,
          photos: input.photos.length,
        });
        addToast(
          t(mode === 'create' ? 'community.print.toast.saved' : 'community.print.toast.updated'),
          'success'
        );
        onSaved(result.value.print, result.value.count);
        reset();
        return;
      }
      // A 401 mid-flow means the session lapsed while the form was open;
      // sending them back to the sign-in step keeps the draft alive.
      if (result.error.kind === 'needsAuth') {
        usePrintDialogStore.setState({ phase: 'signin' });
        return;
      }
      fail(result.error);
    });
  };

  const handleDelete = () => {
    setConfirmDelete(false);
    setDeleteBusy(true);
    void deletePrint(designId)
      .then((result) => {
        if (isOk(result)) {
          trackEvent('community_print_deleted', {});
          addToast(t('community.print.toast.deleted'), 'info');
          onDeleted(result.value.count);
          reset();
          return;
        }
        addToast(t(errorMessageKey(result.error)), 'error');
      })
      .finally(() => setDeleteBusy(false));
  };

  const title = t(mode === 'create' ? 'community.print.addTitle' : 'community.print.editTitle');

  return (
    <>
      <Dialog.Root
        open
        onClose={reset}
        size="lg"
        // `fullScreen` and `mobilePresentation` are mutually exclusive mobile
        // layouts: together they emit both `rounded-none` and `rounded-t-2xl`,
        // which tailwind-merge keeps, leaving stylesheet order to pick the
        // corners of a full-height box pinned to the bottom. A long form wants
        // the whole screen, so this keeps `fullScreen` and drops the sheet.
        fullScreen="mobile"
        dismissable={!busy}
      >
        <Dialog.Header title={title} bordered closeAriaLabel={t('common.closeDialog')} />

        {phase === 'signin' && (
          <Dialog.Body>
            <div className="space-y-4">
              <p className="text-sm text-content-secondary">{t('community.print.signinMessage')}</p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  className="min-h-11 md:min-h-0"
                  onClick={() => handleSignIn('google')}
                >
                  {t('auth.providerGoogle')}
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-11 md:min-h-0"
                  onClick={() => handleSignIn('github')}
                >
                  {t('auth.providerGithub')}
                </Button>
              </div>
            </div>
          </Dialog.Body>
        )}

        {(phase === 'form' || phase === 'saving' || phase === 'error') && (
          <>
            <Dialog.Body>
              <p className="mb-4 text-sm text-content-secondary">
                {t('community.print.subtitle', { design: designName })}
              </p>

              {phase === 'error' && error !== null && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-content-secondary"
                  data-testid="print-dialog-error"
                >
                  {t(errorMessageKey(error))}
                </p>
              )}

              <PrintForm
                draft={draft}
                displayName={displayName}
                photos={photos}
                photoError={photoError}
                issues={issues}
                disabled={busy}
                onDraftChange={(patch) => {
                  setDraft(patch);
                  if (phase === 'error') backToForm();
                }}
                onDisplayNameChange={setDisplayName}
                onAddPhoto={addPhoto}
                onRemovePhoto={removePhoto}
                onPhotoError={setPhotoError}
              />
            </Dialog.Body>

            <Dialog.Footer bordered>
              <div className="flex w-full items-center justify-between gap-2">
                {mode === 'edit' ? (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                    className="min-h-11 text-error md:min-h-0"
                    data-testid="print-dialog-delete"
                  >
                    {t('community.print.delete')}
                  </Button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={reset}
                    className="min-h-11 md:min-h-0"
                  >
                    {t('community.print.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={handleSubmit}
                    className="min-h-11 md:min-h-0"
                    data-testid="print-dialog-submit"
                  >
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner size="sm" />
                        {t('community.print.saving')}
                      </span>
                    ) : (
                      t(mode === 'create' ? 'community.print.save' : 'community.print.saveEdit')
                    )}
                  </Button>
                </div>
              </div>
            </Dialog.Footer>
          </>
        )}
      </Dialog.Root>

      <ConfirmDialog
        isOpen={confirmDelete}
        title={t('community.print.delete')}
        message={t('community.print.deleteConfirm')}
        confirmText={t('community.print.delete')}
        cancelText={t('community.print.cancel')}
        destructive
        busy={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
