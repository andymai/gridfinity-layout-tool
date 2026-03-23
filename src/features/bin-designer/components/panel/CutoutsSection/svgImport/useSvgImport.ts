/**
 * Orchestration hook for SVG file import into the cutout editor.
 *
 * Owns: file input, FileReader, transaction wrapping, toast feedback, analytics.
 * Delegates: parsing to svgParser, hydration to specToCutout.
 */

import { useCallback, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { trackEvent } from '@/shared/analytics/posthog';
import { parseSvgString } from './svgParser';
import { specToCutout, DEFAULT_CUT_DEPTH } from './specToCutout';
import { MAX_SVG_FILE_SIZE } from './types';
import type { SvgImportErrorCode } from './types';

/** Maps error codes to i18n toast keys. */
const ERROR_TOAST_KEYS: Record<SvgImportErrorCode, string> = {
  SVG_PARSE_FAILED: 'toast.svgImport.parseFailed',
  SVG_NO_SHAPES: 'toast.svgImport.noShapes',
  SVG_SHAPE_LIMIT: 'toast.svgImport.shapeLimitExceeded',
  SVG_UNSUPPORTED: 'toast.svgImport.unsupportedFile',
  SVG_FILE_TOO_LARGE: 'toast.svgImport.fileTooLarge',
};

export interface UseSvgImportReturn {
  /** Trigger the native file picker for SVG import. */
  readonly triggerImport: () => void;
}

/**
 * Hook that manages SVG file import into the cutout editor.
 *
 * Creates a hidden file input, reads the SVG, parses it, and adds
 * the resulting cutouts to the store in a single undo transaction.
 */
export function useSvgImport(): UseSvgImportReturn {
  const { addCutout, startTransaction, commitTransaction } = useDesignerStore(
    useShallow((s) => ({
      addCutout: s.addCutout,
      startTransaction: s.startTransaction,
      commitTransaction: s.commitTransaction,
    }))
  );

  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  // Use a ref to forward the latest handleFile to the DOM event listener,
  // avoiding stale closures when deps like `t` change (e.g. locale switch).
  const handleFileRef = useRef<(file: File) => void>(() => {});

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > MAX_SVG_FILE_SIZE) {
        addToast(t(ERROR_TOAST_KEYS.SVG_FILE_TOO_LARGE), 'error');
        trackEvent('svg_import', { success: false, error_code: 'SVG_FILE_TOO_LARGE' });
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        const raw = reader.result;
        if (typeof raw !== 'string') return;

        const result = parseSvgString(raw);

        if (!isOk(result)) {
          const toastKey = ERROR_TOAST_KEYS[result.error.code];
          addToast(t(toastKey), 'error');
          trackEvent('svg_import', { success: false, error_code: result.error.code });
          return;
        }

        const specs = result.value;
        const hydrationOptions = {
          cutDepth: DEFAULT_CUT_DEPTH,
          idFactory: () => crypto.randomUUID(),
        };

        // Wrap all additions in a single undo transaction
        startTransaction();
        try {
          for (const spec of specs) {
            addCutout(specToCutout(spec, hydrationOptions));
          }
        } finally {
          commitTransaction();
        }

        // Analytics
        const hasRects = specs.some((s) => s.shape === 'rectangle');
        const hasCircles = specs.some((s) => s.shape === 'circle');
        const hasPaths = specs.some((s) => s.shape === 'path');
        trackEvent('svg_import', {
          success: true,
          shape_count: specs.length,
          has_rects: hasRects,
          has_circles: hasCircles,
          has_paths: hasPaths,
        });

        addToast(t('toast.svgImport.success', { count: specs.length }), 'success');
      };

      reader.onerror = () => {
        addToast(t('toast.svgImport.parseFailed'), 'error');
        trackEvent('svg_import', { success: false, error_code: 'FILE_READ_ERROR' });
      };

      reader.readAsText(file);
    },
    [addCutout, startTransaction, commitTransaction, addToast, t]
  );

  // Keep ref in sync with latest handleFile
  useEffect(() => {
    handleFileRef.current = handleFile;
  }, [handleFile]);

  // Create and clean up the hidden file input
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) {
        handleFileRef.current(file);
      }
      // Reset so the same file can be re-imported
      input.value = '';
    });
    document.body.appendChild(input);
    fileInputRef.current = input;

    return () => {
      input.remove();
      fileInputRef.current = null;
    };
  }, []);

  const triggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return { triggerImport };
}
