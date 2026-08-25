import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Dialog } from '@/design-system';
import { useSettingsStore } from '@/core/store/settings';
import { useViewStore } from '@/core/store/view';
import { useTranslation } from '@/i18n';
import { GITHUB_RELEASES_URL } from '@/shared/constants/links';
import { markAllSeen } from '@/features/whats-new';
import { getSeenState } from '@/features/whats-new/seenState';
import { WHATS_NEW_ENTRIES } from '@/features/whats-new/entries';
import { buildDigest, splitLead } from '@/features/whats-new/digest';
import { DigestList, DigestSubtitle } from './WhatsNewDigest';
import { ArchiveList, KindFilterControl, type KindFilter } from './WhatsNewArchive';
import { useEntryActivation } from './whatsNewShared';
import { ChevronIcon } from './WhatsNewIcons';

type View = 'digest' | 'archive';

export function WhatsNewModal() {
  const t = useTranslation();
  const open = useViewStore((state) => state.whatsNewOpen);
  const setOpen = useViewStore((state) => state.setWhatsNewOpen);
  const close = useCallback(() => setOpen(false), [setOpen]);

  return (
    <Dialog.Root
      open={open}
      onClose={close}
      size="2xl"
      mobilePresentation="sheet"
      aria-label={t('whatsNew.title')}
    >
      <WhatsNewContent close={close} />
    </Dialog.Root>
  );
}

/**
 * Dialog.Root renders nothing while closed, so this mounts once per opening.
 * That is what resets the view and rebuilds the digest: reopening should land
 * on the digest and re-read the seen marker, not resume wherever you left off.
 */
function WhatsNewContent({ close }: { close: () => void }) {
  const t = useTranslation();
  const [view, setView] = useState<View>('digest');
  const [filter, setFilter] = useState<KindFilter>('all');

  // Captured before markAllSeen() below empties the unseen list: the digest
  // must not blank out underneath the reader.
  const [digest] = useState(() => buildDigest(WHATS_NEW_ENTRIES, getSeenState().lastSeenId));

  useEffect(() => {
    markAllSeen();
  }, []);

  const activate = useEntryActivation(close);
  const lead = useMemo(() => splitLead(digest.entries), [digest]);
  const overflow = digest.kind === 'unseen' ? digest.total - digest.entries.length : 0;
  const showArchive = useCallback(() => setView('archive'), []);

  return (
    <>
      <Dialog.Header
        title={t('whatsNew.title')}
        closeAriaLabel={t('common.close')}
        leading={
          view === 'archive' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setView('digest')}
              className="-ml-1.5 gap-1 px-1.5"
            >
              <ChevronIcon className="h-3.5 w-3.5 rotate-180" />
              {t('whatsNew.back')}
            </Button>
          ) : undefined
        }
      />
      <Dialog.SubHeader className={view === 'archive' ? 'py-2' : undefined}>
        {view === 'archive' ? (
          <KindFilterControl value={filter} onChange={setFilter} />
        ) : (
          <DigestSubtitle digest={digest} />
        )}
      </Dialog.SubHeader>
      <Dialog.Body>
        {view === 'archive' ? (
          <ArchiveList filter={filter} activate={activate} />
        ) : (
          <DigestList
            headline={lead.headline}
            rest={lead.rest}
            overflow={overflow}
            activate={activate}
            onSeeAll={showArchive}
          />
        )}
      </Dialog.Body>
      <Dialog.Footer bordered className="flex-col items-stretch gap-2.5">
        <div className="flex items-center justify-between gap-3">
          {view === 'archive' ? (
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-content-tertiary hover:text-content-secondary hover:underline"
            >
              {t('whatsNew.fullChangelog')}
            </a>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={showArchive}
              className="-ml-1.5 gap-1.5 px-1.5 text-content-secondary"
            >
              {t('whatsNew.seeAll')}
              <span className="tabular-nums text-content-disabled">{WHATS_NEW_ENTRIES.length}</span>
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={close}>
            {t('whatsNew.dismiss')}
          </Button>
        </div>
        <OptOutCheckbox />
      </Dialog.Footer>
    </>
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
      className="text-content-tertiary"
    />
  );
}
