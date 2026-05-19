import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/design-system/cn';
import { useTranslation } from '@/i18n';
import { useSessionStore } from '@/core/sync/session/useSession';
import { signInUrl } from '@/core/sync/session/sessionApi';
import { useSyncStatusStore, type SyncState } from '@/core/sync/status';
import { useSignOutFlow } from '@/shared/sync/useSignOutFlow';
import { useLibraryStore } from '@/core/store/library';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { SyncRing } from './SyncRing';
import { useDockMenu } from './useDockMenu';
import { PROVIDER_INFO } from './providers';

const LOGOUT_ICON: readonly string[] = [
  'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
];

interface UserDockProps {
  variant?: 'default' | 'compact';
  onOpenSettings?: () => void;
}

export function UserDock({ variant = 'default', onOpenSettings }: UserDockProps) {
  const t = useTranslation();
  const { status, user } = useSessionStore(useShallow((s) => ({ status: s.status, user: s.user })));
  const syncState = useSyncStatusStore((s) => s.state);
  const layoutCount = useLibraryStore((s) => s.library.entries.length);

  const { open, toggle, close, rootRef, triggerProps } = useDockMenu();
  const { signOut, dialog: signOutDialog } = useSignOutFlow();

  const handleSignOut = useCallback(() => {
    close();
    void signOut();
  }, [close, signOut]);

  if (status === 'unknown') return null;

  const isCompact = variant === 'compact';
  const isAuthed = status === 'authenticated' && user !== null;
  const ringState: SyncState | 'none' = isAuthed ? syncState : 'none';
  const initial = isAuthed
    ? (user.displayName ?? user.email).trim().charAt(0).toUpperCase() || '?'
    : '';
  const hairline = isAuthed ? PROVIDER_INFO[user.provider].hairlineColor : null;

  const handleOpenSettings = onOpenSettings
    ? () => {
        close();
        onOpenSettings();
      }
    : undefined;

  return (
    <>
      <div ref={rootRef} className="border-t border-stroke-subtle bg-surface-secondary">
        {hairline && <div aria-hidden="true" className="h-px" style={{ background: hairline }} />}

        {!isCompact && (
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-300 ease-out',
              open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            )}
            inert={!open}
            aria-label={t('dock.menuLabel')}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col px-2 py-2 gap-0.5 border-b border-stroke-subtle">
                {isAuthed ? (
                  <AuthedMenuContent
                    user={user}
                    syncState={syncState}
                    onSignOut={handleSignOut}
                    onOpenSettings={handleOpenSettings}
                    t={t}
                  />
                ) : (
                  <AnonymousMenuContent
                    layoutCount={layoutCount}
                    onOpenSettings={handleOpenSettings}
                    t={t}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {isCompact ? (
          <div
            className="w-full flex justify-center py-2 text-content-secondary"
            title={isAuthed ? user.email : t('dock.signInTooltip')}
            aria-label={isAuthed ? user.email : t('dock.signInTooltip')}
          >
            {isAuthed ? (
              <SyncRing state={ringState} initial={initial} size={24} />
            ) : (
              <LocalAvatar size={24} />
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={toggle}
            {...triggerProps}
            aria-label={t('dock.openMenu')}
            title={isAuthed ? user.email : t('dock.signInTooltip')}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
              'text-content-secondary hover:bg-surface-hover hover:text-content',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'
            )}
          >
            {isAuthed ? (
              <SyncRing state={ringState} initial={initial} size={28} />
            ) : (
              <LocalAvatar size={28} />
            )}
            <span className="flex-1 truncate text-left">
              {isAuthed ? (user.displayName ?? user.email) : t('dock.workingLocally')}
            </span>
            {!isAuthed && <span className="text-xs text-content-tertiary">{t('auth.signIn')}</span>}
            <Caret up={open} />
          </button>
        )}
      </div>

      {signOutDialog}
    </>
  );
}

interface AuthedMenuContentProps {
  user: NonNullable<ReturnType<typeof useSessionStore.getState>['user']>;
  syncState: SyncState;
  onSignOut: () => void;
  onOpenSettings?: () => void;
  t: ReturnType<typeof useTranslation>;
}

function AuthedMenuContent({
  user,
  syncState,
  onSignOut,
  onOpenSettings,
  t,
}: AuthedMenuContentProps) {
  const providerLabel = t(PROVIDER_INFO[user.provider].labelKey);
  return (
    <>
      <div className="px-2 pt-1 pb-2" role="presentation">
        <div className="text-content font-medium truncate" title={user.email}>
          {user.displayName ?? user.email}
        </div>
        <div className="text-content-tertiary text-xs truncate">
          {user.email}
          <span className="mx-1">·</span>
          {providerLabel}
        </div>
      </div>
      <div className="h-px bg-stroke-subtle mx-1 my-1" />
      <SyncStatusRow state={syncState} t={t} />
      {onOpenSettings && (
        <MenuButton onClick={onOpenSettings} icon={ICON_PATHS.settings}>
          {t('dock.settings')}
        </MenuButton>
      )}
      <MenuButton onClick={onSignOut} icon={LOGOUT_ICON}>
        {t('auth.signOut')}
      </MenuButton>
    </>
  );
}

interface AnonymousMenuContentProps {
  layoutCount: number;
  onOpenSettings?: () => void;
  t: ReturnType<typeof useTranslation>;
}

function AnonymousMenuContent({ layoutCount, onOpenSettings, t }: AnonymousMenuContentProps) {
  return (
    <>
      <LocalStatusRow layoutCount={layoutCount} t={t} />
      <div className="h-px bg-stroke-subtle mx-1 my-1" />
      <a
        href={signInUrl('google')}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-content hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
      >
        <ProviderMark provider="google" />
        <span>{t('auth.signInWithGoogle')}</span>
      </a>
      <a
        href={signInUrl('github')}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-content hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
      >
        <ProviderMark provider="github" />
        <span>{t('auth.signInWithGithub')}</span>
      </a>
      {onOpenSettings && (
        <>
          <div className="h-px bg-stroke-subtle mx-1 my-1" />
          <MenuButton onClick={onOpenSettings} icon={ICON_PATHS.settings}>
            {t('dock.settings')}
          </MenuButton>
        </>
      )}
    </>
  );
}

const SYNC_STATUS_KEYS: Record<SyncState, string> = {
  idle: 'dock.syncStatusIdle',
  syncing: 'dock.syncStatusSyncing',
  offline: 'dock.syncStatusOffline',
  error: 'dock.syncStatusError',
};

const SYNC_DOT_CLASS: Record<SyncState, string> = {
  idle: 'bg-success',
  syncing: 'bg-info animate-pulse',
  offline: 'bg-warning',
  error: 'bg-error',
};

function SyncStatusRow({ state, t }: { state: SyncState; t: ReturnType<typeof useTranslation> }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs text-content-secondary" role="status">
      <span
        className={cn('inline-block w-1.5 h-1.5 rounded-full', SYNC_DOT_CLASS[state])}
        aria-hidden="true"
      />
      <span>{t(SYNC_STATUS_KEYS[state])}</span>
    </div>
  );
}

function LocalStatusRow({
  layoutCount,
  t,
}: {
  layoutCount: number;
  t: ReturnType<typeof useTranslation>;
}) {
  const label =
    layoutCount > 0
      ? t('dock.savedOnDeviceCount', { count: layoutCount })
      : t('dock.readyWhenYouAre');
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs text-content-secondary" role="status">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-stroke-subtle" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

interface MenuButtonProps {
  onClick: () => void;
  icon: readonly string[];
  children: React.ReactNode;
}

function MenuButton({ onClick, icon, children }: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-content hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none text-left"
    >
      <svg
        className="w-4 h-4 text-content-tertiary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        {icon.map((d) => (
          <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
        ))}
      </svg>
      <span>{children}</span>
    </button>
  );
}

