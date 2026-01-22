interface SectionHeaderProps {
  /** Section title text */
  title: string;
  /** Optional className for additional styling */
  className?: string;
}

/**
 * Section header with consistent uppercase styling.
 * Used for grouping related settings or content.
 */
export function SectionHeader({ title, className = '' }: SectionHeaderProps) {
  return (
    <h3
      className={`text-xs font-medium uppercase tracking-wide mb-3 text-content-tertiary ${className}`}
    >
      {title}
    </h3>
  );
}
