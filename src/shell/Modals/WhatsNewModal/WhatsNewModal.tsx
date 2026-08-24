import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Checkbox, Dialog, Icon } from '@/design-system';
import { cn } from '@/design-system/cn';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';
import { useSettingsStore } from '@/core/store/settings';
import { useViewStore } from '@/core/store/view';
import { useCurrentLocale, useTranslation } from '@/i18n';
import { GITHUB_RELEASES_URL } from '@/shared/constants/links';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useLabsStore } from '@/core/store/labs';
import { markAllSeen } from '@/features/whats-new';
import { getSeenState } from '@/features/whats-new/seenState';
import { WHATS_NEW_ENTRIES } from '@/features/whats-new/entries';
import {
  DIGEST_LIMIT,
  getUnseenEntries,
  groupByMonth,
  resolveText,
} from '@/features/whats-new/digest';
import type { WhatsNewAction, WhatsNewEntry, WhatsNewKind } from '@/features/whats-new';
import { useBaseplateRouting } from '@/shared/hooks/useBaseplateRouting';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import type { Locale } from '@/i18n/types';

const CIRCLE = 'M12 3a9 9 0 100 18 9 9 0 000-18z';

/**
 * Circled glyphs so the three kinds carry equal visual weight in a list.
 * Not from ICON_PATHS: its `plusCircle` is a bare plus with no circle, which
 * reads noticeably lighter than the others at this size.
 */
const KIND_ICON: Record<WhatsNewKind, readonly string[]> = {
  new: [CIRCLE, 'M12 8.5v7M8.5 12h7'],
  improved: [CIRCLE, 'M12 16V8.5M12 8.5L9 11.5M12 8.5l3 3'],
  fixed: [CIRCLE, 'M8.5 12.2l2.4 2.4 4.6-5'],
};

const KIND_TONE: Record<WhatsNewKind, 'accent' | 'info' | 'success'> = {
  new: 'accent',
  improved: 'info',
  fixed: 'success',
};

// text-info-strong, not text-info: on a plain surface the latter measures
// 4.42:1 (see design-system/variants.ts), which fails on a small glyph.
const KIND_COLOR: Record<WhatsNewKind, string> = {
  new: 'text-accent',
  improved: 'text-info-strong',
  fixed: 'text-success',
};

export function WhatsNewModal() {
  const t = useTranslation();
  const locale = useCurrentLocale();
  const open = useViewStore((state) => state.whatsNewOpen);
  const setOpen = useViewStore((state) => state.setWhatsNewOpen);
  const [showAll, setShowAll] = useState(false);

  // Captured once at mount, before markAllSeen() below empties the unseen list:
  // the digest must not blank out underneath the reader.
  const [digest] = useState<WhatsNewEntry[]>(() => {
    const unseen = getUnseenEntries(WHATS_NEW_ENTRIES, getSeenState().lastSeenId);
    return unseen.length > 0 ? unseen : WHATS_NEW_ENTRIES.slice(0, DIGEST_LIMIT);
  });

  useEffect(() => {
    if (open) markAllSeen();
  }, [open]);

  const shown = showAll ? WHATS_NEW_ENTRIES : digest;
  const groups = useMemo(() => (showAll ? groupByMonth(shown) : null), [showAll, shown]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  const subtitle = showAll
    ? t('whatsNew.subtitleAll')
    : digest.length === 1
      ? t('whatsNew.subtitleUnseenOne')
      : t('whatsNew.subtitleUnseenMany', { count: String(digest.length) });

  return (
    <Dialog.Root
      open={open}
      onClose={close}
      size="2xl"
      mobilePresentation="sheet"
      aria-label={t('whatsNew.title')}
    >
      <Dialog.Header
        title={t('whatsNew.title')}
        closeAriaLabel={t('common.close')}
        leading={
          showAll ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAll(false)}
              className="-ml-1.5 gap-1 px-1.5"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              {t('whatsNew.back')}
            </Button>
          ) : undefined
        }
      />
      <Dialog.SubHeader>
        <p className="text-sm text-content-tertiary">{subtitle}</p>
      </Dialog.SubHeader>
      <Dialog.Body>
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Icon size="lg" className="text-content-disabled">
              {ICON_PATHS.check.map((d) => (
                <path key={d} d={d} />
              ))}
            </Icon>
            <p className="text-sm text-content-tertiary">{t('whatsNew.empty')}</p>
          </div>
        ) : groups ? (
          <div className="flex flex-col py-2">
            {groups.map((group) => (
              <section key={group.month} className="flex flex-col">
                <h3 className="sticky top-0 z-10 -mx-1 bg-surface-secondary px-1 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
                  {formatMonth(group.month, locale)}
                </h3>
                <div className="flex flex-col divide-y divide-stroke-subtle">
                  {group.entries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} onNavigate={close} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-stroke-subtle py-1">
            {shown.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onNavigate={close} />
            ))}
          </div>
        )}
      </Dialog.Body>
      <Dialog.Footer justify="between" bordered>
        <OptOutCheckbox />
        <div className="flex items-center gap-2">
          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-1.5 text-xs text-content-disabled hover:text-content-secondary hover:underline"
          >
            {t('whatsNew.fullChangelog')}
          </a>
          {!showAll && (
            <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>
              {t('whatsNew.seeAll')}
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={close}>
            {t('whatsNew.dismiss')}
          </Button>
        </div>
      </Dialog.Footer>
    </Dialog.Root>
  );
}

