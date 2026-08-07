import { RulerIcon } from '@/design-system/Icon';

/** Small tertiary hint paragraph. */
export function Hint({ children }: { children: string }) {
  return <p className="text-[11px] leading-relaxed text-content-tertiary">{children}</p>;
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
