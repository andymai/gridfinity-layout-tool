interface DesignTagChipsProps {
  tags: readonly string[];
  /** Cap how many chips render before a "+N" overflow chip. */
  max?: number;
}

/** Read-only row of tag chips shown on a design card/row. Renders nothing when untagged. */
export function DesignTagChips({ tags, max = 3 }: DesignTagChipsProps) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, max);
  const overflow = tags.length - shown.length;
  // As a plain string (not a JSX-inline literal) so i18next/no-literal-string
  // doesn't flag this non-linguistic count indicator.
  const overflowLabel = `+${overflow}`;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((tag) => (
        <span
          key={tag}
          className="max-w-[8rem] truncate rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-content-secondary"
          title={tag}
        >
          {tag}
        </span>
      ))}
      {overflow > 0 && (
        <span className="rounded-full px-1 py-0.5 text-[10px] font-medium text-content-tertiary">
          {overflowLabel}
        </span>
      )}
    </div>
  );
}
