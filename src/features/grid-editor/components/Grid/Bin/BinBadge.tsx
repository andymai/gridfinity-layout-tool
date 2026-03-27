interface BinBadgeProps {
  small: boolean;
  label: string;
  path: string;
  colorClass?: string;
  fillRule?: 'evenodd';
}

export function BinBadge({
  small,
  label,
  path,
  colorClass = 'text-content-tertiary',
  fillRule,
}: BinBadgeProps) {
  const sizeClass = small ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const strokeWidth = small ? 2.5 : 2;
  return (
    <div
      className={`${small ? 'p-px' : 'p-0.5'} rounded-sm bg-surface/80`}
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <svg
        className={`${sizeClass} ${colorClass}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        aria-label={label}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={path}
          {...(fillRule ? { fillRule, clipRule: fillRule } : {})}
        />
      </svg>
    </div>
  );
}
