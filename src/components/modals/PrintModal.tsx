import { useEffect, useState, useMemo, useCallback, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore } from '../../store';
import { useSettingsStore, type PrintViewSettings, type BinListSortOrder } from '../../store/settings';
import { PrintLayout } from '../print/PrintLayout';
import { SortOrderConfig } from '../print/SortOrderConfig';
import { getBinCountByLayer } from '../../utils/printLayout';
import '../../styles/print.css';

// Style constants
const STYLES = {
  overlay: { backgroundColor: 'var(--overlay-dark)' } as CSSProperties,
  modal: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-xl)',
  } as CSSProperties,
  title: {
    fontSize: 'var(--text-2xl)',
    fontWeight: 'var(--font-bold)',
    color: 'var(--text-primary)',
  } as CSSProperties,
  sectionHeader: {
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-semibold)',
    color: 'var(--text-secondary)',
  } as CSSProperties,
} as const;

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Print modal with settings and preview.
 * Opens browser print dialog on print button click.
 */
export function PrintModal({ isOpen, onClose }: PrintModalProps) {
  const { layout } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
    }))
  );

  const { settings, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      settings: state.settings,
      updateSetting: state.updateSetting,
    }))
  );

  // Local state for layer selection (not persisted)
  // Initialize with all layers selected.
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>(() =>
    layout.layers.map((l) => l.id)
  );

  // Track previous open state to detect when modal opens
  // Uses React's official "storing information from previous renders" pattern
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    // Reset selection when modal opens (but not when it closes)
    if (isOpen) {
      setSelectedLayerIds(layout.layers.map((l) => l.id));
    }
  }

  // Get bin counts per layer
  const binCountByLayer = useMemo(
    () => getBinCountByLayer(layout.bins, layout.layers),
    [layout.bins, layout.layers]
  );

  // Measure preview container for scaling
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState<number>(600);

  useEffect(() => {
    if (!isOpen || !previewRef.current) return;

    // Track last width to prevent oscillation from scrollbar appearing/disappearing
    let lastWidth = 0;
    const SCROLLBAR_THRESHOLD = 20; // Ignore changes smaller than scrollbar width

    const measureWidth = () => {
      if (previewRef.current) {
        // Subtract outer container padding (p-4 = 16px each side = 32px)
        // and inner .print-preview padding (24px each side = 48px)
        const width = previewRef.current.clientWidth - 80;
        // Only update if width changed significantly (prevents scrollbar oscillation)
        if (width > 0 && Math.abs(width - lastWidth) > SCROLLBAR_THRESHOLD) {
          lastWidth = width;
          setPreviewWidth(width);
        }
      }
    };

    measureWidth();
    const resizeObserver = new ResizeObserver(measureWidth);
    resizeObserver.observe(previewRef.current);
    return () => resizeObserver.disconnect();
  }, [isOpen]);

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Update a print view setting
  const updatePrintSetting = useCallback(
    <K extends keyof PrintViewSettings>(key: K, value: PrintViewSettings[K]) => {
      updateSetting('printViewSettings', {
        ...settings.printViewSettings,
        [key]: value,
      });
    },
    [settings.printViewSettings, updateSetting]
  );

  // Update sort order
  const updateSortOrder = useCallback(
    (newOrder: BinListSortOrder) => {
      updatePrintSetting('binListSortOrder', newOrder);
    },
    [updatePrintSetting]
  );

  // Handle layer selection
  const toggleLayer = useCallback((layerId: string) => {
    setSelectedLayerIds((prev) => {
      if (prev.includes(layerId)) {
        return prev.filter((id) => id !== layerId);
      }
      return [...prev, layerId];
    });
  }, []);

  const selectAllLayers = useCallback(() => {
    setSelectedLayerIds(layout.layers.map((l) => l.id));
  }, [layout.layers]);

  // Handle print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const printViewSettings = settings.printViewSettings;
  const allLayersSelected = selectedLayerIds.length === layout.layers.length;
  const noLayersSelected = selectedLayerIds.length === 0;

  // Always render the print portal so Cmd+P works even when modal is closed
  // Use same width as preview so they match exactly
  const printPortal = createPortal(
    <div className="print-portal hidden">
      <PrintLayout
        layout={layout}
        selectedLayerIds={selectedLayerIds}
        settings={printViewSettings}
        availableWidth={previewWidth}
      />
    </div>,
    document.body
  );

  // Return only the print portal when modal is closed
  if (!isOpen) return printPortal;

  // Render modal using portal to avoid stacking context issues with parent elements
  return createPortal(
    <>
      {/* Modal overlay (hidden during print) */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in print-modal-overlay no-print"
        style={STYLES.overlay}
        onClick={onClose}
      >
        <div
          className="max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col animate-scale-in"
          style={STYLES.modal}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-modal-title"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 pb-4 border-b border-stroke-subtle print-modal-header">
            <h2 id="print-modal-title" style={STYLES.title}>
              Print Layout
            </h2>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-icon"
              aria-label="Close print dialog"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex print-modal-controls">
            {/* Settings panel */}
            <div className="w-64 flex-shrink-0 border-r border-stroke-subtle p-4 overflow-y-auto scrollbar-thin">
              {/* Layer Selection */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 style={STYLES.sectionHeader}>Layers</h3>
                  {layout.layers.length > 1 && (
                    <button
                      onClick={selectAllLayers}
                      className="text-xs text-accent hover:underline"
                      disabled={allLayersSelected}
                    >
                      Select All
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {layout.layers.map((layer) => {
                    const binCount = binCountByLayer.get(layer.id) ?? 0;
                    return (
                      <label
                        key={layer.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-surface-hover p-1.5 rounded-md -mx-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLayerIds.includes(layer.id)}
                          onChange={() => toggleLayer(layer.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-content flex-1">
                          {layer.name}
                        </span>
                        <span className="text-xs text-content-tertiary">
                          {binCount} bin{binCount !== 1 ? 's' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Include in Print */}
              <div className="mb-6">
                <h3 style={STYLES.sectionHeader} className="mb-3">
                  Include in Print
                </h3>

                {/* Bin Display Options */}
                <div className="mb-4">
                  <div className="text-xs text-content-tertiary mb-2 uppercase tracking-wide">On Bins</div>
                  <div className="space-y-2">
                    <CheckboxOption
                      label="Labels"
                      checked={printViewSettings.showLabel}
                      onChange={(v) => updatePrintSetting('showLabel', v)}
                    />
                    <CheckboxOption
                      label="Categories"
                      checked={printViewSettings.showCategoryColor}
                      onChange={(v) => updatePrintSetting('showCategoryColor', v)}
                    />
                    <CheckboxOption
                      label="Size (WxD)"
                      checked={printViewSettings.showSize}
                      onChange={(v) => updatePrintSetting('showSize', v)}
                    />
                    <CheckboxOption
                      label="Height"
                      checked={printViewSettings.showHeight}
                      onChange={(v) => updatePrintSetting('showHeight', v)}
                    />
                    <CheckboxOption
                      label="Notes"
                      checked={printViewSettings.showNotes}
                      onChange={(v) => updatePrintSetting('showNotes', v)}
                    />
                    <CheckboxOption
                      label="Custom Properties"
                      checked={printViewSettings.showCustomProperties}
                      onChange={(v) => updatePrintSetting('showCustomProperties', v)}
                    />
                  </div>
                </div>

                {/* Header Options */}
                <div className="mb-4">
                  <div className="text-xs text-content-tertiary mb-2 uppercase tracking-wide">Header</div>
                  <div className="space-y-2">
                    <CheckboxOption
                      label="Show Header"
                      checked={printViewSettings.showHeader}
                      onChange={(v) => updatePrintSetting('showHeader', v)}
                    />
                    {printViewSettings.showHeader && (
                      <div className="ml-4 space-y-2 border-l border-stroke-subtle pl-3">
                        <CheckboxOption
                          label="Layout Name"
                          checked={printViewSettings.showLayoutName}
                          onChange={(v) => updatePrintSetting('showLayoutName', v)}
                        />
                        <CheckboxOption
                          label="Drawer Info"
                          checked={printViewSettings.showDrawerInfo}
                          onChange={(v) => updatePrintSetting('showDrawerInfo', v)}
                        />
                        <CheckboxOption
                          label="Date"
                          checked={printViewSettings.showDate}
                          onChange={(v) => updatePrintSetting('showDate', v)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Layout Options */}
                <div>
                  <div className="text-xs text-content-tertiary mb-2 uppercase tracking-wide">Layout</div>
                  <div className="space-y-2">
                    <CheckboxOption
                      label="Grid Coordinates"
                      checked={printViewSettings.showGridCoordinates}
                      onChange={(v) => updatePrintSetting('showGridCoordinates', v)}
                    />
                    <CheckboxOption
                      label="Category Legend"
                      checked={printViewSettings.showLegend}
                      onChange={(v) => updatePrintSetting('showLegend', v)}
                    />
                    <CheckboxOption
                      label="Bin Details Table"
                      checked={printViewSettings.showBinList}
                      onChange={(v) => updatePrintSetting('showBinList', v)}
                    />
                  </div>
                </div>
              </div>

              {/* Bin List Sorting - only show when bin list is enabled */}
              {printViewSettings.showBinList && (
                <div className="mb-6">
                  <h3 style={STYLES.sectionHeader} className="mb-3">
                    Bin List Sorting
                  </h3>
                  <SortOrderConfig
                    sortOrder={printViewSettings.binListSortOrder}
                    onChange={updateSortOrder}
                  />
                </div>
              )}

            </div>

            {/* Preview panel - grid fills available width */}
            <div ref={previewRef} className="flex-1 p-4 overflow-y-auto overflow-x-hidden bg-surface">
              <div className="print-preview">
                <PrintLayout
                  layout={layout}
                  selectedLayerIds={selectedLayerIds}
                  settings={printViewSettings}
                  availableWidth={previewWidth}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-stroke-subtle print-modal-footer">
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={handlePrint}
              disabled={noLayersSelected}
              className="btn btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Print portal - content rendered here will be visible during print */}
      {printPortal}
    </>,
    document.body
  );
}

/**
 * Checkbox option component for settings.
 */
function CheckboxOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer hover:bg-surface-hover p-1.5 rounded-md -mx-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4"
      />
      <span className="text-sm text-content">{label}</span>
    </label>
  );
}
