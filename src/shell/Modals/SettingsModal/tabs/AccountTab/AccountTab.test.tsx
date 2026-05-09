// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AccountTab } from './AccountTab';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useSyncStatusStore } from '@/core/sync/status';
import { useLabsStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/core/sync/signOut', () => ({
  runSignOut: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/core/sync/deleteAccount', () => ({
  runDeleteAccount: vi.fn().mockResolvedValue({ status: 'deleted' }),
}));
vi.mock('@/core/sync/adapters/layoutAdapter', () => ({ layoutAdapter: {} }));
vi.mock('@/features/bin-designer/sync/designAdapter', () => ({ designAdapter: {} }));

import { runSignOut } from '@/core/sync/signOut';
import { runDeleteAccount } from '@/core/sync/deleteAccount';

const enableCloudSync = (enabled: boolean) => {
  useLabsStore.setState((state) => ({
    preferences: {
      ...state.preferences,
      enabledFeatures: { ...state.preferences.enabledFeatures, cloud_sync: enabled },
    },
  }));
};

describe('AccountTab', () => {
  beforeEach(() => {
    resetAllStores();
    enableCloudSync(true);
    useSessionStore.setState({ status: 'unknown', user: null });
    useSyncStatusStore.setState({ state: 'idle', pendingCount: 0 });
    vi.mocked(runSignOut).mockClear();
    vi.mocked(runDeleteAccount).mockClear();
  });
  afterEach(() => cleanup());

  it('shows the local-mode framing and provider buttons when anonymous', () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    render(<AccountTab />);
    expect(screen.getByText(/working locally/i)).toBeTruthy();
    expect(screen.getByText(/your layouts are saved on this device\./i)).toBeTruthy();
    expect(screen.getByText(/with sync, you can:/i)).toBeTruthy();
    expect(screen.getByText(/sync across all your devices/i)).toBeTruthy();
    expect(screen.getByText(/never lose a layout/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeTruthy();
  });

  it('uses the universal "Account" heading regardless of auth state', () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    const { rerender } = render(<AccountTab />);
    expect(screen.getAllByText(/^account$/i).length).toBeGreaterThan(0);
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@x', displayName: 'A' },
    });
    rerender(<AccountTab />);
    expect(screen.getAllByText(/^account$/i).length).toBeGreaterThan(0);
  });

  it('renders identity and sync status when authenticated', () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: {
        userId: 'u1',
        provider: 'github',
        email: 'andy@example.com',
        displayName: 'Andy Aragon',
      },
    });
    useSyncStatusStore.setState({ state: 'idle', pendingCount: 0 });
    render(<AccountTab />);
    expect(screen.getByText('Andy Aragon')).toBeTruthy();
    expect(screen.getByText('andy@example.com')).toBeTruthy();
    expect(screen.getByText(/all changes synced/i)).toBeTruthy();
    expect(screen.getByText(/not synced yet/i)).toBeTruthy();
  });

  it('triggers runSignOut from the sign-out button', () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@x', displayName: 'A' },
    });
    render(<AccountTab />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(runSignOut).toHaveBeenCalledTimes(1);
  });

  it('renders the Danger Zone with a Delete account button when authenticated', () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@x', displayName: 'A' },
    });
    render(<AccountTab />);
    expect(screen.getByText(/danger zone/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeTruthy();
  });

  it('does NOT render the Delete account button when anonymous', () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    render(<AccountTab />);
    expect(screen.queryByRole('button', { name: /delete account/i })).toBeNull();
    expect(screen.queryByText(/danger zone/i)).toBeNull();
  });

  it('triggers runDeleteAccount from the Delete account button', () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@x', displayName: 'A' },
    });
    render(<AccountTab />);
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(runDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it('surfaces pending count and last error when sync is degraded', () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@x', displayName: 'A' },
    });
    useSyncStatusStore.setState({
      state: 'error',
      pendingCount: 3,
      lastError: 'quota exceeded',
    });
    render(<AccountTab />);
    expect(screen.getByText(/sync error/i)).toBeTruthy();
    expect(screen.getByText(/3 pending/i)).toBeTruthy();
    expect(screen.getByText(/quota exceeded/)).toBeTruthy();
  });
});
