import { useState, useId, type ReactNode } from 'react';

interface StickyGroupHeaderProps {
  title: string;
  defaultExpanded?: boolean;
  summary?: string;
  children: ReactNode;
}

export function StickyGroupHeader({
  title,
  defaultExpanded = true,
  summary,
  children,
}: StickyGroupHeaderProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hasToggled, setHasToggled] = useState(false);
  const contentId = useId();

  return (
    <div className="border-b border-stroke-subtle">
      <button
        type="button"
        className="sticky top-0 z-10 flex w-full items-center gap-2 backdrop-blur-sm bg-surface-secondary/90 border-b border-stroke-subtle/50 px-4 py-3 hover:bg-surface-hover/50 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
        onClick={() => {
          setHasToggled(true);
          setExpanded(!expanded);
        }}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <svg
          className={`w-3 h-3 transition-transform duration-200 text-content-tertiary ${expanded ? 'rotate-0' : '-rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-[11px] font-bold text-content-tertiary uppercase tracking-widest">
          {title}
        </span>
      </button>

      {summary && !expanded && (
        <div className="px-4 pb-3 -mt-1 text-xs text-content-tertiary truncate">{summary}</div>
      )}

      <div
        id={contentId}
        role="region"
        aria-label={title}
        aria-hidden={!expanded}
        className={`overflow-hidden ${hasToggled ? 'transition-all duration-200' : ''} ${
          expanded ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
