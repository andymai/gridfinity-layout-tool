import { RulerIcon } from '@/design-system/Icon';

/** Small tertiary hint paragraph. */
export function Hint({ children }: { children: string }) {
  return <p className="text-label leading-relaxed text-content-tertiary">{children}</p>;
}

/**
 * Uppercase label separating the families of controls inside one section.
 *
 * The third level of the panel's hierarchy, under the group's sticky header and
 * the section it heads, deliberately quieter than either, so a section reads as
 * grouped rather than as several sections.
 */
export function SubHeader({ children }: { children: string }) {
  return (
    <span className="block text-label font-semibold uppercase tracking-wider text-content-tertiary">
      {children}
    </span>
  );
}

/** Read-out row (ruler icon + tabular text). */
export function Readout({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
      <RulerIcon size="xs" />
      <span className="tabular-nums">{children}</span>
    </div>
  );
}
