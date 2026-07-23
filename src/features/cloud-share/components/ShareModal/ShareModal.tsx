import { useState, useEffect, useRef, useMemo } from 'react';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import { useInteractionStore } from '@/core/store/interaction';
import {
  generateShareableURL,
  downloadLayoutAsFile,
  copyToClipboard,
  exportLayoutJSON,
  loadLayoutAsync,
} from '@/core/storage';
import { trackEvent } from '@/shared/analytics/posthog';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { useTranslation } from '@/i18n';
import { Button, IconButton, XIcon } from '@/design-system';
import type { Layout } from '@/core/types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  layoutId?: string; // If provided, share this layout; otherwise use active layout
}

// Wrapper that only mounts the inner component when open
export function ShareModal({ isOpen, onClose, layoutId }: ShareModalProps) {
  if (!isOpen) return null;
  return <ShareModalContent onClose={onClose} layoutId={layoutId} />;
}

// Resolves the target layout: the active layout comes from the store; any
// other layout is loaded from storage so the URL/file/JSON reflect the
// layout the user actually picked, not whichever one is active.
function ShareModalContent({ onClose, layoutId }: { onClose: () => void; layoutId?: string }) {
  const activeLayout = useLayoutStore((state) => state.layout);
  const activeLayoutId = useLibraryStore((state) => state.library.activeLayoutId);
  const [loadedLayout, setLoadedLayout] = useState<Layout | null>(null);
  const isTargetActive = !layoutId || layoutId === activeLayoutId;

  useEffect(() => {
    if (isTargetActive || !layoutId) return;
    let cancelled = false;
    void loadLayoutAsync(layoutId).then((loaded) => {
      if (cancelled) return;
      if (loaded) {
        setLoadedLayout(loaded);
      } else {
        onClose();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [layoutId, isTargetActive, onClose]);

  const layout = isTargetActive ? activeLayout : loadedLayout;
  if (!layout) return null;

  return <ShareModalBody layout={layout} onClose={onClose} />;
}

function ShareModalBody({ layout, onClose }: { layout: Layout; onClose: () => void }) {
  const t = useTranslation();
  const announceToScreenReader = useInteractionStore((state) => state.announceToScreenReader);

  const [activeTab, setActiveTab] = useState<'url' | 'file' | 'json'>('url');

  // Track tab switches for share funnel analysis
  const handleTabChange = (tab: 'url' | 'file' | 'json') => {
    setActiveTab(tab);
    trackEvent('ui.featureUsed', { feature: `share_tab_${tab}` });
  };
  const [copied, setCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Compute shareURL from layout (memoized to avoid recomputing on every render)
  const shareURL = useMemo(() => generateShareableURL(layout), [layout]);

  // Track modal open and handle escape key
  useEffect(() => {
    trackEvent('ui.modalOpen', { modal: 'share' });

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleCopyURL = async () => {
    const success = await copyToClipboard(shareURL);
    if (success) {
      setCopied(true);
      announceToScreenReader(t('toast.linkCopied'));
      trackEvent('ui.layoutExported', { format: 'url' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyJSON = async () => {
    const json = exportLayoutJSON(layout);
    const success = await copyToClipboard(json);
    if (success) {
      setCopied(true);
      announceToScreenReader(t('toast.jsonCopied'));
      trackEvent('ui.layoutExported', { format: 'json' });
      mlTracking.trackSnapshot('export_json');
      mlTracking.trackQuality('exported');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    await downloadLayoutAsFile(layout);
    announceToScreenReader(t('share.file.downloaded'));
    trackEvent('ui.layoutExported', { format: 'json' });
    mlTracking.trackSnapshot('export_json');
    mlTracking.trackQuality('exported');
  };

  const jsonText = exportLayoutJSON(layout);

  return (
    <div
      className="fixed inset-0 bg-overlay-dark flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClose();
      }}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        className="bg-surface-elevated rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        tabIndex={-1}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="share-modal-title" className="text-2xl font-bold text-content">
            {t('share.title')}
          </h2>
          <IconButton
            onClick={onClose}
            touchTarget={false}
            className="-m-2 text-content-tertiary hover:text-content"
            aria-label={t('common.close')}
          >
            <XIcon size="md" />
          </IconButton>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1" role="tablist">
          <Button
            variant="ghost"
            role="tab"
            aria-selected={activeTab === 'url'}
            onClick={() => handleTabChange('url')}
            className={`flex-1 hover:bg-transparent ${
              activeTab === 'url'
                ? 'bg-accent text-on-dark'
                : 'text-content-secondary hover:text-content hover:bg-surface-hover'
            }`}
          >
            {t('share.tabs.link')}
          </Button>
          <Button
            variant="ghost"
            role="tab"
            aria-selected={activeTab === 'file'}
            onClick={() => handleTabChange('file')}
            className={`flex-1 hover:bg-transparent ${
              activeTab === 'file'
                ? 'bg-accent text-on-dark'
                : 'text-content-secondary hover:text-content hover:bg-surface-hover'
            }`}
          >
            {t('share.tabs.file')}
          </Button>
          <Button
            variant="ghost"
            role="tab"
            aria-selected={activeTab === 'json'}
            onClick={() => handleTabChange('json')}
            className={`flex-1 hover:bg-transparent ${
              activeTab === 'json'
                ? 'bg-accent text-on-dark'
                : 'text-content-secondary hover:text-content hover:bg-surface-hover'
            }`}
          >
            {t('share.tabs.json')}
          </Button>
        </div>

        {/* Tab content */}
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'url' && (
            <div className="space-y-4">
              <p className="text-sm text-content-secondary">{t('share.link.description')}</p>
              <div className="flex gap-2">
                <input
                  ref={urlInputRef}
                  type="text"
                  value={shareURL}
                  readOnly
                  onClick={() => urlInputRef.current?.select()}
                  className="flex-1 bg-surface text-content p-3 rounded font-mono text-sm"
                />
                <Button variant="primary" onClick={handleCopyURL}>
                  {copied ? t('common.copied') : t('common.copy')}
                </Button>
              </div>
              <div className="text-xs text-content-tertiary">{t('share.link.longUrlNote')}</div>
            </div>
          )}

          {activeTab === 'file' && (
            <div className="space-y-4">
              <p className="text-sm text-content-secondary">{t('share.file.description')}</p>
              <div className="bg-surface rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-content">
                      {t('share.layoutFilename', { name: layout.name })}
                    </div>
                    <div className="text-sm text-content-secondary">
                      {t('share.layoutSummary', {
                        grid: `${layout.drawer.width}×${layout.drawer.depth}`,
                        bins: layout.bins.length,
                        layers: layout.layers.length,
                      })}
                    </div>
                  </div>
                  <Button variant="primary" onClick={handleDownload}>
                    {t('common.download')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-4 flex-1 flex flex-col">
              <p className="text-sm text-content-secondary">{t('share.json.description')}</p>
              <textarea
                ref={jsonTextareaRef}
                value={jsonText}
                readOnly
                onClick={() => jsonTextareaRef.current?.select()}
                className="flex-1 bg-surface text-content p-3 rounded font-mono text-xs resize-none min-h-[200px]"
              />
              <Button variant="primary" onClick={handleCopyJSON} className="self-start">
                {copied ? t('share.json.copied') : t('share.json.copy')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