function Caret({ up }: { up: boolean }) {
  return (
    <svg
      className={cn(
        'w-3.5 h-3.5 text-content-tertiary transition-transform duration-200',
        up ? 'rotate-180' : 'rotate-0'
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function LocalAvatar({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full bg-primary-muted text-content-secondary flex-none"
      style={{ width: size, height: size }}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-9 0h12m-12 0a2 2 0 01-2-2V7a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2"
        />
      </svg>
    </span>
  );
}

function ProviderMark({ provider }: { provider: 'google' | 'github' }) {
  if (provider === 'google') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84a10.13 10.13 0 0 1-4.39 6.65v5.52h7.1c4.16-3.83 6.57-9.47 6.57-16.18z"
        />
        <path
          fill="#34A853"
          d="M24 46c5.94 0 10.92-1.97 14.56-5.32l-7.1-5.52c-1.97 1.32-4.49 2.1-7.46 2.1-5.74 0-10.6-3.87-12.34-9.07H4.34v5.7A22 22 0 0 0 24 46z"
        />
        <path
          fill="#FBBC05"
          d="M11.66 28.18a13.21 13.21 0 0 1 0-8.36v-5.7H4.34a22 22 0 0 0 0 19.76l7.32-5.7z"
        />
        <path
          fill="#EA4335"
          d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1A22 22 0 0 0 4.34 14.12l7.32 5.7C13.4 13.62 18.26 9.75 24 9.75z"
        />
      </svg>
    );
  }
  return (
    <svg
      className="w-4 h-4 text-content"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5a11.5 11.5 0 0 0-3.63 22.41c.58.1.79-.25.79-.56v-1.96c-3.21.7-3.88-1.55-3.88-1.55-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.18.08 1.8 1.21 1.8 1.21 1.04 1.79 2.74 1.27 3.41.97.1-.76.41-1.27.74-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.3 1.2-3.11-.12-.29-.52-1.46.11-3.05 0 0 .98-.31 3.2 1.18a11.05 11.05 0 0 1 5.83 0c2.22-1.49 3.2-1.18 3.2-1.18.63 1.59.23 2.76.11 3.05.75.81 1.2 1.85 1.2 3.11 0 4.43-2.7 5.41-5.27 5.69.42.36.79 1.07.79 2.16v3.21c0 .31.21.66.8.55A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}
