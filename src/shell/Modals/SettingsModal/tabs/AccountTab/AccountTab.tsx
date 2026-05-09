import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useSessionStore } from '@/core/sync/session/useSession';
import { signInUrl } from '@/core/sync/session/sessionApi';
import { useSyncStatusStore } from '@/core/sync/status';
import { runSignOut, type KeepLocalPromptResult } from '@/core/sync/signOut';
import { SignOutDialog } from '@/core/sync/dialogs/SignOutDialog';
import { layoutAdapter } from '@/core/sync/adapters/layoutAdapter';
import { designAdapter } from '@/features/bin-designer/sync/designAdapter';

const PROVIDER_LABEL_KEY = {
  google: 'auth.providerGoogle',
  github: 'auth.providerGithub',
} as const;

export function AccountTab() {
  const t = useTranslation();
  const cloudSyncEnabled = useFeatureFlag('cloud_sync');

  const { status, user, setAnonymous } = useSessionStore(
    useShallow((s) => ({ status: s.status, user: s.user, setAnonymous: s.setAnonymous }))
  );
  const sync = useSyncStatusStore(
    useShallow((s) => ({
      state: s.state,
      lastSyncedAt: s.lastSyncedAt,
      pendingCount: s.pendingCount,
      lastError: s.lastError,
    }))
  );

  const adapters = useMemo(() => ({ layouts: layoutAdapter, designs: designAdapter }), []);
  const [signOutPrompt, setSignOutPrompt] = useState<{
    localCount: number;
    resolve: (choice: KeepLocalPromptResult) => void;
  } | null>(null);

  const promptKeepLocal = useCallback(
    (input: { localCount: number }) =>
      new Promise<KeepLocalPromptResult>((resolve) => {
        setSignOutPrompt({ localCount: input.localCount, resolve });
      }),
    []
  );

  const handleSignOut = useCallback(async () => {
    await runSignOut({ adapters, promptKeepLocal, onAnonymous: setAnonymous });
  }, [adapters, promptKeepLocal, setAnonymous]);

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
        ) : (
          <div className="rounded-md border border-stroke-subtle p-4 flex items-center gap-3">
            <Button variant="primary" onClick={() => goTo(signInUrl('google'))}>
              {t('auth.signInWithGoogle')}
            </Button>
            <Button variant="ghost" onClick={() => goTo(signInUrl('github'))}>
              {t('auth.signInWithGithub')}
            </Button>
          </div>
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
                    time: formatRelative(sync.lastSyncedAt),
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
          <Button variant="ghost" onClick={() => void handleSignOut()}>
            {t('account.signOut.button')}
          </Button>
        </section>
      )}

      {signOutPrompt && (
        <SignOutDialog
          isOpen={true}
          localCount={signOutPrompt.localCount}
          onChoice={(choice) => {
            signOutPrompt.resolve(choice);
            setSignOutPrompt(null);
          }}
          onCancel={() => {
            signOutPrompt.resolve('cancel');
            setSignOutPrompt(null);
          }}
        />
      )}
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

function formatRelative(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
