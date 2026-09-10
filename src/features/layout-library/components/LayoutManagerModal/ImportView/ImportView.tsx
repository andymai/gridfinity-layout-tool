import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { validateImport } from '@/shared/utils/validation';
import { decodeLayoutFromURL, isArchiveFormat } from '@/core/storage';
import type { Layout } from '@/core/types';
import type { LayoutArchive } from '@/core/storage';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { ImportDropZone } from '@/shared/components/ImportDropZone';
import { ImportValidationErrors } from '@/shared/components/ImportValidationErrors';
import { ImportPreviewPanel } from '@/shared/components/ImportPreviewPanel';

interface ImportViewProps {
  onImport: (layout: Layout) => void;
  onImportArchive?: (archive: LayoutArchive) => void;
  onCancel: () => void;
}

interface ImportPreview {
  name: string;
  drawerSize: string;
  layerCount: number;
  binCount: number;
  linkedDesignCount?: number;
}

interface ArchivePreview {
  layoutCount: number;
  exportedAt: string;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Import view with drag-and-drop file support and paste area.
 */
export function ImportView({ onImport, onImportArchive, onCancel }: ImportViewProps) {
  const t = useTranslation();
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [archivePreview, setArchivePreview] = useState<ArchivePreview | null>(null);
  const [validLayout, setValidLayout] = useState<Layout | null>(null);
  const [validArchive, setValidArchive] = useState<LayoutArchive | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const processInput = useCallback(
    (text: string) => {
      setJsonText(text);
      setErrors([]);
      setPreview(null);
      setArchivePreview(null);
      setValidLayout(null);
      setValidArchive(null);

      if (!text.trim()) return;

      // Check if it's a share URL
      const shareMatch = text.match(/#share=([A-Za-z0-9_-]+)/);
      if (shareMatch) {
        const encoded = shareMatch[1];
        const result = decodeLayoutFromURL(encoded);
        if (result.layout) {
          setPreview({
            name: result.layout.name,
            drawerSize: `${result.layout.drawer.width}×${result.layout.drawer.depth}×${result.layout.drawer.height}`,
            layerCount: result.layout.layers.length,
            binCount: result.layout.bins.length,
          });
          setValidLayout(result.layout);
        } else {
          setErrors(result.errors);
        }
        return;
      }

      // Try to parse as JSON
      try {
        const data: unknown = JSON.parse(text);

        // Check if it's a bulk archive
        if (isArchiveFormat(data)) {
          setArchivePreview({
            layoutCount: data.layouts.length,
            exportedAt: data._archive.exportedAt,
          });
          setValidArchive(data);
          return;
        }

        const validation = validateImport(data);

        if (validation.valid) {
          const { layout } = validation;
          const raw = data as Record<string, unknown>;
          const linkedDesignCount =
            Array.isArray(raw.linkedDesigns) && raw.linkedDesigns.length > 0
              ? raw.linkedDesigns.length
              : undefined;
          setPreview({
            name: layout.name,
            drawerSize: `${layout.drawer.width}×${layout.drawer.depth}×${layout.drawer.height}`,
            layerCount: layout.layers.length,
            binCount: layout.bins.length,
            linkedDesignCount,
          });
          setValidLayout(layout);
        } else {
          setErrors(validation.errors);
        }
      } catch {
        setErrors([t('layouts.import.error.invalidJsonFormat')]);
      }
    },
    [t]
  );

  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      processInput(e.target.value);
    },
    [processInput]
  );

  const readFile = useCallback(
    (file: File) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrors([
          t('layouts.import.error.fileTooLarge', {
            sizeMb: Math.round(file.size / 1024 / 1024),
            maxMb: 50,
          }),
        ]);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') processInput(text);
      };
      reader.readAsText(file);
    },
    [processInput, t]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.json')) {
        setErrors([t('binDesigner.designJson.error.mustBeJsonFile')]);
        return;
      }
      readFile(file);
    },
    [readFile, t]
  );

  const handleImport = useCallback(async () => {
    if (!validLayout) return;

    // Restore embedded designs if present in the raw JSON
    const { restoreEmbeddedDesigns } = await import('@/core/storage');
    const { layout: updatedLayout } = await restoreEmbeddedDesigns(jsonText, validLayout);

    onImport(updatedLayout);
  }, [validLayout, jsonText, onImport]);

  const handleImportArchive = useCallback(() => {
    if (!validArchive || !onImportArchive) return;
    onImportArchive(validArchive);
  }, [validArchive, onImportArchive]);

  const handleClear = useCallback(() => {
    setJsonText('');
    setErrors([]);
    setPreview(null);
    setArchivePreview(null);
    setValidLayout(null);
    setValidArchive(null);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Destination note */}
      <p className="text-xs text-content-tertiary mb-3 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {t('layouts.importedLayoutsAreSavedToMyLayouts')}
      </p>

      <ImportDropZone accept=".json" prompt={t('layouts.dragDropJson')} onFile={handleFile} />

      {/* Divider */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 border-t border-stroke" />
        <span className="text-content-tertiary text-sm">{t('layouts.orPasteJson')}</span>
        <div className="flex-1 border-t border-stroke" />
      </div>

      {/* Textarea */}
      <div className="flex-1 flex flex-col min-h-0 mb-4 p-0.5">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="import-json-input" className="text-sm text-content-secondary">
            {t('layouts.layoutJson')}
          </label>
          {jsonText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-auto px-0 py-0 text-content-tertiary hover:bg-transparent hover:text-content"
            >
              {t('common.clear')}
            </Button>
          )}
        </div>
        <textarea
          id="import-json-input"
          ref={textareaRef}
          value={jsonText}
          onChange={handleTextChange}
          placeholder={t('layouts.jsonPlaceholder')}
          className="flex-1 bg-surface text-content p-3 rounded-lg font-mono text-sm resize-none border border-stroke min-h-[120px]"
        />
      </div>

      <ImportValidationErrors errors={errors} />

      {preview && (
        <ImportPreviewPanel
          title={t('layouts.readyToImport')}
          rows={[
            { label: t('layouts.name'), value: preview.name, emphasis: true },
            { label: t('layouts.drawerSize'), value: preview.drawerSize },
            { label: t('layouts.layers'), value: preview.layerCount },
            { label: t('layouts.bins'), value: preview.binCount },
            ...(preview.linkedDesignCount !== undefined && preview.linkedDesignCount > 0
              ? [{ label: t('layouts.binDesigns'), value: preview.linkedDesignCount }]
              : []),
          ]}
        />
      )}

      {archivePreview && (
        <ImportPreviewPanel
          title={t('layouts.archiveDetected')}
          rows={[
            {
              label: t('layouts.layoutsInArchive'),
              value: archivePreview.layoutCount,
              emphasis: true,
            },
          ]}
        />
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-stroke">
        {validArchive ? (
          <Button
            variant="primary"
            onClick={handleImportArchive}
            disabled={!onImportArchive}
            className="flex-1"
          >
            {t('layouts.importAll', { count: validArchive.layouts.length })}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={!validLayout}
            className="flex-1"
          >
            {t('layouts.importLayout')}
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
