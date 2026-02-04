/**
 * Design import view for the Bin Designer.
 *
 * Provides drag-and-drop file support and paste area for importing design JSON files.
 * Validates design structure and shows preview before importing.
 */

import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { parseDesignJSON } from '@/features/bin-designer/utils/designJson';
import type { BinParams } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';

interface DesignImportViewProps {
  onImport: (design: { name: string; params: BinParams }) => void;
  onCancel: () => void;
}

interface ImportPreview {
  name: string;
  dimensions: string;
  compartmentCount: number;
}

/**
 * Import view with drag-and-drop file support and paste area.
 */
export function DesignImportView({ onImport, onCancel }: DesignImportViewProps) {
  const t = useTranslation();
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validDesign, setValidDesign] = useState<{ name: string; params: BinParams } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processInput = useCallback((text: string) => {
    setJsonText(text);
    setErrors([]);
    setPreview(null);
    setValidDesign(null);

    if (!text.trim()) return;

    // Try to parse as design JSON
    const result = parseDesignJSON(text);

    if (result.design) {
      const { name, params } = result.design;
      const compartmentCount = params.compartments.cells.filter(
        (id, index, arr) => arr.indexOf(id) === index
      ).length;

      setPreview({
        name,
        dimensions: `${params.width}×${params.depth}×${params.height}`,
        compartmentCount,
      });
      setValidDesign(result.design);
    } else {
      setErrors(result.errors);
    }
  }, []);

  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      processInput(e.target.value);
    },
    [processInput]
  );

  const handleFileUpload = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processInput(text);
      };
      reader.readAsText(file);
    },
    [processInput]
  );

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

      const file = files[0];
      if (!file.name.endsWith('.json')) {
        setErrors(['Please drop a JSON file']);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processInput(text);
      };
      reader.readAsText(file);
    },
    [processInput]
  );

  const handleImport = useCallback(() => {
    if (validDesign) {
      onImport(validDesign);
    }
  }, [validDesign, onImport]);

  const handleClear = useCallback(() => {
    setJsonText('');
    setErrors([]);
    setPreview(null);
    setValidDesign(null);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Drop Zone */}
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
          accept=".json"
          onChange={handleFileUpload}
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
          {isDragging ? t('layouts.dropFileHere') : t('binDesigner.dragDropDesignJson')}
        </p>
        <p className="text-content-tertiary text-sm mb-4">{t('layouts.or')}</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-surface-secondary hover:bg-surface border border-stroke text-content text-sm rounded-lg transition-colors"
        >
          {t('layouts.browseFiles')}
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 border-t border-stroke" />
        <span className="text-content-tertiary text-sm">{t('binDesigner.pasteDesignJson')}</span>
        <div className="flex-1 border-t border-stroke" />
      </div>

      {/* Textarea */}
      <div className="flex-1 flex flex-col min-h-0 mb-4 p-0.5">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="import-design-json-input" className="text-sm text-content-secondary">
            {t('binDesigner.designJson')}
          </label>
          {jsonText && (
            <button
              onClick={handleClear}
              className="text-xs text-content-tertiary hover:text-content"
            >
              {t('common.clear')}
            </button>
          )}
        </div>
        <textarea
          id="import-design-json-input"
          ref={textareaRef}
          value={jsonText}
          onChange={handleTextChange}
          placeholder={t('binDesigner.pasteDesignJson')}
          className="flex-1 bg-surface text-content p-3 rounded-lg font-mono text-sm resize-none border border-stroke min-h-[120px]"
        />
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="bg-danger-muted border border-danger rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-medium text-danger mb-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {t('layouts.validationErrors')}
          </div>
          <ul className="text-sm text-danger/80 space-y-1 ml-6">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-success-muted border border-success rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-sm font-medium text-success mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {t('binDesigner.readyToImportDesign')}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-success/80">
            <div>{t('layouts.name')}</div>
            <div className="font-medium">{preview.name}</div>
            <div>{t('binDesigner.dimensions')}</div>
            <div>{preview.dimensions}</div>
            <div>{t('binDesigner.compartments')}</div>
            <div>{preview.compartmentCount}</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-stroke">
        <button
          onClick={handleImport}
          disabled={!validDesign}
          className="flex-1 py-2.5 px-4 bg-accent hover:bg-accent/90 disabled:hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-on-dark rounded-lg transition-colors text-sm font-medium"
        >
          {t('binDesigner.importAndLoad')}
        </button>
        <button
          onClick={onCancel}
          className="py-2.5 px-4 bg-surface-secondary hover:bg-surface border border-stroke text-content rounded-lg transition-colors text-sm"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
