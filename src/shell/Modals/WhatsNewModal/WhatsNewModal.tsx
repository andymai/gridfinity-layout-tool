import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Checkbox, Dialog, Icon } from '@/design-system';
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

const KIND_ICON: Record<WhatsNewKind, readonly string[]> = {
  new: ICON_PATHS.plusCircle,
  improved: ICON_PATHS.bolt,
  fixed: ICON_PATHS.check,
};

const KIND_TONE: Record<WhatsNewKind, 'accent' | 'info' | 'success'> = {
  new: 'accent',
  improved: 'info',
  fixed: 'success',
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
            <Button size="sm" variant="ghost" onClick={() => setShowAll(false)}>
              {t('whatsNew.back')}
            </Button>
          ) : undefined
        }
      />
      <Dialog.Body>
        <p className="mb-4 text-sm text-content-tertiary">{subtitle}</p>
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-content-tertiary">{t('whatsNew.empty')}</p>
        ) : groups ? (
          <div className="flex flex-col gap-6 pb-2">
            {groups.map((group) => (
              <section key={group.month} className="flex flex-col gap-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                  {formatMonth(group.month, locale)}
                </h3>
                {group.entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} onNavigate={close} />
                ))}
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-2">
            {shown.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onNavigate={close} />
            ))}
          </div>
        )}
      </Dialog.Body>
      <Dialog.Footer justify="between" bordered>
        <OptOutCheckbox />
        <div className="flex items-center gap-3">
          {!showAll && (
            <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>
              {t('whatsNew.seeAll')}
            </Button>
          )}
          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-content-tertiary hover:text-content-secondary hover:underline"
          >
            {t('whatsNew.fullChangelog')}
          </a>
          <Button size="sm" onClick={close}>
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
    <article className="flex gap-3">
      <Icon size="sm" className="mt-0.5 flex-shrink-0 text-content-tertiary">
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </Icon>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={KIND_TONE[kind]} size="sm">
            {t(`whatsNew.kind.${kind}`)}
          </Badge>
          {entry.labs !== undefined && (
            <Badge tone="warning" size="sm">
              {t('whatsNew.labs')}
            </Badge>
          )}
          <h4 className="text-sm font-semibold text-content">{resolveText(entry.title, locale)}</h4>
        </div>
        {entry.body && (
          <p className="mt-1 text-sm leading-relaxed text-content-secondary">
            {resolveText(entry.body, locale)}
          </p>
        )}
        <EntryAction entry={entry} onNavigate={onNavigate} />
      </div>
      <time
        dateTime={entry.date}
        className="flex-shrink-0 text-xs tabular-nums text-content-disabled"
      >
        {formatDay(entry.date, locale)}
      </time>
    </article>
  );
}

function EntryAction({ entry, onNavigate }: EntryRowProps) {
  const t = useTranslation();
  const setPrintModalOpen = useViewStore((state) => state.setPrintModalOpen);
  const setShowBaseplateLibrary = useViewStore((state) => state.setShowBaseplateLibrary);
  const openGallery = useBinExampleGalleryStore((state) => state.open);
  const openLabsDrawer = useLabsStore((state) => state.openDrawer);
  const { navigateToDesigner } = useDesignerRouting();
  const { navigateToBaseplate } = useBaseplateRouting();

  const run = useCallback(
    (action: WhatsNewAction) => {
      onNavigate();
      switch (action.kind) {
        case 'openTool':
          switch (action.tool) {
            case 'layout':
              window.location.assign('/');
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
        className="-ml-2 mt-2"
        onClick={() => {
          onNavigate();
          openLabsDrawer();
        }}
      >
        {t('whatsNew.action.openLabs')}
      </Button>
    );
  }

  const action = entry.action;
  if (!action) return null;

  return (
    <Button size="sm" variant="ghost" className="-ml-2 mt-2" onClick={() => run(action)}>
      {action.kind === 'openTool'
        ? t(`whatsNew.action.openTool.${action.tool}`)
        : t(`whatsNew.action.openModal.${action.modal}`)}
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
