/**
 * Quick-start overlay for the cutout workspace.
 *
 * Shows a compact feature reference card on first open, positioned
 * near the top-right of the workspace. Dismisses on "Got it" click or Escape.
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';

interface CutoutQuickstartOverlayProps {
  readonly onDismiss: () => void;
}

export function CutoutQuickstartOverlay({ onDismiss }: CutoutQuickstartOverlayProps) {
  const t = useTranslation();
  const dismissRef = useRef<HTMLButtonElement>(null);

  // Dismiss on Escape and auto-focus the dismiss button
  useEffect(() => {
    dismissRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onDismiss]);

  return (
    <div
      className="absolute top-12 right-3 z-40 w-72 rounded-xl border border-stroke-subtle bg-surface-elevated shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
      role="dialog"
      aria-labelledby="cutout-quickstart-title"
    >
      <div className="p-4 space-y-3">
        <h3 id="cutout-quickstart-title" className="text-sm font-semibold text-content">
          {t('binDesigner.cutoutEditor.quickstart.title')}
        </h3>

        <div className="space-y-2.5">
          <FeatureRow
            icon={<ShapesIcon />}
            text={t('binDesigner.cutoutEditor.quickstart.shapes')}
          />
          <FeatureRow
            icon={<KeyboardIcon />}
            text={t('binDesigner.cutoutEditor.quickstart.shortcuts')}
          />
          <FeatureRow
            icon={<MenuIcon />}
            text={t('binDesigner.cutoutEditor.quickstart.rightClick')}
          />
          <FeatureRow
            icon={<GridIcon />}
            text={t('binDesigner.cutoutEditor.quickstart.precision')}
          />
        </div>

        <button
          ref={dismissRef}
          type="button"
          onClick={onDismiss}
          className="w-full rounded-md px-3 py-1.5 text-xs font-semibold bg-accent text-on-accent hover:bg-accent/90 transition-colors"
        >
          {t('binDesigner.cutoutEditor.quickstart.dismiss')}
        </button>
      </div>
    </div>
  );
}

function FeatureRow({ icon, text }: { readonly icon: ReactNode; readonly text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-accent/70" aria-hidden="true">
        {icon}
      </div>
      <span className="text-xs text-content-secondary leading-relaxed">{text}</span>
    </div>
  );
}

// ── Inline SVG icons (20×20) ──────────────────────────────────────────────────

function ShapesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="8" height="8" rx="1" />
      <circle cx="14" cy="14" r="4" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="4" width="18" height="12" rx="2" />
      <path d="M5 8h2M9 8h2M13 8h2M6 12h8" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="2" width="14" height="16" rx="2" />
      <path d="M6 6h8M6 10h8M6 14h5" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 1h4v4H1zM8 1h4v4H8zM15 1h4v4h-4zM1 8h4v4H1zM8 8h4v4H8zM15 8h4v4h-4zM1 15h4v4H1zM8 15h4v4H8zM15 15h4v4h-4z" />
    </svg>
  );
}
