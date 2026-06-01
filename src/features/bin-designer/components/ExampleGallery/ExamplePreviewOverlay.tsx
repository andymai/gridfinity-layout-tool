import { useEffect, useRef, useState } from 'react';
import { useToastStore } from '@/core/store/toast';
import { isOk } from '@/core/result';
import { exampleToDesign } from '@/features/bin-designer/utils/exampleToDesign';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { TECHNIQUE_CONFIG } from '@/features/bin-designer/types/exampleGallery';
import { useTranslation } from '@/i18n';
import { Example3DViewer } from './Example3DViewer';

interface ExamplePreviewOverlayProps {
  example: ExampleDesign;
  onClose: () => void;
  onBack: () => void;
}

export function ExamplePreviewOverlay({ example, onClose, onBack }: ExamplePreviewOverlayProps) {
  const t = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const handleUse = async () => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      const result = await exampleToDesign(example, t);
      if (isOk(result)) {
        addToast(t('binExamples.toast.designCreated'), 'success');
        // Switch to the Bin Designer so the freshly-created design is shown
        // (the gallery can be opened from the layout planner too). App.tsx
        // listens for this event and navigates to the designer route.
        window.dispatchEvent(new Event('switch-to-designer'));
        onClose();
      } else {
        addToast(t('binExamples.toast.designCreateFailed'), 'error');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const { width, depth, height } = example.metrics;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
      role="presentation"
      onClick={onBack}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        className="relative bg-surface-elevated rounded-xl shadow-2xl flex flex-col overflow-hidden animate-scale-in w-full max-w-2xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') onBack();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="example-preview-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stroke-subtle shrink-0">
          <div className="flex items-center gap-3">
            <button
              ref={closeButtonRef}
              onClick={onBack}
              className="p-2 text-content-secondary hover:text-content hover:bg-surface rounded-lg transition-colors"
              aria-label={t('binExamples.backToGallery')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <h2 id="example-preview-title" className="text-lg font-bold text-content">
              {t(example.nameKey)}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {example.techniques.map((technique) => (
              <span
                key={technique}
                className="text-xs uppercase tracking-wide px-2 py-1 rounded bg-surface-secondary text-content-tertiary"
              >
                {t(TECHNIQUE_CONFIG[technique].labelKey)}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col md:flex-row">
          {/* Preview: live 3D viewer (falls back to static thumbnail when no mesh) */}
          <div className="flex-1 p-6 flex items-center justify-center bg-surface">
            <div className="bg-surface-secondary rounded-xl p-4 w-full flex items-center justify-center">
              <Example3DViewer example={example} />
            </div>
          </div>

          {/* Details */}
          <div className="md:w-72 p-4 md:border-l border-stroke-subtle space-y-4">
            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-content mb-1">
                {t('binExamples.description')}
              </h3>
              <p className="text-sm text-content-secondary">{t(example.descriptionKey)}</p>
            </div>

            {/* Dimensions */}
            <div>
              <h3 className="text-sm font-medium text-content mb-2">
                {t('binExamples.dimensions')}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <MetricCard label={t('binExamples.width')} value={`${width}`} />
                <MetricCard label={t('binExamples.depth')} value={`${depth}`} />
                <MetricCard label={t('binExamples.height')} value={`${height}`} />
              </div>
              <p className="text-xs text-content-tertiary mt-1">
                {`${width * example.metrics.gridUnitMm}×${depth * example.metrics.gridUnitMm}×${height * example.params.heightUnitMm}mm`}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stroke-subtle bg-surface shrink-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-content-secondary">{t('binExamples.useAsNewDesignHint')}</p>
            <button
              onClick={handleUse}
              disabled={isImporting}
              className="btn btn-primary px-6 shrink-0"
            >
              {isImporting ? (
                <>
                  <svg
                    className="animate-spin motion-reduce:animate-none -ml-1 mr-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {t('binExamples.creating')}
                </>
              ) : (
                t('binExamples.useAsNewDesign')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-lg p-2">
      <div className="text-base font-semibold text-content">{value}</div>
      <div className="text-xs text-content-tertiary">{label}</div>
    </div>
  );
}
