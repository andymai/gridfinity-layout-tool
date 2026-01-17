import { useState, useEffect, useRef, useMemo } from 'react';
import { useLayoutStore } from '../../store/layout';
import { useLibraryStore } from '../../store/library';
import { useUIStore } from '../../store/ui';
import { useLabsStore } from '../../store/labs';
import {
  generateShareableURL,
  downloadLayoutAsFile,
  copyToClipboard,
  exportLayoutJSON,
} from '../../storage';
import { trackLayoutSnapshot } from '../../utils/analytics';
import { CloudShareTab } from '../CloudShareTab';

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

function ShareModalContent({ onClose, layoutId }: { onClose: () => void; layoutId?: string }) {
  const layout = useLayoutStore((state) => state.layout);
  const activeLayoutId = useLibraryStore((state) => state.library.activeLayoutId);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);

  // When collaborative_editing is enabled, cloud sharing is handled by the ShareButton instead
  const isCollabEnabled = useLabsStore((state) =>
    state.isFeatureEnabled('collaborative_editing')
  );

  // Use provided layoutId or fall back to active layout
  const targetLayoutId = layoutId ?? activeLayoutId;

  // Default to 'url' tab when collaborative editing is enabled (Cloud tab hidden)
  const [activeTab, setActiveTab] = useState<'cloud' | 'url' | 'file' | 'json'>(
    isCollabEnabled ? 'url' : 'cloud'
  );
  const [copied, setCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Compute shareURL from layout (memoized to avoid recomputing on every render)
  const shareURL = useMemo(() => generateShareableURL(layout), [layout]);

  useEffect(() => {
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
      announceToScreenReader('Link copied to clipboard');
      trackLayoutSnapshot(layout, 'export_url');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyJSON = async () => {
    const json = exportLayoutJSON(layout);
    const success = await copyToClipboard(json);
    if (success) {
      setCopied(true);
      announceToScreenReader('JSON copied to clipboard');
      trackLayoutSnapshot(layout, 'export_json');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    downloadLayoutAsFile(layout);
    announceToScreenReader('Layout downloaded');
    trackLayoutSnapshot(layout, 'export_json');
  };

  const jsonText = exportLayoutJSON(layout);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="bg-surface-elevated rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="share-modal-title" className="text-2xl font-bold text-content">
            Share Layout
          </h2>
          <button
            onClick={onClose}
            className="text-content-tertiary hover:text-content transition-colors"
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

        {/* Tab selector */}
        <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1" role="tablist">
          {/* Cloud tab hidden when collaborative_editing is enabled (uses ShareButton instead) */}
          {!isCollabEnabled && (
            <button
              role="tab"
              aria-selected={activeTab === 'cloud'}
              onClick={() => setActiveTab('cloud')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'cloud'
                  ? 'bg-accent text-white'
                  : 'text-content-secondary hover:text-content hover:bg-surface-hover'
              }`}
            >
              Cloud
            </button>
          )}
          <button
            role="tab"
            aria-selected={activeTab === 'url'}
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'url'
                ? 'bg-accent text-white'
                : 'text-content-secondary hover:text-content hover:bg-surface-hover'
            }`}
          >
            Link
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'file'}
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'file'
                ? 'bg-accent text-white'
                : 'text-content-secondary hover:text-content hover:bg-surface-hover'
            }`}
          >
            File
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'json'}
            onClick={() => setActiveTab('json')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'json'
                ? 'bg-accent text-white'
                : 'text-content-secondary hover:text-content hover:bg-surface-hover'
            }`}
          >
            JSON
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Cloud tab content only shown when flag is OFF */}
          {!isCollabEnabled && activeTab === 'cloud' && (
            <CloudShareTab
              layoutId={targetLayoutId}
              onClose={onClose}
              onSwitchToUrlTab={() => setActiveTab('url')}
            />
          )}

          {activeTab === 'url' && (
            <div className="space-y-4">
              <p className="text-sm text-content-secondary">
                Share this link with others. They can open it to import your layout directly.
              </p>
              <div className="flex gap-2">
                <input
                  ref={urlInputRef}
                  type="text"
                  value={shareURL}
                  readOnly
                  onClick={() => urlInputRef.current?.select()}
                  className="flex-1 bg-surface text-content p-3 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  onClick={handleCopyURL}
                  className="btn btn-primary px-4"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="text-xs text-content-tertiary">
                Note: Very large layouts may create long URLs that don't work in some browsers.
              </div>
            </div>
          )}

          {activeTab === 'file' && (
            <div className="space-y-4">
              <p className="text-sm text-content-secondary">
                Download your layout as a JSON file. This file can be imported later or shared with others.
              </p>
              <div className="bg-surface rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-content">{layout.name}.json</div>
                    <div className="text-sm text-content-secondary">
                      {layout.drawer.width}×{layout.drawer.depth} grid • {layout.bins.length} bins • {layout.layers.length} layers
                    </div>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="btn btn-primary"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-4 flex-1 flex flex-col">
              <p className="text-sm text-content-secondary">
                Copy the raw JSON data. Paste it into the Import dialog or save it yourself.
              </p>
              <textarea
                ref={jsonTextareaRef}
                value={jsonText}
                readOnly
                onClick={() => jsonTextareaRef.current?.select()}
                className="flex-1 bg-surface text-content p-3 rounded font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-accent min-h-[200px]"
              />
              <button
                onClick={handleCopyJSON}
                className="btn btn-primary self-start"
              >
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
