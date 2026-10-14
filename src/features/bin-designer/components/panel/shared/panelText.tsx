import type { ReactNode } from 'react';
import { RulerIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { InfoDot } from '@/shared/components/InfoDot';

/**
 * Small tertiary hint paragraph: one sentence. A message that needs more keeps
 * the rest behind the info dot at its end, so the state it reports stays
 * visible without the explanation costing panel height.
 */
export function Hint({ children, info }: { children: string; info?: ReactNode }) {
  const t = useTranslation();
  return (
    <p className="text-label leading-relaxed text-content-tertiary">
      {children}
      {info !== undefined && (
        <span className="ml-1 inline-flex align-middle">
          <InfoDot aria-label={t('binDesigner.infoButton')}>
            {typeof info === 'string' ? <p>{info}</p> : info}
          </InfoDot>
        </span>
      )}
    </p>
  );
}

/** An info dot named for the control it explains, for a label's slot. */
export function LabelInfo({ label, children }: { label: string; children: ReactNode }) {
  const t = useTranslation();
  return (
    <InfoDot aria-label={t('common.aboutLabel', { label })}>
      {typeof children === 'string' ? <p>{children}</p> : children}
    </InfoDot>
  );
}

/**
 * A control's caption, with its evergreen explanation behind an info dot. A
 * choice passes {@link OptionNotes} so the dot explains every option, not just
 * the one picked.
 */
export function FieldLabel({ children, info }: { children: string; info?: ReactNode }) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <span className="text-label text-content-secondary">{children}</span>
      {info !== undefined && <LabelInfo label={children}>{info}</LabelInfo>}
    </div>
  );
}

/** Each option of a choice with a line on what it does, for an info dot. */
export function OptionNotes({
  options,
}: {
  options: readonly { readonly label: string; readonly note: string }[];
}) {
  return (
    <dl className="space-y-1.5">
      {options.map((option) => (
        <div key={option.label}>
          <dt className="font-medium text-content-primary">{option.label}</dt>
          <dd>{option.note}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Uppercase label separating the families of controls inside one section.
 *
 * The third level of the panel's hierarchy, under the group's sticky header and
 * the section it heads, deliberately quieter than either, so a section reads as
 * grouped rather than as several sections.
 */
export function SubHeader({ children, info }: { children: string; info?: ReactNode }) {
  const label = (
    <span className="block text-label font-semibold uppercase tracking-wider text-content-tertiary">
      {children}
    </span>
  );
  if (info === undefined) return label;
  return (
    <div className="flex items-center gap-1.5">
      {label}
      <LabelInfo label={children}>{info}</LabelInfo>
    </div>
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
