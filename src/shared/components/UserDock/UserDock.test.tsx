// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { UserDock } from './UserDock';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useSyncStatusStore } from '@/core/sync/status';
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

describe('UserDock', () => {
  beforeEach(() => {
    resetAllStores();
    setSession('unknown');
    useSyncStatusStore.setState({ state: 'idle', pendingCount: 0 });
    vi.mocked(runSignOut).mockClear();
  });
  afterEach(() => cleanup());

  it('renders nothing while session status is "unknown"', () => {
    const { container } = render(<UserDock />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the sign-in trigger when anonymous', () => {
    setSession('anonymous');
    render(<UserDock />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });

  it('reveals provider links when the anonymous trigger is clicked', () => {
    setSession('anonymous');
    render(<UserDock />);
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('link', { name: /google/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /github/i })).toBeTruthy();
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
    // jsdom normalizes #6E5494 to rgb form
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
    // jsdom normalizes #4285F4 to rgb form
    expect(hairline.style.background).toContain('rgb(66, 133, 244)');
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
});
