/**
 * Quick-start overlay for the cutout workspace.
 *
 * Shows a compact feature reference card on first open, positioned
 * near the top-right of the workspace. Dismisses on "Got it" click or Escape.
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';

interface CutoutQuickstartOverlayProps {
  readonly onDismiss: () => void;
}

export function CutoutQuickstartOverlay({ onDismiss }: CutoutQuickstartOverlayProps) {
  const t = useTranslation();
  const dismissRef = useRef<HTMLButtonElement>(null);

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
      className="absolute top-12 right-3 z-40 w-80 rounded-xl border border-stroke-subtle bg-surface-elevated shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
      role="dialog"
      aria-labelledby="cutout-quickstart-title"
    >
      <div className="p-4 space-y-3">
        <h3 id="cutout-quickstart-title" className="text-sm font-semibold text-content">
          {t('binDesigner.cutoutEditor.quickstart.title')}
        </h3>

        {/* role="list" restores list semantics that Safari/iOS VoiceOver strips when list-style:none is applied. */}
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
        <ul className="space-y-2 list-none" role="list">
          <FeatureRow
            index={0}
            icon={<ShapesIcon />}
            text={t('binDesigner.cutoutEditor.quickstart.shapes')}
          />
          <FeatureRow
            index={1}
            icon={<SelectIcon />}
            text={t('binDesigner.cutoutEditor.quickstart.select')}
          />
          <FeatureRow
            index={2}
            icon={<VertexIcon />}
            text={t('binDesigner.cutoutEditor.quickstart.vertex')}
          />
          <FeatureRow
            index={3}
            icon={<MenuIcon />}
            text={t('binDesigner.cutoutEditor.quickstart.rightClick')}
          />
          <FeatureRow
            index={4}
            icon={<GridIcon />}
            text={t('binDesigner.cutoutEditor.quickstart.precision')}
          />
        </ul>

        <Button
          ref={dismissRef}
          type="button"
          variant="primary"
          fullWidth
          onClick={onDismiss}
          className="px-3 py-1.5 text-xs font-semibold"
        >
          {t('binDesigner.cutoutEditor.quickstart.dismiss')}
        </Button>
      </div>
    </div>
  );
}

function FeatureRow({
  index,
  icon,
  text,
}: {
  readonly index: number;
  readonly icon: ReactNode;
  readonly text: string;
}) {
  return (
    <li className="group/row flex items-start gap-2.5 rounded-md -mx-1 px-1 py-1 transition-colors hover:bg-surface/60">
      <div
        className="flex-shrink-0 w-5 h-5 mt-0.5 text-accent/70 group-hover/row:text-accent transition-all duration-200 ease-out group-hover/row:scale-110 animate-quickstart-icon-intro"
        style={{ animationDelay: `${index * 60}ms` }}
        aria-hidden="true"
      >
        {icon}
      </div>
      <span className="text-xs text-content-secondary leading-relaxed">{text}</span>
    </li>
  );
}

// ── Inline SVG icons (20×20) ──────────────────────────────────────────────────

function ShapesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2.5" width="7" height="7" rx="1" />
      <circle cx="14" cy="14" r="3.5" />
      <path d="M3 16 L8 11 L9 13 L12 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SelectIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="11" height="11" rx="0.5" strokeDasharray="2 1.5" />
      <path
        d="M11 9 L11 18 L13.5 15.5 L15.5 19 L17 18.2 L15 15 L18 14.5 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VertexIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 14 C 6 4, 14 4, 17 14" strokeLinecap="round" />
      <circle cx="3" cy="14" r="1.5" fill="currentColor" />
      <circle cx="10" cy="6.5" r="1.5" fill="currentColor" />
      <circle cx="17" cy="14" r="1.5" fill="currentColor" />
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
