import { cn, focusRing, interactiveTransition, variantColors } from '@/design-system';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { DOCS_URL } from '@/shared/constants/links';

export interface DocsLinkProps {
  label: string;
  /** Accessible name and hover hint, when the short label needs a longer one. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Opens the user docs in a new tab, like the app's other links to its static
 * pages. Styled as a ghost Button, but an anchor, so middle-click and "open
 * in new tab" work.
 */
export function DocsLink({ label, ariaLabel, className }: DocsLinkProps) {
  return (
    <a
      href={DOCS_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={ariaLabel}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium leading-none',
        interactiveTransition,
        ...focusRing,
        ...variantColors.ghost,
        className
      )}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        {ICON_PATHS.bookOpen.map((d) => (
          <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
        ))}
      </svg>
      <span>{label}</span>
    </a>
  );
}
