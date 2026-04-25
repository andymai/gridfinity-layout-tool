import type { RefObject } from 'react';
import type { LayerViewMode } from '@/core/store/view';
import type { SceneHandle } from './Scene';
import type { Layer } from '@/core/types';
import { useTranslation } from '@/i18n';

interface IsometricPreviewControlsProps {
  sceneRef: RefObject<SceneHandle | null>;
  isPreviewExpanded: boolean;
  isMobile: boolean;
  isTablet: boolean;
  layers: readonly Layer[];
  layerViewMode: LayerViewMode;
  isExplodedView: boolean;
  showBananaScale: boolean;
  setLayerViewMode: (mode: LayerViewMode) => void;
  togglePreviewExpanded: () => void;
  setPreviewExpanded: (expanded: boolean) => void;
  toggleIsometricPreview: () => void;
  toggleExplodedView: () => void;
  updateBananaScale: (show: boolean) => void;
}

/**
 * Camera preset buttons, layer view mode selector, expand/collapse,
 * close button, and keyboard shortcuts indicator for the isometric preview.
 */
export function IsometricPreviewControls({
  sceneRef,
  isPreviewExpanded,
  isMobile,
  isTablet,
  layers,
  layerViewMode,
  isExplodedView,
  showBananaScale,
  setLayerViewMode,
  togglePreviewExpanded,
  setPreviewExpanded,
  toggleIsometricPreview,
  toggleExplodedView,
  updateBananaScale,
}: IsometricPreviewControlsProps) {
  const t = useTranslation();

  return (
    <>
      {/* Camera preset buttons */}
      <div
        className={`absolute top-1 left-1/2 transform -translate-x-1/2 flex ${
          isPreviewExpanded && !isMobile ? 'gap-1 p-1 rounded-lg bg-surface/50' : 'gap-0.5'
        }`}
      >
        {/* Isometric view - 3D cube */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            sceneRef.current?.setPreset('isometric');
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          }`}
          title={t('grid.isometricView')}
        >
          <svg
            className={isPreviewExpanded && !isMobile ? 'w-4 h-4' : 'w-4 h-4'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          {isPreviewExpanded && !isMobile && <span className="text-xs font-medium">3D</span>}
        </button>
        {/* Front view - rectangle wider than tall */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            sceneRef.current?.setPreset('front');
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          }`}
          title={t('grid.frontView')}
        >
          <svg
            className={isPreviewExpanded && !isMobile ? 'w-4 h-4' : 'w-4 h-4'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            {/* Wide rectangle - front elevation */}
            <rect x="3" y="8" width="18" height="10" strokeWidth={2} rx="1" />
            <line x1="3" y1="13" x2="21" y2="13" strokeWidth={1.5} />
          </svg>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">{t('grid.front')}</span>
          )}
        </button>
        {/* Side view - rectangle taller than wide */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            sceneRef.current?.setPreset('side');
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          }`}
          title={t('grid.sideView')}
        >
          <svg
            className={isPreviewExpanded && !isMobile ? 'w-4 h-4' : 'w-4 h-4'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            {/* Tall rectangle - side elevation */}
            <rect x="7" y="3" width="10" height="18" strokeWidth={2} rx="1" />
            <line x1="7" y1="12" x2="17" y2="12" strokeWidth={1.5} />
          </svg>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">{t('grid.side')}</span>
          )}
        </button>
        {/* Banana for scale toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateBananaScale(!showBananaScale);
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          } ${showBananaScale ? 'text-yellow-400' : ''}`}
          title={t('grid.bananaForScale')}
        >
          {/* eslint-disable-next-line i18next/no-literal-string -- emoji icon */}
          <span className={isPreviewExpanded && !isMobile ? 'text-base' : 'text-sm'}>🍌</span>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">{t('grid.bananaForScale')}</span>
          )}
        </button>
      </div>

      {/* Layer view mode selector - segmented control, only show when multiple layers */}
      {layers.length > 1 && (
        <div
          className={`absolute bottom-1 right-1 flex rounded-lg overflow-hidden ${
            isPreviewExpanded && !isMobile
              ? 'gap-0.5 p-1 bg-surface/50'
              : 'bg-surface-secondary/80 border border-stroke-subtle'
          }`}
        >
          {/* Focus - show only active layer */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayerViewMode('focus');
            }}
            className={`flex items-center justify-center transition-colors ${
              isPreviewExpanded && !isMobile
                ? `btn ${layerViewMode === 'focus' ? 'btn-primary' : 'btn-ghost'} gap-2 px-3 py-2 rounded-md`
                : `w-7 h-7 ${layerViewMode === 'focus' ? 'bg-accent text-on-dark' : 'hover:bg-surface-elevated'}`
            }`}
            title={t('grid.focusShowOnlyActiveLayer')}
          >
            <svg
              className={isPreviewExpanded && !isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Single layer icon */}
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
            </svg>
            {isPreviewExpanded && !isMobile && <span className="text-xs">{t('grid.focus')}</span>}
          </button>
          {/* Stack - show active layer and below */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayerViewMode('stack');
            }}
            className={`flex items-center justify-center transition-colors ${
              isPreviewExpanded && !isMobile
                ? `btn ${layerViewMode === 'stack' ? 'btn-primary' : 'btn-ghost'} gap-2 px-3 py-2 rounded-md`
                : `w-7 h-7 ${layerViewMode === 'stack' ? 'bg-accent text-on-dark' : 'hover:bg-surface-elevated'}`
            }`}
            title={t('grid.stackShowActiveLayerAndBelow')}
          >
            <svg
              className={isPreviewExpanded && !isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Two layers stacked */}
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            {isPreviewExpanded && !isMobile && <span className="text-xs">{t('grid.stack')}</span>}
          </button>
          {/* All - show all layers */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayerViewMode('all');
            }}
            className={`flex items-center justify-center transition-colors ${
              isPreviewExpanded && !isMobile
                ? `btn ${layerViewMode === 'all' ? 'btn-primary' : 'btn-ghost'} gap-2 px-3 py-2 rounded-md`
                : `w-7 h-7 ${layerViewMode === 'all' ? 'bg-accent text-on-dark' : 'hover:bg-surface-elevated'}`
            }`}
            title={t('grid.allShowAllLayers')}
          >
            <svg
              className={isPreviewExpanded && !isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Three layers stacked */}
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            {isPreviewExpanded && !isMobile && <span className="text-xs">{t('grid.all')}</span>}
          </button>
          {/* Explode — separate layers vertically (desktop only) */}
          {!isMobile && !isTablet && (
            <>
              {/* Separator */}
              <div
                className={`${isPreviewExpanded ? 'w-px h-6 mx-0.5' : 'w-px h-4 mx-0'} bg-stroke-subtle/50 self-center`}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExplodedView();
                }}
                className={`flex items-center justify-center transition-colors ${
                  isPreviewExpanded
                    ? `btn ${isExplodedView ? 'btn-primary' : 'btn-ghost'} gap-2 px-3 py-2 rounded-md`
                    : `w-7 h-7 ${isExplodedView ? 'bg-accent text-on-dark' : 'hover:bg-surface-elevated'}`
                }`}
                title={t('grid.explodedView.toggle')}
              >
                <svg
                  className={isPreviewExpanded ? 'w-5 h-5' : 'w-3.5 h-3.5'}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {/* Three layers spreading apart vertically */}
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 14l10 5 10-5" />
                  <path d="M2 20l10 5 10-5" />
                </svg>
                {isPreviewExpanded && (
                  <span className="text-xs">{t('grid.explodedView.label')}</span>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Top button row */}
      <div
        className={`absolute top-1 right-1 flex ${
          isPreviewExpanded && !isMobile ? 'gap-1 p-1 rounded-lg bg-surface/50' : 'gap-0.5'
        }`}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePreviewExpanded();
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          }`}
          title={isPreviewExpanded ? t('grid.preview.collapse') : t('grid.preview.expand')}
        >
          {isPreviewExpanded ? (
            <>
              <svg
                className={isMobile ? 'w-4 h-4' : 'w-5 h-5'}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 9L4 4m0 0v4m0-4h4m6 6l5 5m0 0v-4m0 4h-4M9 15l-5 5m0 0v-4m0 4h4m6-6l5-5m0 0v4m0-4h-4"
                />
              </svg>
              {!isMobile && <span className="text-xs font-medium">{t('grid.collapse')}</span>}
            </>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
              />
            </svg>
          )}
        </button>
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isPreviewExpanded) {
              setPreviewExpanded(false);
            } else {
              toggleIsometricPreview();
            }
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          }`}
          title={isPreviewExpanded ? t('grid.preview.collapse') : t('grid.preview.close')}
        >
          <svg
            className={isPreviewExpanded && !isMobile ? 'w-5 h-5' : 'w-4 h-4'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">{t('common.close')}</span>
          )}
        </button>
      </div>

      {/* Keyboard shortcuts indicator - only shown in expanded mode on desktop */}
      {isPreviewExpanded && !isMobile && !isTablet && (
        <div
          className="absolute bottom-16 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg text-xs"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-floating)',
            pointerEvents: 'none',
          }}
        >
          <div className="flex items-center gap-4 text-content-secondary">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content leading-none">
                V
              </kbd>{' '}
              {t('grid.toggle')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content leading-none">
                Space
              </kbd>{' '}
              {t('grid.expand')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content leading-none">
                R
              </kbd>{' '}
              {t('common.reset')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content leading-none">
                Esc
              </kbd>{' '}
              {t('common.close')}
            </span>
            {layers.length > 1 && (
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content leading-none">
                  E
                </kbd>{' '}
                {t('grid.explodedView.label')}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
