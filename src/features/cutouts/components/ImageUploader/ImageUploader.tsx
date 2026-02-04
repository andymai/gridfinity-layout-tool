/**
 * ImageUploader component for cutout photo upload.
 *
 * Provides drag-and-drop and file input for uploading tool photos.
 * Validates file type and size before processing.
 */

import { useRef, useState, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { MAX_IMAGE_SIZE_BYTES } from '../../types';

interface ImageUploaderProps {
  /** Called when a valid image file is selected */
  onImageSelect: (file: File) => void;
  /** Whether processing is in progress */
  isProcessing?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Whether the uploader is disabled */
  disabled?: boolean;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

/**
 * Image upload component with drag-and-drop support.
 *
 * Features:
 * - Drag-and-drop file upload
 * - Click to browse files
 * - File type validation (PNG, JPEG, WebP)
 * - File size validation
 * - Visual feedback for drag state
 */
export function ImageUploader({
  onImageSelect,
  isProcessing = false,
  error = null,
  disabled = false,
}: ImageUploaderProps) {
  const t = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const displayError = error ?? validationError;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return t('cutouts.imageUploader.errorInvalidType');
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        const maxMb = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
        return t('cutouts.imageUploader.errorTooLarge', { maxMb });
      }
      return null;
    },
    [t]
  );

  const handleFile = useCallback(
    (file: File) => {
      setValidationError(null);
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        return;
      }
      onImageSelect(file);
    },
    [validateFile, onImageSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !isProcessing) {
      inputRef.current?.click();
    }
  }, [disabled, isProcessing]);

  const isDisabled = disabled || isProcessing;

  const ariaLabel = t('cutouts.imageUploader.label');

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={isDisabled}
        aria-label={ariaLabel}
      />

      <button
        type="button"
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={isDisabled}
        className={`
          w-full p-6 rounded-lg border-2 border-dashed transition-colors
          flex flex-col items-center justify-center gap-2
          ${
            isDragging
              ? 'border-accent bg-accent/10'
              : isDisabled
                ? 'border-stroke-subtle bg-surface-secondary cursor-not-allowed opacity-50'
                : 'border-stroke-subtle hover:border-accent hover:bg-surface-secondary cursor-pointer'
          }
        `}
        aria-label={ariaLabel}
      >
        {isProcessing ? (
          <>
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-content-secondary">
              {t('cutouts.imageUploader.processing')}
            </span>
          </>
        ) : (
          <>
            <svg
              className="w-8 h-8 text-content-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm text-content-secondary">
              {isDragging
                ? t('cutouts.imageUploader.dropHint')
                : t('cutouts.imageUploader.clickHint')}
            </span>
            <span className="text-xs text-content-tertiary">
              {t('cutouts.imageUploader.fileTypes')}
            </span>
          </>
        )}
      </button>

      {displayError && (
        <p className="mt-2 text-sm text-error" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
