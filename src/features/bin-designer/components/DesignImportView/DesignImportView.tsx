/**
 * Design import view for the Bin Designer.
 *
 * Provides drag-and-drop file support and paste area for importing design JSON files.
 * Validates design structure and shows preview before importing.
 */

import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { parseDesignJSON } from '@/features/bin-designer/utils/designJson';
import type { BinParams } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { ImportDropZone } from '@/shared/components/ImportDropZone';
import { ImportValidationErrors } from '@/shared/components/ImportValidationErrors';
import { ImportPreviewPanel } from '@/shared/components/ImportPreviewPanel';

interface DesignImportViewProps {
  onImport: (design: { name: string; params: BinParams }) => void;
  onCancel: () => void;
  /**
   * When provided (stl_bin_import labs flag), `.stl` files picked or dropped
   * here are routed to the imported-bin flow instead of being rejected.
   */
  onStlFile?: (file: File) => void;
}

interface ImportPreview {
  name: string;
  dimensions: string;
  compartmentCount: number;
}

/**
 * Import view with drag-and-drop file support and paste area.
 */
export function DesignImportView({ onImport, onCancel, onStlFile }: DesignImportViewProps) {
  const t = useTranslation();
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [validDesign, setValidDesign] = useState<{ name: string; params: BinParams } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const processInput = useCallback(
    (text: string) => {
      setJsonText(text);
      setErrors([]);
      setPreview(null);
      setValidDesign(null);

      if (!text.trim()) return;

      // Try to parse as design JSON
      const result = parseDesignJSON(text, t);

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
    },
    [t]
  );

  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      processInput(e.target.value);
    },
    [processInput]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (onStlFile && file.name.toLowerCase().endsWith('.stl')) {
        onStlFile(file);
        return;
      }
      if (!file.name.endsWith('.json')) {
        setErrors([t('binDesigner.designJson.error.mustBeJsonFile')]);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processInput(text);
      };
      reader.readAsText(file);
    },
    [processInput, t, onStlFile]
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
      <ImportDropZone
        accept={onStlFile ? '.json,.stl' : '.json'}
        prompt={
          onStlFile ? t('binDesigner.dragDropDesignFile') : t('binDesigner.dragDropDesignJson')
        }
        onFile={handleFile}
      />

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
            <Button
              variant="ghost"
              onClick={handleClear}
              className="rounded-none px-0 py-0 hover:bg-transparent text-xs text-content-tertiary hover:text-content"
            >
              {t('common.clear')}
            </Button>
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

      <ImportValidationErrors errors={errors} />

      {preview && (
        <ImportPreviewPanel
          title={t('binDesigner.readyToImportDesign')}
          rows={[
            { label: t('layouts.name'), value: preview.name, emphasis: true },
            { label: t('binDesigner.dimensions'), value: preview.dimensions },
            { label: t('binDesigner.compartments'), value: preview.compartmentCount },
          ]}
        />
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-stroke">
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={!validDesign}
          className="flex-1 py-2.5 px-4 bg-accent hover:bg-accent/90 disabled:hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-on-dark rounded-lg transition-colors text-sm font-medium"
        >
          {t('binDesigner.importAndLoad')}
        </Button>
        <Button
          variant="secondary"
          onClick={onCancel}
          className="py-2.5 px-4 bg-surface-secondary hover:bg-surface border border-stroke text-content rounded-lg transition-colors text-sm"
        >
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
