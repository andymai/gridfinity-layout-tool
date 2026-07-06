import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { validateImport } from '@/shared/utils/validation';
import { decodeLayoutFromURL } from '@/core/storage';
import type { Layout } from '@/core/types';
import { Button, IconButton, XIcon } from '@/design-system';
import { useTranslation } from '@/i18n';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (layout: Layout) => void;
}

// Wrapper that only mounts the inner component when open
// This ensures fresh state on each open without needing useEffect reset
export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  if (!isOpen) return null;
  return <ImportModalContent onClose={onClose} onImport={onImport} />;
}

function ImportModalContent({ onClose, onImport }: Omit<ImportModalProps, 'isOpen'>) {
  const t = useTranslation();
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    drawerSize: string;
    layerCount: number;
    binCount: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);
    setErrors([]);
    setPreview(null);

    if (!text.trim()) return;

    // Check if it's a share URL
    const shareMatch = text.match(/#share=([A-Za-z0-9_-]+)/);
    if (shareMatch) {
      const encoded = shareMatch[1];
      const result = decodeLayoutFromURL(encoded);
      if (result.layout) {
        setPreview({
          drawerSize: `${result.layout.drawer.width}×${result.layout.drawer.depth}×${result.layout.drawer.height}`,
          layerCount: result.layout.layers.length,
          binCount: result.layout.bins.length,
        });
      } else {
        setErrors(result.errors);
      }
      return;
    }

    try {
      const data: unknown = JSON.parse(text);
      const validation = validateImport(data);

      if (validation.valid) {
        const layout = data as Layout;
        setPreview({
          drawerSize: `${layout.drawer.width}×${layout.drawer.depth}×${layout.drawer.height}`,
          layerCount: layout.layers.length,
          binCount: layout.bins.length,
        });
      } else {
        setErrors(validation.errors);
      }
    } catch {
      setErrors([t('layouts.import.error.invalidJsonFormat')]);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonText(text);
      handleTextChange({
        target: { value: text },
      } as ChangeEvent<HTMLTextAreaElement>);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!jsonText.trim()) {
      setErrors([t('layouts.import.error.noJsonProvided')]);
      return;
    }

    // Check if it's a share URL
    const shareMatch = jsonText.match(/#share=([A-Za-z0-9_-]+)/);
    if (shareMatch) {
      const encoded = shareMatch[1];
      const result = decodeLayoutFromURL(encoded);
      if (result.layout) {
        onImport(result.layout);
        onClose();
      } else {
        setErrors(result.errors);
      }
      return;
    }

    try {
      const data: unknown = JSON.parse(jsonText);
      const validation = validateImport(data);

      if (validation.valid) {
        onImport(data as Layout);
        onClose();
      } else {
        setErrors(validation.errors);
      }
    } catch {
      setErrors([t('layouts.import.error.invalidJsonFormat')]);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-overlay-medium flex items-center justify-center z-50"
      onClick={onClose}
      role="presentation"
    >
      <div role="presentation" onClick={(e) => e.stopPropagation()}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-modal-title"
          className="bg-surface-secondary rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 id="import-modal-title" className="text-2xl font-bold text-content">
              {t('layouts.import.title')}
            </h2>
            <IconButton
              onClick={onClose}
              touchTarget={false}
              className="-m-2 text-content-tertiary hover:text-content"
              aria-label={t('layouts.import.closeImportDialog')}
            >
              <XIcon size="md" />
            </IconButton>
          </div>

          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* File Upload Button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                aria-label={t('layouts.import.selectJsonFileToImport')}
              />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                {t('layouts.import.browseFiles')}
              </Button>
            </div>

            {/* Textarea */}
            <div className="flex-1 flex flex-col min-h-0">
              <label htmlFor="json-input" className="text-sm text-content-secondary mb-2">
                {t('layouts.import.pasteLink')}
              </label>
              <textarea
                id="json-input"
                ref={textareaRef}
                value={jsonText}
                onChange={handleTextChange}
                placeholder={t('layouts.import.placeholder')}
                className="flex-1 bg-surface text-content p-3 rounded font-mono text-sm resize-none"
              />
            </div>

            {/* Validation Errors */}
            {errors.length > 0 && (
              <div
                role="alert"
                aria-live="assertive"
                className="bg-error/10 border border-error rounded p-3 max-h-32 overflow-y-auto"
              >
                <div className="text-sm font-semibold text-error mb-1">
                  {t('layouts.validationErrors')}
                </div>
                <ul className="text-sm text-error/80 space-y-1">
                  {errors.map((error) => (
                    <li key={error}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview */}
            {preview && (
              <div aria-live="polite" className="bg-success/10 border border-success rounded p-3">
                <div className="text-sm font-semibold text-success mb-2">
                  {t('layouts.import.preview')}
                </div>
                <div className="text-sm text-success/80 space-y-1">
                  <div>{t('layouts.import.drawerSize', { size: preview.drawerSize })}</div>
                  <div>{t('layouts.import.layers', { count: preview.layerCount })}</div>
                  <div>{t('layouts.import.bins', { count: preview.binCount })}</div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={!!errors.length || !jsonText.trim()}
            >
              {t('common.import')}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
