// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { UserDock } from './UserDock';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useSyncStatusStore } from '@/core/sync/status';
import { useLibraryStore } from '@/core/store/library';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/core/sync/signOut', () => ({
  runSignOut: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/core/sync/adapters/layoutAdapter', () => ({ layoutAdapter: {} }));
vi.mock('@/features/bin-designer/sync/designAdapter', () => ({ designAdapter: {} }));

import { runSignOut } from '@/core/sync/signOut';

const setSession = (
  status: 'unknown' | 'anonymous' | 'authenticated',
  user: {
    userId: string;
    provider: 'google' | 'github';
    email: string;
    displayName?: string;
  } | null = null
) => {
  useSessionStore.setState({ status, user });
};

const setLayoutCount = (count: number) => {
  useLibraryStore.setState((s) => ({
    library: {
      ...s.library,
      entries: Array.from({ length: count }, (_, i) => ({
        id: `entry-${i}` as never,
        name: `Layout ${i}`,
        createdAt: 0,
        modifiedAt: 0,
        preview: {
          drawerWidth: 5 as never,
          drawerDepth: 5 as never,
          drawerHeight: 1 as never,
          binCount: 0,
          layerCount: 1,
        },
      })),
    },
  }));
};

describe('UserDock', () => {
  beforeEach(() => {
    resetAllStores();
    setSession('unknown');
    setLayoutCount(0);
    useSyncStatusStore.setState({ state: 'idle', pendingCount: 0 });
    vi.mocked(runSignOut).mockClear();
  });
  afterEach(() => cleanup());

  it('renders nothing while session status is "unknown"', () => {
    const { container } = render(<UserDock />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the "Working locally" trigger label when anonymous', () => {
    setSession('anonymous');
    render(<UserDock />);
    expect(screen.getByText(/working locally/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /open account menu/i })).toBeTruthy();
  });

  it('reveals provider links when the anonymous trigger is opened', () => {
    setSession('anonymous');
    render(<UserDock />);
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }));
    expect(screen.getByRole('link', { name: /google/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /github/i })).toBeTruthy();
  });

  it('shows "Ready when you are" when the library is empty', () => {
    setSession('anonymous');
    setLayoutCount(0);
    render(<UserDock />);
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }));
    expect(screen.getByText(/ready when you are/i)).toBeTruthy();
  });

  it('shows the layout count when the library has entries', () => {
    setSession('anonymous');
    setLayoutCount(7);
    render(<UserDock />);
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }));
    expect(screen.getByText(/saved on this device · 7 layout/i)).toBeTruthy();
  });

  it('uses the same "Account menu" aria-label for anonymous and authed', () => {
    setSession('anonymous');
    const { container } = render(<UserDock />);
    expect(container.querySelector('[aria-label="Account menu"]')).toBeTruthy();
  });

  it('renders the display name when authenticated', () => {
    setSession('authenticated', {
      userId: 'u1',
      provider: 'github',
      email: 'andy@example.com',
      displayName: 'Andy Aragon',
    });
    render(<UserDock />);
    expect(screen.getAllByText('Andy Aragon')[0]).toBeTruthy();
  });

  it('renders the email when no display name is present', () => {
    setSession('authenticated', {
      userId: 'u1',
      provider: 'google',
      email: 'no-name@example.com',
    });
    render(<UserDock />);
    expect(screen.getAllByText('no-name@example.com')[0]).toBeTruthy();
  });

  it('shows the GitHub provider hairline when signed in via GitHub', () => {
    setSession('authenticated', {
      userId: 'u1',
      provider: 'github',
      email: 'a@x',
      displayName: 'Andy',
    });
    const { container } = render(<UserDock />);
    const hairline = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(hairline.style.background).toContain('rgb(110, 84, 148)');
  });

  it('shows the Google hairline when signed in via Google', () => {
    setSession('authenticated', {
      userId: 'u1',
      provider: 'google',
      email: 'a@x',
      displayName: 'Andy',
    });
    const { container } = render(<UserDock />);
    const hairline = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(hairline.style.background).toContain('rgb(66, 133, 244)');
  });

  it('omits the provider hairline when anonymous', () => {
    setSession('anonymous');
    const { container } = render(<UserDock />);
    const hairlines = container.querySelectorAll('div[style*="background"]');
    hairlines.forEach((el) => {
      const bg = (el as HTMLElement).style.background;
      expect(bg).not.toContain('rgb(110, 84, 148)');
      expect(bg).not.toContain('rgb(66, 133, 244)');
    });
  });

  it('expands to reveal sync status and sign-out when authenticated', () => {
    setSession('authenticated', {
      userId: 'u1',
      provider: 'github',
      email: 'andy@example.com',
      displayName: 'Andy',
    });
    render(<UserDock />);
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }));
    expect(screen.getByText(/all changes synced/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
  });

  it('omits the Settings menu item when no onOpenSettings handler is provided', () => {
    setSession('authenticated', {
      userId: 'u1',
      provider: 'google',
      email: 'a@x',
      displayName: 'A',
    });
    render(<UserDock />);
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }));
    expect(screen.queryByRole('button', { name: /^settings$/i })).toBeNull();
  });

  it('renders the Settings menu item and calls the handler when provided', () => {
    setSession('authenticated', {
      userId: 'u1',
      provider: 'google',
      email: 'a@x',
      displayName: 'A',
    });
    const onOpenSettings = vi.fn();
    render(<UserDock onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('renders Settings in the anonymous menu when onOpenSettings is provided', () => {
    setSession('anonymous');
    const onOpenSettings = vi.fn();
    render(<UserDock onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('triggers runSignOut when the sign-out item is clicked', () => {
    setSession('authenticated', {
      userId: 'u1',
      provider: 'google',
      email: 'a@x',
      displayName: 'A',
    });
    render(<UserDock />);
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(runSignOut).toHaveBeenCalledTimes(1);
  });

  it('marks the collapsed menu region as inert so items are not tab-reachable', () => {
    setSession('authenticated', {
      userId: 'u1',
      provider: 'google',
      email: 'a@x',
      displayName: 'Andy',
    });
    const { container } = render(<UserDock />);
    const region = container.querySelector('[aria-label]');
    expect(region?.hasAttribute('inert')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }));
    expect(region?.hasAttribute('inert')).toBe(false);
  });

  it('renders compact variant as a non-interactive avatar (no button, no name)', () => {
    setSession('authenticated', {
      userId: 'u1',
      provider: 'google',
      email: 'a@x',
      displayName: 'Andy',
    });
    render(<UserDock variant="compact" />);
    expect(screen.queryByText('Andy')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('compact variant exposes the local-mode tooltip when anonymous', () => {
    setSession('anonymous');
    const { container } = render(<UserDock variant="compact" />);
    const labelled = container.querySelector('[aria-label="Working locally · Sign in to sync"]');
    expect(labelled).toBeTruthy();
  });

  it('compact variant announces sync status for screen readers when authed', () => {
    setSession('authenticated', {
      userId: 'u1',
      provider: 'google',
      email: 'andy@example.com',
      displayName: 'Andy',
    });
    useSyncStatusStore.setState({ state: 'syncing', pendingCount: 1 });
    const { container } = render(<UserDock variant="compact" />);
    const labelled = container.querySelector('[role="status"][aria-label*="andy@example.com"]');
    expect(labelled).toBeTruthy();
    expect(labelled?.getAttribute('aria-label')).toContain('Syncing');
  });
});
