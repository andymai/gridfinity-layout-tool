import { useState } from 'react';
import { Button, Dialog, Field, Input, Spinner, Switch, Textarea } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useSessionStore } from '@/core/sync/session/useSession';
import { signInUrl, type AuthProvider } from '@/core/sync/session/sessionApi';
import { trackEvent } from '@/shared/analytics/posthog';
import { KOFI_URL } from '@/shared/constants/links';
import { saveAuthReturnPath } from '@/shared/utils/communityReturnPath';
import { MAX_DISPLAY_NAME_LENGTH, MAX_MESSAGE_LENGTH } from '../../constants';
import type { SupporterProfilePatch, SupporterStatus } from '../../api/supporterClient';

export interface SupporterPanelProps {
  open: boolean;
  onClose: () => void;
  status: SupporterStatus;
  /** False until the status read settles; the body waits rather than guessing a branch. */
  settled: boolean;
  save: (patch: SupporterProfilePatch) => Promise<{ kind: string; message?: string } | null>;
  /** Fly the camera to the caller's own bin. Absent when their bin isn't on this wall. */
  onFindMyBin?: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function SupportBenefits() {
  const t = useTranslation();
  const items = [
    { title: t('supporters.panel.benefitWallTitle'), body: t('supporters.panel.benefitWallBody') },
    {
      title: t('supporters.panel.benefitBadgeTitle'),
      body: t('supporters.panel.benefitBadgeBody'),
    },
    {
      title: t('supporters.panel.benefitControlTitle'),
      body: t('supporters.panel.benefitControlBody'),
    },
  ];
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.title} className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-content">{item.title}</span>
          <span className="text-xs text-content-secondary">{item.body}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The reciprocity half of /supporters: what supporting gets you, and — once
 * you're recognized — the controls for your own bin.
 *
 * A panel over the canvas rather than a section below it, because the page is a
 * fixed full-screen WebGL scene with absolutely-positioned overlays; there is
 * no scroll region to put this in without restructuring the wall. Renders as a
 * bottom sheet on mobile.
 *
 * Three states, chosen by what the server actually knows rather than by what
 * the visitor did: a stranger sees the ask, a signed-in non-supporter also sees
 * why they might not have been matched, and a linked supporter sees their own
 * controls.
 */
export function SupporterPanel({
  open,
  onClose,
  status,
  settled,
  save,
  onFindMyBin,
}: SupporterPanelProps) {
  const t = useTranslation();
  const sessionStatus = useSessionStore((state) => state.status);
  const [name, setName] = useState(status.name ?? '');
  const [message, setMessage] = useState(status.message ?? '');
  const [badgePublic, setBadgePublic] = useState(status.badgePublic);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');

  // Adopt the server's record whenever it changes — the first settle, and every
  // successful save (which returns the FILTERED values, not what was typed, so
  // the fields must show what was actually stored).
  //
  // Adjusted during render against the previous object rather than in an
  // effect: an effect would render the stale values once and then re-render,
  // which is the cascading-render pattern the lint rule is there to stop.
  // `status` is a new object only when the hook actually re-reads it, so the
  // reference comparison is exact.
  const [syncedFrom, setSyncedFrom] = useState(status);
  if (syncedFrom !== status) {
    setSyncedFrom(status);
    setName(status.name ?? '');
    setMessage(status.message ?? '');
    setBadgePublic(status.badgePublic);
  }

  if (!open) return null;

  const handleSignIn = (provider: AuthProvider) => {
    // The OAuth callback lands on `/`; without this a supporter signing in to
    // reach their own bin comes back to the layout planner instead.
    saveAuthReturnPath('/supporters');
    window.location.href = signInUrl(provider);
  };

  const handleKofi = () => {
    trackEvent('kofi_clicked', { source: 'supporters_panel' });
    window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
  };

  const handleSave = async () => {
    setSaveState('saving');
    setSaveError('');
    const error = await save({
      name: name.trim() || null,
      message: message.trim() || null,
      badgePublic,
    });
    if (error) {
      setSaveState('error');
      setSaveError(error.message || t('supporters.panel.saveError'));
      return;
    }
    trackEvent('supporter_profile_updated', { anonymous: name.trim() === '' });
    setSaveState('saved');
  };

  const isSupporter = status.supporter;

  return (
    <Dialog.Root open onClose={onClose} size="sm" mobilePresentation="sheet">
      <Dialog.Header
        title={isSupporter ? t('supporters.panel.yoursTitle') : t('supporters.panel.title')}
        closeAriaLabel={t('common.closeDialog')}
      />
      <Dialog.Body>
        {/* Neither branch until the status read lands. Picking one early means a
            supporter who opens this on a slow connection reads "here is what
            supporters get" — an ask aimed at someone who already paid — and
            watches it swap under them a moment later. */}
        {!settled ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : isSupporter ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-content-secondary">{t('supporters.panel.yoursBody')}</p>

            {onFindMyBin && (
              <Button variant="secondary" onClick={onFindMyBin} className="self-start">
                {t('supporters.panel.findMine')}
              </Button>
            )}

            <Field label={t('supporters.panel.nameLabel')} hint={t('supporters.panel.nameHint')}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('supporters.panel.namePlaceholder')}
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                fullWidth
              />
            </Field>

            <Field
              label={t('supporters.panel.messageLabel')}
              hint={name.trim() ? undefined : t('supporters.panel.messageNeedsName')}
            >
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('supporters.panel.messagePlaceholder')}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={2}
                // An anonymous bin never carries a message — the server drops
                // it on write, so offering the field would be a lie.
                disabled={name.trim() === ''}
                className="w-full"
              />
            </Field>

            <Field
              label={t('supporters.panel.badgeToggle')}
              hint={t('supporters.panel.badgeToggleHint')}
            >
              <Switch
                checked={badgePublic}
                onChange={setBadgePublic}
                aria-label={t('supporters.panel.badgeToggle')}
              />
            </Field>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={() => void handleSave()}
                disabled={saveState === 'saving'}
              >
                {saveState === 'saving' ? t('header.saving') : t('common.save')}
              </Button>
              {saveState === 'saved' && (
                <span className="text-xs text-success" role="status">
                  {t('header.saved')}
                </span>
              )}
            </div>
            {saveState === 'error' && (
              <p className="text-xs text-error" role="alert">
                {saveError}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <SupportBenefits />
            <p className="text-xs text-content-tertiary">{t('supporters.panel.noTiers')}</p>

            <Button
              variant="primary"
              fullWidth
              onClick={handleKofi}
              leftIcon={
                <img
                  src="/kofi-cup.png"
                  alt=""
                  aria-hidden="true"
                  className="kofi-cup-wiggle h-4 w-auto"
                />
              }
              style={{ color: '#fff', textShadow: '0 1px 1px rgba(34,34,34,0.15)' }}
            >
              {t('supporters.cta.button')}
            </Button>

            <div className="border-t border-stroke-subtle pt-4">
              <p className="text-xs font-medium text-content-secondary">
                {t('supporters.panel.alreadySupported')}
              </p>
              {sessionStatus === 'authenticated' ? (
                <p className="mt-1 text-xs text-content-tertiary">
                  {t('supporters.panel.unmatched')}
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-content-tertiary">
                    {t('supporters.panel.signInPrompt')}
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-11 md:min-h-0"
                      onClick={() => handleSignIn('google')}
                    >
                      {t('auth.signInWithGoogle')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-h-11 md:min-h-0"
                      onClick={() => handleSignIn('github')}
                    >
                      {t('auth.signInWithGithub')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Dialog.Body>
    </Dialog.Root>
  );
}
