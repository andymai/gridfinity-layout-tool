import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/design-system';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Restore focus to the element that was focused before the dialog opened
  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current && previousFocusRef.current.isConnected) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Save the currently focused element before opening
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the cancel button when dialog opens
    cancelButtonRef.current?.focus();

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    // Focus trap
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTab);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTab);
      restoreFocus();
    };
  }, [isOpen, onCancel, restoreFocus]);

  if (!isOpen) return null;

  // Use portal to escape parent stacking contexts (e.g., BottomSheet with transform)
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in bg-overlay-dark"
      onClick={onCancel}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        className="max-w-md w-full mx-4 animate-scale-in bg-surface-secondary border border-stroke rounded-[var(--radius-xl)] p-[var(--space-2xl)]"
        style={{
          boxShadow: 'var(--shadow-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title" className="mb-2 text-xl font-semibold text-content">
          {title}
        </h2>
        <p id="dialog-description" className="mb-6 text-sm text-content-secondary leading-[1.5]">
          {message}
        </p>

        <div className="flex gap-3 justify-end">
          <Button ref={cancelButtonRef} variant="secondary" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
