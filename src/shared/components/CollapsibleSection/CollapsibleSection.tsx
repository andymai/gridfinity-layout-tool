import { useState, useId, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  /** Section title */
  title: string;
  /** Whether section starts expanded (default: true) */
  defaultExpanded?: boolean;
  /** Content to render inside the section */
  children: ReactNode;
  /** Optional badge to show next to title */
  badge?: ReactNode;
  /** Optional actions to show on the right side of header */
  actions?: ReactNode;
  /** Size variant for the header */
  variant?: 'default' | 'small';
}

/**
 * Collapsible section with animated expand/collapse.
 * Used for sidebar panels to save vertical space.
 */
export function CollapsibleSection({
  title,
  defaultExpanded = true,
  children,
  badge,
  actions,
  variant = 'default',
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Track if user has toggled - only animate after first interaction to prevent CLS
  const [hasToggled, setHasToggled] = useState(false);
  const contentId = useId();

  const headerClass =
    variant === 'small'
      ? 'text-xs font-semibold text-content-tertiary uppercase tracking-wider'
      : 'text-sm font-semibold text-content-secondary tracking-wide';

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 bg-transparent hover:opacity-80 transition-opacity"
          onClick={() => {
            setHasToggled(true);
            setExpanded(!expanded);
          }}
          aria-expanded={expanded}
          aria-controls={contentId}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 text-content-tertiary ${expanded ? 'rotate-0' : '-rotate-90'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span className={headerClass}>{title}</span>
          {badge}
        </button>
        {actions}
      </div>
      <div
        id={contentId}
        className={`overflow-hidden ${hasToggled ? 'transition-all duration-200' : ''} ${
          expanded ? 'opacity-100 max-h-[2000px] mt-3' : 'opacity-0 max-h-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
