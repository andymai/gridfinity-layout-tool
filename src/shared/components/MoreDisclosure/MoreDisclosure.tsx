/**
 * The panel's one progressive-disclosure idiom: a chevron row folding
 * secondary controls, replacing the old mix of AdvancedDisclosure,
 * Collapsible-"Advanced" and FeatureToggle-"Customize" spellings.
 *
 * Opens itself when its values are non-default — a customization must never
 * be invisible — but unlike the old forceOpen lock the user can always close
 * it; a later false→true transition (a jump link or quick fix changed a value
 * inside) re-opens it. Children stay mounted while closed (`inert` + hidden)
 * so help-jump deep links can find their target, and the disclosure listens
 * for the dispatcher's broadcast to open itself when the target is a
 * descendant.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, ChevronDownIcon, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import {
  HELP_JUMP_ANY_EVENT,
  HELP_TARGET_ATTR,
  type HelpJumpEventDetail,
} from '@/shared/help/helpJumpDispatcher';

export interface MoreDisclosureProps {
  /** Row label. Defaults to the shared "More". */
  readonly label?: string;
  /** Compact summary of the folded values, shown while closed. */
  readonly summary?: string;
  /** Values inside differ from their defaults: auto-open and dot the row. */
  readonly nonDefault?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

export function MoreDisclosure({
  label,
  summary,
  nonDefault = false,
  children,
  className,
}: MoreDisclosureProps) {
  const t = useTranslation();
  const [open, setOpen] = useState(nonDefault);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevNonDefault = useRef(nonDefault);

  useEffect(() => {
    if (nonDefault && !prevNonDefault.current) setOpen(true);
    prevNonDefault.current = nonDefault;
  }, [nonDefault]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<HelpJumpEventDetail>).detail;
      if (!detail?.controlId || !contentRef.current) return;
      const selector = `[${HELP_TARGET_ATTR}="${CSS.escape(detail.controlId)}"]`;
      const target = document.querySelector(selector);
      // Open when the jump lands inside this disclosure OR on a marker that
      // wraps it (a section-level target whose controls are the fold).
      if (target && (contentRef.current.contains(target) || target.contains(contentRef.current))) {
        setOpen(true);
      }
    };
    window.addEventListener(HELP_JUMP_ANY_EVENT, handler);
    return () => window.removeEventListener(HELP_JUMP_ANY_EVENT, handler);
  }, []);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex h-auto items-center gap-1.5 px-0 py-0 text-label font-normal text-content-tertiary transition-colors hover:bg-transparent hover:text-content-secondary"
        >
          <ChevronDownIcon
            size="xs"
            className={cn('transition-transform', open ? 'rotate-0' : '-rotate-90')}
            aria-hidden="true"
          />
          <span>{label ?? t('common.more')}</span>
          {!open && nonDefault && (
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
          )}
        </Button>
        {/* Outside the button so the summary never pollutes its accessible name. */}
        {!open && summary && (
          <span className="truncate text-label font-medium text-content-secondary">{summary}</span>
        )}
      </div>
      {/* Children stay mounted while closed so a help-jump can find its
          target; `inert` + aria-hidden take them out of tab order and the
          accessibility tree, matching Collapsible's contract. */}
      <div
        ref={contentRef}
        aria-hidden={!open}
        inert={!open ? true : undefined}
        className={cn(
          'overflow-hidden',
          open ? 'ml-3.5 mt-2 max-h-none space-y-2 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        {children}
      </div>
    </div>
  );
}
