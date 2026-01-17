import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { validateImport } from '../../../utils/validation';
import { decodeLayoutFromURL } from '../../../core/storage';
import type { Layout } from '../../../core/types';

interface ImportViewProps {
  onImport: (layout: Layout) => void;
  onCancel: () => void;
}

interface ImportPreview {
  name: string;
  drawerSize: string;
  layerCount: number;
  binCount: number;
}

/**
 * Import view with drag-and-drop file support and paste area.
 */
export function ImportView({ onImport, onCancel }: ImportViewProps) {
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validLayout, setValidLayout] = useState<Layout | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processInput = useCallback((text: string) => {
    setJsonText(text);
    setErrors([]);
    setPreview(null);
    setValidLayout(null);

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
      const data = JSON.parse(text);
      const validation = validateImport(data);

      if (validation.valid) {
        const layout = data as Layout;
        setPreview({
          name: layout.name,
          drawerSize: `${layout.drawer.width}×${layout.drawer.depth}×${layout.drawer.height}`,
          layerCount: layout.layers.length,
          binCount: layout.bins.length,
        });
        setValidLayout(layout);
      } else {
        setErrors(validation.errors);
      }
    } catch {
      setErrors(['Invalid JSON format']);
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
    if (validLayout) {
      onImport(validLayout);
    }
  }, [validLayout, onImport]);

  const handleClear = useCallback(() => {
    setJsonText('');
    setErrors([]);
    setPreview(null);
    setValidLayout(null);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Destination note */}
      <p className="text-xs text-content-tertiary mb-3 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Imported layouts are saved to My Layouts
      </p>

      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 mb-4 text-center transition-colors
          ${isDragging
            ? 'border-accent bg-accent/10'
            : 'border-stroke hover:border-stroke-subtle'
          }
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
          {isDragging ? 'Drop your file here' : 'Drag and drop a JSON file here'}
        </p>
        <p className="text-content-tertiary text-sm mb-4">or</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-surface-secondary hover:bg-surface border border-stroke text-content text-sm rounded-lg transition-colors"
        >
          Browse Files
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 border-t border-stroke" />
        <span className="text-content-tertiary text-sm">or paste JSON</span>
        <div className="flex-1 border-t border-stroke" />
      </div>

      {/* Textarea */}
      <div className="flex-1 flex flex-col min-h-0 mb-4 p-0.5">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="import-json-input" className="text-sm text-content-secondary">
            Layout JSON
          </label>
          {jsonText && (
            <button
              onClick={handleClear}
              className="text-xs text-content-tertiary hover:text-content"
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          id="import-json-input"
          ref={textareaRef}
          value={jsonText}
          onChange={handleTextChange}
          placeholder='{"version": "1.0", "name": "My Layout", ...}'
          className="flex-1 bg-surface text-content p-3 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent border border-stroke min-h-[120px]"
        />
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-medium text-red-400 mb-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Validation Errors
          </div>
          <ul className="text-sm text-red-300 space-y-1 ml-6">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-sm font-medium text-green-400 mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ready to Import
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-green-300">
            <div>Name:</div>
            <div className="font-medium">{preview.name}</div>
            <div>Drawer size:</div>
            <div>{preview.drawerSize}</div>
            <div>Layers:</div>
            <div>{preview.layerCount}</div>
            <div>Bins:</div>
            <div>{preview.binCount}</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-stroke">
        <button
          onClick={handleImport}
          disabled={!validLayout}
          className="flex-1 py-2.5 px-4 bg-accent hover:bg-accent/90 disabled:hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
        >
          Import Layout
        </button>
        <button
          onClick={onCancel}
          className="py-2.5 px-4 bg-surface-secondary hover:bg-surface border border-stroke text-content rounded-lg transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
