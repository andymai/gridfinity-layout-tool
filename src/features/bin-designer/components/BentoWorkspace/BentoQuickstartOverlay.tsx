/**
 * Quick-start card for the Bento workspace, shown on first open.
 *
 * The three things that are not guessable from looking at the empty grid:
 * that dragging draws a compartment, that compartments then move and resize
 * like layout bins (Alt-drag duplicates), and that the shelf at the bottom
 * is a stash compartments can be dropped on and pulled back from.
 */

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';

interface BentoQuickstartOverlayProps {
  readonly onDismiss: () => void;
}

export function BentoQuickstartOverlay({ onDismiss }: BentoQuickstartOverlayProps) {
  const t = useTranslation();
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dismissRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Capture-phase stop, so the first Escape dismisses the card rather
        // than closing the whole workspace out from under it.
        e.stopPropagation();
        onDismiss();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onDismiss]);

  return (
    <div
      className="absolute right-3 top-14 z-40 w-80 animate-in fade-in slide-in-from-top-2 rounded-xl border border-stroke-subtle bg-surface-elevated shadow-lg duration-200"
      role="dialog"
      aria-labelledby="bento-quickstart-title"
    >
      <div className="space-y-3 p-4">
        <h3 id="bento-quickstart-title" className="text-sm font-semibold text-content">
          {t('binDesigner.bento.quickstart.title')}
        </h3>

        {/* role="list" restores list semantics that Safari/iOS VoiceOver strips when list-style:none is applied. */}
        <ul className="list-none space-y-2" role="list">
          <QuickstartRow text={t('binDesigner.bento.quickstart.draw')} />
          <QuickstartRow text={t('binDesigner.bento.quickstart.moveResize')} />
          <QuickstartRow text={t('binDesigner.bento.quickstart.merge')} />
          <QuickstartRow text={t('binDesigner.bento.quickstart.stash')} />
        </ul>

        <Button ref={dismissRef} variant="primary" size="sm" className="w-full" onClick={onDismiss}>
          {t('binDesigner.cutoutEditor.quickstart.dismiss')}
        </Button>
      </div>
    </div>
  );
}

function QuickstartRow({ text }: { readonly text: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed text-content-secondary">
      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-accent" />
      <span>{text}</span>
    </li>
  );
}
