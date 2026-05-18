import { useState, useId, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  /** Section title */
  title: string;
  /** Whether section starts expanded (default: true). Ignored when `expanded` is provided. */
  defaultExpanded?: boolean;
  /**
   * Controlled expanded state. When provided, the component becomes controlled
   * and `onExpandedChange` should be wired to a parent setter — enables external
   * triggers like help-modal deep-links to force a section open.
   */
  expanded?: boolean;
  /** Called when user toggles. Required for controlled mode to behave correctly. */
  onExpandedChange?: (next: boolean) => void;
  /** Content to render inside the section */
  children: ReactNode;
  /** Optional badge to show next to title */
  badge?: ReactNode;
  /** Optional actions to show on the right side of header */
  actions?: ReactNode;
  /** Size variant for the header */
  variant?: 'default' | 'small';
  /** Optional icon shown before the title */
  icon?: ReactNode;
  /** Optional summary shown when section is collapsed (e.g., "2×2×3u") */
  summary?: ReactNode;
}

/**
 * Collapsible section with animated expand/collapse.
 * Used for sidebar panels to save vertical space.
 */
export function CollapsibleSection({
  title,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onExpandedChange,
  children,
  badge,
  actions,
  variant = 'default',
  icon,
  summary,
}: CollapsibleSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const setExpanded = (next: boolean) => {
    if (!isControlled) setInternalExpanded(next);
    onExpandedChange?.(next);
  };
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
          className="flex items-center gap-2 bg-transparent rounded hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-accent"
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
          {icon && <span className="flex-shrink-0 text-content-tertiary">{icon}</span>}
          <span className={headerClass}>{title}</span>
          {badge}
        </button>
        {actions}
      </div>
      {summary && !expanded && (
        <div
          className={`mt-1 text-xs text-content-tertiary truncate ${
            icon ? 'ml-[38px]' : 'ml-[22px]'
          }`}
        >
          {summary}
        </div>
      )}
      <div
        id={contentId}
        role="region"
        aria-label={title}
        aria-hidden={!expanded}
        className={`overflow-hidden ${hasToggled ? 'transition-all duration-200' : ''} ${
          expanded ? 'opacity-100 max-h-[2000px] mt-3' : 'opacity-0 max-h-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