function OptOutCheckbox() {
  const t = useTranslation();
  const showUpdateSummaries = useSettingsStore((state) => state.settings.showUpdateSummaries);
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  return (
    <Checkbox
      checked={!showUpdateSummaries}
      onChange={(checked) => updateSetting('showUpdateSummaries', !checked)}
      label={t('whatsNew.dontShowAgain')}
      size="sm"
    />
  );
}

interface EntryRowProps {
  entry: WhatsNewEntry;
  onNavigate: () => void;
}

function EntryRow({ entry, onNavigate }: EntryRowProps) {
  const t = useTranslation();
  const locale = useCurrentLocale();
  const kind = entry.kind ?? 'new';
  const paths = entry.icon ? ICON_PATHS[entry.icon] : KIND_ICON[kind];

  return (
    <article className="flex gap-3 py-3.5">
      <span className={cn('mt-0.5 flex-shrink-0', KIND_COLOR[kind])}>
        <Icon size="sm">
          {paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </Icon>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="text-sm font-semibold leading-snug text-content">
            {resolveText(entry.title, locale)}
          </h4>
          <time
            dateTime={entry.date}
            className="flex-shrink-0 text-[11px] tabular-nums text-content-disabled"
          >
            {formatDay(entry.date, locale)}
          </time>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={KIND_TONE[kind]} size="sm">
            {t(`whatsNew.kind.${kind}`)}
          </Badge>
          {entry.labs !== undefined && (
            <Badge tone="warning" size="sm">
              {t('whatsNew.labs')}
            </Badge>
          )}
        </div>
        {entry.body && (
          <p className="mt-1.5 text-sm leading-relaxed text-content-secondary">
            {resolveText(entry.body, locale)}
          </p>
        )}
        <EntryAction entry={entry} onNavigate={onNavigate} />
      </div>
    </article>
  );
}

function EntryAction({ entry, onNavigate }: EntryRowProps) {
  const t = useTranslation();
  const setPrintModalOpen = useViewStore((state) => state.setPrintModalOpen);
  const setShowBaseplateLibrary = useViewStore((state) => state.setShowBaseplateLibrary);
  const openGallery = useBinExampleGalleryStore((state) => state.open);
  const openLabsDrawer = useLabsStore((state) => state.openDrawer);
  const { navigateToDesigner, navigateToPlanner } = useDesignerRouting();
  const { navigateToBaseplate } = useBaseplateRouting();

  const run = useCallback(
    (action: WhatsNewAction) => {
      onNavigate();
      switch (action.kind) {
        case 'openTool':
          switch (action.tool) {
            case 'layout':
              navigateToPlanner();
              return;
            case 'designer':
              navigateToDesigner();
              return;
            case 'baseplate':
              navigateToBaseplate();
              return;
          }
          return;
        case 'openModal':
          switch (action.modal) {
            case 'baseplateLibrary':
              setShowBaseplateLibrary(true);
              return;
            case 'print':
              setPrintModalOpen(true);
              return;
            case 'designGallery':
              openGallery();
              return;
          }
      }
    },
    [
      navigateToBaseplate,
      navigateToDesigner,
      navigateToPlanner,
      onNavigate,
      openGallery,
      setPrintModalOpen,
      setShowBaseplateLibrary,
    ]
  );

  // A Labs entry sends you to the switch that turns it on: the feature it
  // describes is unreachable until the flag is enabled.
  if (entry.labs !== undefined) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="-ml-1.5 mt-2 gap-1 px-1.5 text-accent"
        onClick={() => {
          onNavigate();
          openLabsDrawer();
        }}
      >
        {t('whatsNew.action.openLabs')}
        <ArrowRight />
      </Button>
    );
  }

  const action = entry.action;
  if (!action) return null;

  return (
    <Button
      size="sm"
      variant="ghost"
      className="-ml-1.5 mt-2 gap-1 px-1.5 text-accent"
      onClick={() => run(action)}
    >
      {action.kind === 'openTool'
        ? t(`whatsNew.action.openTool.${action.tool}`)
        : t(`whatsNew.action.openModal.${action.modal}`)}
      <ArrowRight />
    </Button>
  );
}

function formatMonth(month: string, locale: Locale): string {
  const [year, m] = month.split('-');
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(Number(year), Number(m) - 1, 1)
  );
}

function formatDay(iso: string, locale: Locale): string {
  const [year, month, day] = iso.split('-');
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
    new Date(Number(year), Number(month) - 1, Number(day))
  );
}

function ArrowRight() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 5l7 7-7 7M3 12h18"
      />
    </svg>
  );
}
