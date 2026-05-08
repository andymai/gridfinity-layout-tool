import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Menu } from '@/design-system';
import { useTranslation } from '@/i18n';
import { layoutAdapter } from '@/core/sync/adapters/layoutAdapter';
import { designAdapter } from '@/features/bin-designer/sync/designAdapter';
import { runSignOut, type KeepLocalPromptResult } from '@/core/sync/signOut';
import { signInUrl } from '@/core/sync/session/sessionApi';
import { useSessionStore } from '@/core/sync/session/useSession';
import { SignOutDialog } from '@/core/sync/dialogs/SignOutDialog';

export function SignInButton() {
  const t = useTranslation();
  const { status, user, setAnonymous } = useSessionStore(
    useShallow((s) => ({
      status: s.status,
      user: s.user,
      setAnonymous: s.setAnonymous,
    }))
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [signOutPrompt, setSignOutPrompt] = useState<{
    localCount: number;
    resolve: (choice: KeepLocalPromptResult) => void;
  } | null>(null);

  const adapters = useMemo(() => ({ layouts: layoutAdapter, designs: designAdapter }), []);

  const promptKeepLocal = useCallback(
    (input: { localCount: number }) =>
      new Promise<KeepLocalPromptResult>((resolve) => {
        setSignOutPrompt({ localCount: input.localCount, resolve });
      }),
    []
  );

  const handleSignOut = useCallback(async () => {
    setMenuOpen(false);
    await runSignOut({
      adapters,
      promptKeepLocal,
      onAnonymous: setAnonymous,
    });
  }, [adapters, promptKeepLocal, setAnonymous]);

  if (status === 'unknown') return null;

  if (status === 'anonymous') {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => openMenu(triggerRef.current, setMenuPos, setMenuOpen)}
          className="px-3 py-1.5 text-sm rounded-md transition-all text-content-secondary hover:bg-surface-hover hover:text-content"
          aria-label={t('auth.signIn')}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {t('auth.signIn')}
        </button>
        <Menu.Root open={menuOpen} onClose={() => setMenuOpen(false)} position={menuPos}>
          <Menu.Item onClick={() => goTo(signInUrl('google'))}>
            {t('auth.signInWithGoogle')}
          </Menu.Item>
          <Menu.Item onClick={() => goTo(signInUrl('github'))}>
            {t('auth.signInWithGithub')}
          </Menu.Item>
        </Menu.Root>
      </>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => openMenu(triggerRef.current, setMenuPos, setMenuOpen)}
        className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-all text-content-secondary hover:bg-surface-hover hover:text-content"
        aria-label={t('auth.userMenuOpen')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={user?.email}
      >
        <Avatar email={user?.email ?? ''} displayName={user?.displayName} />
      </button>
      <Menu.Root open={menuOpen} onClose={() => setMenuOpen(false)} position={menuPos}>
        <UserHeaderItem user={user} t={t} />
        <Menu.Divider />
        <Menu.Item
          onClick={() => {
            void handleSignOut();
          }}
        >
          {t('auth.signOut')}
        </Menu.Item>
      </Menu.Root>
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
    </>
  );
}

interface UserMenuHeaderProps {
  user: ReturnType<typeof useSessionStore.getState>['user'];
  t: ReturnType<typeof useTranslation>;
}

function UserHeaderItem({ user, t }: UserMenuHeaderProps) {
  if (!user) return null;
  const providerLabel =
    user.provider === 'google' ? t('auth.providerGoogle') : t('auth.providerGithub');
  return (
    <div className="px-4 py-2 text-xs leading-tight" role="presentation">
      <div className="text-content font-medium truncate" title={user.email}>
        {user.displayName ?? user.email}
      </div>
      <div className="text-content-tertiary truncate">
        {user.email}
        <span className="mx-1">·</span>
        {providerLabel}
      </div>
    </div>
  );
}

function Avatar({ email, displayName }: { email: string; displayName?: string }) {
  const initial = (displayName ?? email).trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-muted text-content text-[11px] font-medium"
    >
      {initial}
    </span>
  );
}

function goTo(url: string): void {
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
}

function openMenu(
  trigger: HTMLButtonElement | null,
  setPos: (p: { x: number; y: number }) => void,
  setOpen: (b: boolean) => void
): void {
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  setPos({ x: rect.right - 200, y: rect.bottom + 4 });
  setOpen(true);
}
