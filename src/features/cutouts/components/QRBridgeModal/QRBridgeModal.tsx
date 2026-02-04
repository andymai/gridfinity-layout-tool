/**
 * QR Bridge Modal for mobile-to-desktop image transfer.
 *
 * Displays a QR code that mobile devices can scan to upload images
 * which are then received on the desktop for cutout processing.
 */

import { useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useQRBridge } from '../../hooks/useQRBridge';
import { generateQRCodeUrl } from '../../services/qrCodeGenerator';

export interface QRBridgeModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when an image is received from mobile */
  onImageReceived: (imageUrl: string, imageName: string) => void;
}

/**
 * Wrapper that only mounts the inner component when open.
 * This ensures fresh state on each open.
 */
export function QRBridgeModal({ isOpen, onClose, onImageReceived }: QRBridgeModalProps) {
  if (!isOpen) return null;
  return <QRBridgeModalContent onClose={onClose} onImageReceived={onImageReceived} />;
}

function QRBridgeModalContent({ onClose, onImageReceived }: Omit<QRBridgeModalProps, 'isOpen'>) {
  const t = useTranslation();
  const bridge = useQRBridge();

  // Start session on mount
  useEffect(() => {
    void bridge.startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run only on mount
  }, []);

  // Handle received image
  useEffect(() => {
    if (bridge.status === 'ready' && bridge.imageUrl) {
      onImageReceived(bridge.imageUrl, bridge.imageName ?? 'cutout-image');
      onClose();
    }
  }, [bridge.status, bridge.imageUrl, bridge.imageName, onImageReceived, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Cleanup on close
  const handleClose = useCallback(() => {
    void bridge.cancelSession(true);
    onClose();
  }, [bridge, onClose]);

  // Calculate remaining time
  const getRemainingTime = (): string => {
    if (!bridge.expiresAt) return '';
    const remaining = Math.max(0, Math.floor((bridge.expiresAt.getTime() - Date.now()) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 bg-overlay-medium flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-bridge-modal-title"
        className="bg-surface-secondary rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 id="qr-bridge-modal-title" className="text-xl font-bold text-content">
            {t('cutouts.qrBridge.title')}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 -m-2 rounded-md text-content-tertiary hover:text-content hover:bg-surface-hover transition-colors"
            aria-label={t('common.close')}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content based on status */}
        <div className="flex flex-col items-center">
          {bridge.isCreating && <LoadingState message={t('cutouts.qrBridge.creating')} />}

          {bridge.status === 'pending' && bridge.uploadUrl && (
            <PendingState uploadUrl={bridge.uploadUrl} remainingTime={getRemainingTime()} t={t} />
          )}

          {bridge.status === 'error' && (
            <ErrorState
              error={bridge.error ?? t('cutouts.qrBridge.unknownError')}
              onRetry={() => bridge.startSession()}
              t={t}
            />
          )}

          {bridge.status === 'expired' && (
            <ExpiredState onRetry={() => bridge.startSession()} t={t} />
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-center">
          <button onClick={handleClose} className="btn btn-secondary">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading spinner state.
 */
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-content-secondary">{message}</p>
    </div>
  );
}

/**
 * Pending state with QR code.
 */
function PendingState({
  uploadUrl,
  remainingTime,
  t,
}: {
  uploadUrl: string;
  remainingTime: string;
  t: ReturnType<typeof useTranslation>;
}) {
  const qrCodeUrl = generateQRCodeUrl(uploadUrl, 'large');

  return (
    <div className="flex flex-col items-center">
      {/* QR Code */}
      <div className="bg-white p-4 rounded-lg mb-4">
        <img
          src={qrCodeUrl}
          alt={t('cutouts.qrBridge.qrCodeAlt')}
          className="w-[200px] h-[200px]"
        />
      </div>

      {/* Instructions */}
      <p className="text-content-secondary text-center mb-2">
        {t('cutouts.qrBridge.scanInstructions')}
      </p>

      {/* Timer */}
      {remainingTime && (
        <p className="text-content-tertiary text-sm">
          {t('cutouts.qrBridge.expiresIn', { time: remainingTime })}
        </p>
      )}

      {/* Waiting indicator */}
      <div className="flex items-center gap-2 mt-4 text-content-secondary">
        <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
        <span className="text-sm">{t('cutouts.qrBridge.waitingForUpload')}</span>
      </div>
    </div>
  );
}

/**
 * Error state with retry button.
 */
function ErrorState({
  error,
  onRetry,
  t,
}: {
  error: string;
  onRetry: () => void;
  t: ReturnType<typeof useTranslation>;
}) {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <p className="text-error text-center mb-4">{error}</p>
      <button onClick={onRetry} className="btn btn-primary">
        {t('common.retry')}
      </button>
    </div>
  );
}

/**
 * Session expired state.
 */
function ExpiredState({
  onRetry,
  t,
}: {
  onRetry: () => void;
  t: ReturnType<typeof useTranslation>;
}) {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p className="text-content-secondary text-center mb-4">
        {t('cutouts.qrBridge.sessionExpired')}
      </p>
      <button onClick={onRetry} className="btn btn-primary">
        {t('cutouts.qrBridge.createNew')}
      </button>
    </div>
  );
}
