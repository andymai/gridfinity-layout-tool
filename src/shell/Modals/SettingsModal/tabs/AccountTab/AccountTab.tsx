import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useSessionStore } from '@/core/sync/session/useSession';
import { signInUrl } from '@/core/sync/session/sessionApi';
import { useSyncStatusStore } from '@/core/sync/status';
import { useSignOutFlow } from '@/core/sync/useSignOutFlow';

const PROVIDER_LABEL_KEY = {
  google: 'auth.providerGoogle',
  github: 'auth.providerGithub',
} as const;

export function AccountTab() {
  const t = useTranslation();
  const cloudSyncEnabled = useFeatureFlag('cloud_sync');

  const { status, user } = useSessionStore(useShallow((s) => ({ status: s.status, user: s.user })));
  const sync = useSyncStatusStore(
    useShallow((s) => ({
      state: s.state,
      lastSyncedAt: s.lastSyncedAt,
      pendingCount: s.pendingCount,
      lastError: s.lastError,
    }))
  );

  const { signOut, dialog: signOutDialog } = useSignOutFlow();

  if (!cloudSyncEnabled) {
    return (
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-content">{t('account.identity.heading')}</h3>
        <p className="text-sm text-content-secondary">{t('settings.tabs.labs')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-base font-semibold text-content mb-3">
          {t('account.identity.heading')}
        </h3>
        {status === 'authenticated' && user ? (
          <div className="rounded-md border border-stroke-subtle p-4 space-y-1">
            <div className="text-sm text-content font-medium">{user.displayName ?? user.email}</div>
            <div className="text-xs text-content-tertiary">{user.email}</div>
            <div className="text-xs text-content-tertiary">
              {t('account.identity.signedInVia', {
                provider: t(PROVIDER_LABEL_KEY[user.provider]),
              })}
            </div>
          </div>
        ) : status === 'anonymous' ? (
          <div className="rounded-md border border-stroke-subtle p-4 flex items-center gap-3">
            <Button variant="primary" onClick={() => goTo(signInUrl('google'))}>
              {t('auth.signInWithGoogle')}
            </Button>
            <Button variant="ghost" onClick={() => goTo(signInUrl('github'))}>
              {t('auth.signInWithGithub')}
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-stroke-subtle p-4 h-[3.5rem]" aria-busy="true" />
        )}
      </section>

      <section>
        <h3 className="text-base font-semibold text-content mb-3">{t('account.sync.heading')}</h3>
        <div className="rounded-md border border-stroke-subtle p-4 space-y-2 text-sm text-content-secondary">
          <div className="flex items-center justify-between">
            <span>{t(`dock.syncStatus${capitalize(sync.state)}` as const)}</span>
            <span className="text-xs text-content-tertiary">
              {sync.lastSyncedAt
                ? t('account.sync.lastSyncedAt', {
                    time: formatRelative(sync.lastSyncedAt, t),
                  })
                : t('account.sync.lastSyncedNever')}
            </span>
          </div>
          {sync.pendingCount > 0 && (
            <div className="text-xs text-content-tertiary">
              {t('account.sync.pendingChanges', { count: sync.pendingCount })}
            </div>
          )}
          {sync.lastError && (
            <div className="text-xs text-error">
              {t('account.sync.errorPrefix', { message: sync.lastError })}
            </div>
          )}
        </div>
      </section>

      {status === 'authenticated' && (
        <section>
          <Button variant="ghost" onClick={() => void signOut()}>
            {t('account.signOut.button')}
          </Button>
        </section>
      )}

      {signOutDialog}
    </div>
  );
}

function goTo(url: string): void {
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}

function formatRelative(timestamp: number, t: ReturnType<typeof useTranslation>): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 5) return t('account.sync.relativeJustNow');
  if (seconds < 60) return t('account.sync.relativeSeconds', { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('account.sync.relativeMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('account.sync.relativeHours', { count: hours });
  const days = Math.floor(hours / 24);
  return t('account.sync.relativeDays', { count: days });
}
