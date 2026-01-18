import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { validateImport } from '@/shared/utils/validation';
import { decodeLayoutFromURL } from '@/core/storage';
import type { Layout } from '@/core/types';

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
      const data = JSON.parse(text);
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
      setErrors(['Invalid JSON format']);
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
      setErrors(['No JSON provided']);
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
      const data = JSON.parse(jsonText);
      const validation = validateImport(data);

      if (validation.valid) {
        onImport(data as Layout);
        onClose();
      } else {
        setErrors(validation.errors);
      }
    } catch {
      setErrors(['Invalid JSON format']);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-800 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Import Layout</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
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
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            >
              Upload JSON File
            </button>
          </div>

          {/* Textarea */}
          <div className="flex-1 flex flex-col min-h-0">
            <label htmlFor="json-input" className="text-sm text-zinc-300 mb-2">
              Or paste JSON or share link:
            </label>
            <textarea
              id="json-input"
              ref={textareaRef}
              value={jsonText}
              onChange={handleTextChange}
              placeholder='{"version": "1.0", "name": "My Layout", ...} or https://...#share=...'
              className="flex-1 bg-zinc-900 text-white p-3 rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="bg-red-900/30 border border-red-500 rounded p-3 max-h-32 overflow-y-auto">
              <div className="text-sm font-semibold text-red-400 mb-1">
                Validation Errors:
              </div>
              <ul className="text-sm text-red-300 space-y-1">
                {errors.map((error) => (
                  <li key={error}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="bg-green-900/30 border border-green-500 rounded p-3">
              <div className="text-sm font-semibold text-green-400 mb-2">
                Preview:
              </div>
              <div className="text-sm text-green-300 space-y-1">
                <div>Drawer size: {preview.drawerSize}</div>
                <div>Layers: {preview.layerCount}</div>
                <div>Bins: {preview.binCount}</div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleImport}
            disabled={!!errors.length || !jsonText.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Import
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
