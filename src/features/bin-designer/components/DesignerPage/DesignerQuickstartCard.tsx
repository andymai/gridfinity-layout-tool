/**
 * One-time orientation card for first-visit /designer landers.
 *
 * Non-modal: floats over the bottom-right of the preview area, never traps
 * focus, and disappears on "Got it", Escape, or the user's first edit
 * (handled by the caller via useDesignerFirstRun).
 */

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';

interface DesignerQuickstartCardProps {
  readonly onDismiss: (method: 'got_it' | 'escape') => void;
}

export function DesignerQuickstartCard({ onDismiss }: DesignerQuickstartCardProps) {
  const t = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss('escape');
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onDismiss]);

  return (
    <div
      className="absolute bottom-4 right-4 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-stroke-subtle bg-surface-elevated shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
      role="region"
      aria-labelledby="designer-quickstart-title"
    >
      <div className="p-4 space-y-3">
        <h3 id="designer-quickstart-title" className="text-sm font-semibold text-content">
          {t('binDesigner.quickstart.title')}
        </h3>

        {/* role="list" restores list semantics that Safari/iOS VoiceOver strips when list-style:none is applied. */}
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
        <ul className="space-y-2 list-none" role="list">
          <FeatureRow icon={<SlidersIcon />} text={t('binDesigner.quickstart.livePreview')} />
          <FeatureRow icon={<CompartmentsIcon />} text={t('binDesigner.quickstart.features')} />
          <FeatureRow icon={<DownloadIcon />} text={t('binDesigner.quickstart.export')} />
        </ul>

        <Button
          type="button"
          variant="primary"
          fullWidth
          onClick={() => onDismiss('got_it')}
          className="px-3 py-1.5 text-xs font-semibold"
        >
          {t('binDesigner.quickstart.dismiss')}
        </Button>
      </div>
    </div>
  );
}

function FeatureRow({ icon, text }: { readonly icon: ReactNode; readonly text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-accent/70" aria-hidden="true">
        {icon}
      </div>
      <span className="text-xs text-content-secondary leading-relaxed">{text}</span>
    </li>
  );
}

// ── Inline SVG icons (20×20) ──────────────────────────────────────────────────

function SlidersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 6h14M3 14h14" strokeLinecap="round" />
      <circle cx="8" cy="6" r="2" fill="currentColor" />
      <circle cx="13" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}

function CompartmentsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="16" height="12" rx="1.5" />
      <path d="M10 4v12M2 10h8" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 15.5h13" strokeLinecap="round" />
    </svg>
  );
}
