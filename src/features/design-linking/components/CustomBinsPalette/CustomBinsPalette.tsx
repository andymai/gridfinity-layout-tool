/**
 * Custom Bins Palette - Sidebar section for placing saved designs.
 *
 * Shows saved designs from the Bin Designer as draggable cards.
 * Dragging a design onto the grid creates a linked bin.
 */

import { useCallback } from 'react';
import { useCustomBins } from '@/features/bin-designer/hooks/useCustomBins';
import { CustomBinCard } from './CustomBinCard';
import { useTranslation } from '@/i18n';

interface CustomBinsPaletteProps {
  /** Whether the section is expanded */
  isExpanded?: boolean;
  /** Callback when expansion state changes */
  onToggleExpand?: () => void;
}

export function CustomBinsPalette({
  isExpanded = true,
  onToggleExpand,
}: CustomBinsPaletteProps) {
  const t = useTranslation();
  const customBins = useCustomBins();

  const handleOpenDesigner = useCallback(() => {
    window.history.pushState(null, '', '/designer');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return (
    <div className="border-b border-stroke-subtle">
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-content">
          {t('designLinking.palette.title')}
        </span>
        <div className="flex items-center gap-2">
          {customBins.length > 0 && (
            <span className="text-xs text-content-tertiary bg-surface-elevated px-1.5 py-0.5 rounded">
              {customBins.length}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-content-tertiary transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {customBins.length === 0 ? (
            // Empty state
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-elevated flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-content-disabled"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <p className="text-sm text-content-secondary mb-1">
                {t('designLinking.palette.empty')}
              </p>
              <p className="text-xs text-content-disabled mb-4">
                {t('designLinking.palette.emptyHint')}
              </p>
              <button
                onClick={handleOpenDesigner}
                className="btn btn-secondary btn-sm"
              >
                {t('designLinking.palette.openDesigner')}
              </button>
            </div>
          ) : (
            // Design grid
            <div className="grid grid-cols-2 gap-2">
              {customBins.map((design) => (
                <CustomBinCard key={design.id} design={design} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
