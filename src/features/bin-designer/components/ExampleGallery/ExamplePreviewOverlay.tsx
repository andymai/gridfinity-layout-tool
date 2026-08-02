import { useState } from 'react';
import { Button, Dialog, IconButton } from '@/design-system';
import { useToastStore } from '@/core/store/toast';
import { isOk } from '@/core/result';
import { exampleToDesign } from '@/features/bin-designer/utils/exampleToDesign';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
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
  const [isImporting, setIsImporting] = useState(false);

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

  // Dialog.Root (not a hand-rolled overlay) so the preview gets its own focus
  // trap and dialog stacking: Tab stays inside the preview instead of reaching
  // the gallery grid hidden behind the backdrop, and Escape closes the preview
  // before the surrounding gallery modal.
  return (
    <Dialog.Root
      open
      onClose={onBack}
      size="2xl"
      aria-label={t(example.nameKey)}
      className="bg-surface-elevated"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-stroke-subtle shrink-0">
        <div className="flex items-center gap-3">
          <IconButton
            variant="ghost"
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
          </IconButton>
          <h2 className="text-lg font-bold text-content">{t(example.nameKey)}</h2>
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
            <h3 className="text-sm font-medium text-content mb-2">{t('binExamples.dimensions')}</h3>
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label={t('binExamples.width')} value={`${width}`} />
              <MetricCard label={t('binExamples.depth')} value={`${depth}`} />
              <MetricCard label={t('binExamples.height')} value={`${height}`} />
            </div>
            <p className="text-xs text-content-tertiary mt-1">
              {`${width * example.metrics.gridUnitMm}×${depth * (example.params.gridUnitMmY ?? example.metrics.gridUnitMm)}×${height * example.params.heightUnitMm}mm`}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-stroke-subtle bg-surface shrink-0">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-content-secondary">{t('binExamples.useAsNewDesignHint')}</p>
          <Button
            variant="primary"
            onClick={handleUse}
            loading={isImporting}
            className="px-6 shrink-0"
          >
            {isImporting ? t('binExamples.creating') : t('binExamples.useAsNewDesign')}
          </Button>
        </div>
      </div>
    </Dialog.Root>
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
