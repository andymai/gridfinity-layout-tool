import { useMemo } from 'react';
import { Button, Icon } from '@/design-system';
import { cn } from '@/design-system/cn';
import { useCurrentLocale, useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { groupByKind, resolveText } from '@/features/whats-new/digest';
import type { Digest } from '@/features/whats-new/digest';
import type { WhatsNewEntry } from '@/features/whats-new';
import { KIND_COLOR, useDestinationLabel, type Activate } from './whatsNewShared';
import { ArrowRightIcon, ChevronIcon, LabsBadge } from './WhatsNewIcons';

export function DigestSubtitle({ digest }: { digest: Digest }) {
  const t = useTranslation();

  // Only a genuine unseen list may be described as "since you were last here".
  // The recent-entries fallback is shown for context, not as a count of misses.
  const summary =
    digest.kind === 'recent'
      ? t('whatsNew.subtitleRecent')
      : digest.total === 1
        ? t('whatsNew.subtitleUnseenOne')
        : t('whatsNew.subtitleUnseenMany', { count: String(digest.total) });

  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-content-tertiary">
      <span className="font-medium tabular-nums text-content-secondary">
        {t('sidebar.version', { version: __APP_VERSION__ })}
      </span>
      <span aria-hidden="true" className="text-content-disabled">
        &middot;
      </span>
      {summary}
    </p>
  );
}

interface DigestListProps {
  headline: WhatsNewEntry | null;
  rest: WhatsNewEntry[];
  /** Unseen entries held back past the digest cap, 0 when there are none. */
  overflow: number;
  activate: Activate;
  onSeeAll: () => void;
}

export function DigestList({ headline, rest, overflow, activate, onSeeAll }: DigestListProps) {
  const t = useTranslation();
  const groups = useMemo(() => groupByKind(rest), [rest]);
  // Only a promoted `new` entry makes the remaining new ones "also" new. A
  // featured fix leads a digest whose new section is simply new.
  const headlineKind = headline === null ? null : (headline.kind ?? 'new');

  if (headline === null && rest.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Icon size="lg" className="text-content-disabled">
          {ICON_PATHS.check.map((d) => (
            <path key={d} d={d} />
          ))}
        </Icon>
        <p className="text-sm text-content-tertiary">{t('whatsNew.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      {headline !== null && <HeadlineCard entry={headline} activate={activate} />}
      {groups.map((group) => (
        <section key={group.kind} className="flex flex-col gap-1.5">
          <h3
            className={cn(
              'text-label font-semibold uppercase tracking-wider',
              KIND_COLOR[group.kind]
            )}
          >
            {group.kind === 'new' && headlineKind === 'new'
              ? t('whatsNew.sectionAlsoNew')
              : t(`whatsNew.kind.${group.kind}`)}
          </h3>
          <div className="flex flex-col divide-y divide-stroke-subtle border-t border-stroke-subtle">
            {group.entries.map((entry) => (
              <DigestRow key={entry.id} entry={entry} activate={activate} />
            ))}
          </div>
        </section>
      ))}
      {overflow > 0 && (
        <Button
          variant="ghost"
          onClick={onSeeAll}
          className="h-auto w-full justify-between gap-2 rounded-md border border-dashed border-stroke-subtle px-3 py-2.5 text-sm font-normal text-content-secondary"
        >
          {overflow === 1
            ? t('whatsNew.overflowOne')
            : t('whatsNew.overflowMany', { count: String(overflow) })}
          <ChevronIcon className="h-3.5 w-3.5 flex-shrink-0 text-content-disabled" />
        </Button>
      )}
    </div>
  );
}

function HeadlineCard({ entry, activate }: { entry: WhatsNewEntry; activate: Activate }) {
  const locale = useCurrentLocale();
  const label = useDestinationLabel(entry);

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-accent/25 bg-accent-muted/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold leading-snug text-content">
          {resolveText(entry.title, locale)}
        </h3>
        <LabsBadge entry={entry} />
      </div>
      {entry.body && (
        <p className="text-sm leading-relaxed text-content-secondary">
          {resolveText(entry.body, locale)}
        </p>
      )}
      {label !== null && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => activate(entry)}
          className="mt-1 gap-1.5 self-start"
        >
          {label}
          <ArrowRightIcon />
        </Button>
      )}
    </article>
  );
}

function DigestRow({ entry, activate }: { entry: WhatsNewEntry; activate: Activate }) {
  const locale = useCurrentLocale();
  const label = useDestinationLabel(entry);

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h4 className="text-sm font-medium leading-snug text-content">
            {resolveText(entry.title, locale)}
          </h4>
          <LabsBadge entry={entry} />
        </div>
        {entry.body && (
          <p className="mt-0.5 line-clamp-2 text-body leading-normal text-content-secondary">
            {resolveText(entry.body, locale)}
          </p>
        )}
      </div>
      {label !== null && (
        <>
          <ChevronIcon className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-content-disabled" />
          {/* Names the destination for a screen reader; the chevron alone says
              only that the row leads somewhere. */}
          <span className="sr-only">{label}</span>
        </>
      )}
    </>
  );

  if (label === null) {
    return <div className="flex gap-3 py-3">{content}</div>;
  }

  return (
    <Button
      variant="ghost"
      onClick={() => activate(entry)}
      className="-mx-2 h-auto w-full items-start justify-start gap-3 rounded-none px-2 py-3 text-left font-normal"
    >
      {content}
    </Button>
  );
}
