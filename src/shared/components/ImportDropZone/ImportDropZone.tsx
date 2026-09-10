import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';

interface ImportDropZoneProps {
  /** Accept list for the hidden file input, e.g. `.json` or `.json,.stl`. */
  accept: string;
  /** Prompt shown at rest; while a file is dragged over, the shared drop prompt replaces it. */
  prompt: string;
  onFile: (file: File) => void;
}

export function ImportDropZone({ accept, prompt, onFile }: ImportDropZoneProps) {
  const t = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files.length === 0) return;
      onFile(files[0]);
    },
    [onFile]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      onFile(file);
      // Clearing lets the same file be picked again after a failed attempt.
      e.target.value = '';
    },
    [onFile]
  );

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-8 mb-4 text-center transition-colors
        ${isDragging ? 'border-accent bg-accent/10' : 'border-stroke hover:border-stroke-subtle'}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      <svg
        className={`w-12 h-12 mx-auto mb-3 transition-colors ${isDragging ? 'text-accent' : 'text-content-tertiary'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>

      <p className="text-content-secondary mb-2">
        {isDragging ? t('layouts.dropFileHere') : prompt}
      </p>
      <p className="text-content-tertiary text-sm mb-4">{t('layouts.or')}</p>
      <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
        {t('layouts.browseFiles')}
      </Button>
    </div>
  );
}
