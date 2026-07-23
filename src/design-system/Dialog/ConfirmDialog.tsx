import { type ReactNode } from 'react';
import { cn } from '../cn';
import { Button } from '../Button';
import { Alert } from '../Alert';
import { intentBackgrounds } from '../variants';
import { DialogHeader, DialogBody, DialogFooter } from './DialogParts';
import { DialogRoot } from './DialogRoot';

// ConfirmDialog (convenience wrapper)

export interface ConfirmDialogProps {
  /**
   * Whether the dialog is open.
   */
  isOpen: boolean;

  /**
   * Dialog title.
   */
  title: string;

  /**
   * Confirmation message body.
   */
  message: string;

  /**
   * Label for the confirm button.
   * @default 'Confirm'
   */
  confirmText?: string;

  /**
   * Label for the cancel button.
   * @default 'Cancel'
   */
  cancelText?: string;

  /**
   * Whether the action is destructive (uses danger variant).
   * @default false
   */
  destructive?: boolean;

  /**
   * Async-in-flight state: spinner on the confirm button, both buttons and
   * all dismissal paths disabled.
   * @default false
   */
  busy?: boolean;

  /**
   * Error line rendered below the message.
   */
  error?: string;

  /**
   * Decorative icon rendered in a tinted circle next to the title.
   */
  icon?: ReactNode;

  /**
   * Called when the user confirms.
   */
  onConfirm: () => void;

  /**
   * Called when the user cancels or closes.
   */
  onCancel: () => void;
}

/**
 * Pre-built confirmation dialog using Dialog compound parts.
 *
 * @example
 * <ConfirmDialog
 *   isOpen={showDelete}
 *   title="Delete Layout"
 *   message="This action cannot be undone."
 *   confirmText="Delete"
 *   destructive
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowDelete(false)}
 * />
 *
 * @example
 * <ConfirmDialog
 *   isOpen={open}
 *   title="Convert layout"
 *   message="Bins will be remapped to the half-grid."
 *   icon={<GridIcon size="md" />}
 *   busy={isRemediating}
 *   error={remediationError}
 *   onConfirm={remediate}
 *   onCancel={close}
 * />
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  busy = false,
  error,
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <DialogRoot open={isOpen} onClose={onCancel} size="md" dismissable={!busy}>
      <DialogHeader
        title={title}
        leading={
          icon ? (
            <div
              aria-hidden="true"
              className={cn(
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                destructive ? intentBackgrounds.error : intentBackgrounds.warning
              )}
            >
              {icon}
            </div>
          ) : undefined
        }
      />
      <DialogBody>
        <p className="text-sm text-content-secondary">{message}</p>
        {error && (
          <Alert intent="error" className="mt-3">
            {error}
          </Alert>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelText}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmText}
        </Button>
      </DialogFooter>
    </DialogRoot>
  );
}
