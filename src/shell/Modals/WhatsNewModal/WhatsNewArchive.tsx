import { useMemo, useState } from 'react';
import { Button, SegmentedControl } from '@/design-system';
import { cn } from '@/design-system/cn';
import { useCurrentLocale, useTranslation } from '@/i18n';
import { WHATS_NEW_ENTRIES } from '@/features/whats-new/entries';
import { countByKind, groupByMonth, resolveText } from '@/features/whats-new/digest';
import type { WhatsNewEntry, WhatsNewKind } from '@/features/whats-new';
import { formatDay, formatMonth, useDestinationLabel, type Activate } from './whatsNewShared';
import { ArrowRightIcon, ChevronIcon, LabsBadge } from './WhatsNewIcons';

export type KindFilter = 'all' | WhatsNewKind;

const FILTERS: readonly KindFilter[] = ['all', 'new', 'improved', 'fixed'];

export function KindFilterControl({
  value,
  onChange,
}: {
  value: KindFilter;
  onChange: (value: KindFilter) => void;
}) {
  const t = useTranslation();

  const options = useMemo(
    () =>
      FILTERS.map((kind) => ({
        value: kind,
        label: (
          <span className="flex items-center gap-1.5">
            {kind === 'all' ? t('common.all') : t(`whatsNew.kind.${kind}`)}
            <span className="tabular-nums text-content-disabled">
              {kind === 'all' ? WHATS_NEW_ENTRIES.length : countByKind(WHATS_NEW_ENTRIES, kind)}
            </span>
          </span>
        ),
      })),
    [t]
  );

  return (
    <SegmentedControl
      options={options}
      value={value}
      onChange={onChange}
      size="sm"
      aria-label={t('whatsNew.filterLabel')}
    />
  );
}

export function ArchiveList({ filter, activate }: { filter: KindFilter; activate: Activate }) {
  const locale = useCurrentLocale();
  const groups = useMemo(() => {
    const matching =
      filter === 'all'
        ? WHATS_NEW_ENTRIES
        : WHATS_NEW_ENTRIES.filter((entry) => (entry.kind ?? 'new') === filter);
    return groupByMonth(matching);
  }, [filter]);

  return (
    <div className="flex flex-col py-2">
      {groups.map((group) => (
        <section key={group.month} className="flex flex-col">
          <h3 className="sticky top-0 z-10 -mx-1 bg-surface-secondary px-1 pb-1.5 pt-3 text-label font-semibold uppercase tracking-wider text-content-tertiary">
            {formatMonth(group.month, locale)}
          </h3>
          <div className="flex flex-col divide-y divide-stroke-subtle">
            {group.entries.map((entry) => (
              <ArchiveRow key={entry.id} entry={entry} activate={activate} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ArchiveRow({ entry, activate }: { entry: WhatsNewEntry; activate: Activate }) {
  const locale = useCurrentLocale();
  const label = useDestinationLabel(entry);
  const [expanded, setExpanded] = useState(false);

  return (
    <article>
      <Button
        variant="ghost"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
        className="-mx-2 h-auto w-full justify-start gap-2 rounded-none px-2 py-2 text-left font-normal"
      >
        <ChevronIcon
          className={cn(
            'h-3 w-3 flex-shrink-0 text-content-disabled transition-transform',
            expanded && 'rotate-90'
          )}
        />
        <span className="min-w-0 flex-1 text-sm leading-snug text-content">
          {resolveText(entry.title, locale)}
        </span>
        <LabsBadge entry={entry} />
        <time
          dateTime={entry.date}
          className="flex-shrink-0 text-label tabular-nums text-content-disabled"
        >
          {formatDay(entry.date, locale)}
        </time>
      </Button>
      {expanded && (
        <div className="flex flex-col items-start gap-1 pb-3 pl-7 pr-2">
          {entry.body && (
            <p className="text-sm leading-relaxed text-content-secondary">
              {resolveText(entry.body, locale)}
            </p>
          )}
          {label !== null && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => activate(entry)}
              className="-ml-1.5 gap-1 px-1.5 text-accent"
            >
              {label}
              <ArrowRightIcon />
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
