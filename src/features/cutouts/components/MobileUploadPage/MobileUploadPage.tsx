/**
 * Mobile Upload Page for QR Bridge.
 *
 * A lightweight page that mobile users land on after scanning the QR code.
 * Allows them to take or select a photo and upload it to the session.
 */

import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from '@/i18n';

/**
 * Extract session ID from URL search params.
 */
function getSessionIdFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('session');
}

/**
 * Upload status states.
 */
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'invalid-session';

export function MobileUploadPage() {
  const t = useTranslation();
  const sessionId = getSessionIdFromURL();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<UploadStatus>(sessionId ? 'idle' : 'invalid-session');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /**
   * Handle file selection.
   */
  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !sessionId) return;

      // Show preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      // Start upload
      setStatus('uploading');
      setError(null);

      try {
        // Convert file to base64
        const base64 = await fileToBase64(file);

        // Upload to session
        const response = await fetch(`/api/cutout-session/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            filename: file.name,
            mimeType: file.type,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (response.status === 404) {
            setStatus('invalid-session');
            setError(t('cutouts.upload.invalidSession'));
          } else {
            setStatus('error');
            setError(data.error || t('cutouts.upload.uploadFailed'));
          }
          return;
        }

        setStatus('success');
      } catch {
        setStatus('error');
        setError(t('cutouts.upload.uploadFailed'));
      } finally {
        // Clean up object URL
        URL.revokeObjectURL(objectUrl);
      }
    },
    [sessionId, t]
  );

  /**
   * Trigger file input.
   */
  const handleSelectPhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-content mb-2">{t('cutouts.upload.title')}</h1>
          {status !== 'invalid-session' && status !== 'success' && (
            <p className="text-content-secondary text-sm">
              {t('cutouts.qrBridge.scanInstructions')}
            </p>
          )}
        </div>

        {/* Content based on status */}
        {status === 'invalid-session' && (
          <div className="bg-error/10 border border-error rounded-lg p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-error/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-error"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p className="text-error font-medium">{t('cutouts.upload.invalidSession')}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-success/10 border border-success rounded-lg p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-success font-medium mb-2">{t('cutouts.upload.success')}</p>
            <p className="text-content-secondary text-sm">{t('cutouts.upload.returnToDesktop')}</p>
          </div>
        )}

        {(status === 'idle' || status === 'uploading' || status === 'error') && (
          <>
            {/* Preview */}
            {previewUrl && (
              <div className="mb-6 rounded-lg overflow-hidden border border-stroke-subtle">
                <img
                  src={previewUrl}
                  alt={t('cutouts.upload.imagePreview')}
                  className="w-full h-48 object-contain bg-surface-elevated"
                />
              </div>
            )}

            {/* Upload buttons */}
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                aria-label={t('cutouts.upload.selectPhoto')}
              />

              <button
                onClick={handleSelectPhoto}
                disabled={status === 'uploading'}
                className="w-full btn btn-primary py-4 text-lg disabled:opacity-50"
              >
                {status === 'uploading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('cutouts.upload.uploading')}
                  </span>
                ) : (
                  t('cutouts.upload.takePhoto')
                )}
              </button>

              {/* Alternative: select from gallery */}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                disabled={status === 'uploading'}
                className="w-full btn btn-secondary py-4 text-lg file:hidden cursor-pointer disabled:opacity-50"
              />
            </div>

            {/* Error message */}
            {status === 'error' && error && (
              <div className="mt-4 p-3 bg-error/10 border border-error rounded-lg text-error text-sm text-center">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Convert file to base64 string (without data URL prefix).
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (data:image/png;base64,)
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
