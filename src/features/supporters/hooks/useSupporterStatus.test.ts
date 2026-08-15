import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useSupporterStatus } from './useSupporterStatus';
import type * as SupporterClient from '../api/supporterClient';
import type { SupporterStatus } from '../api/supporterClient';

const fetchSupporterStatus = vi.fn();
const updateSupporterProfile = vi.fn();

vi.mock('../api/supporterClient', async (importOriginal) => {
  const actual = await importOriginal<typeof SupporterClient>();
  return {
    ...actual,
    fetchSupporterStatus: (...args: unknown[]) => fetchSupporterStatus(...args),
    updateSupporterProfile: (...args: unknown[]) => updateSupporterProfile(...args),
  };
});

/** An authenticated session always carries a user; `user: null` is unreachable. */
const USER = {
  userId: 'user-1',
  provider: 'google' as const,
  email: 'jo@example.com',
};

const OTHER_USER = { ...USER, userId: 'user-2', email: 'sam@example.com' };

const SUPPORTER: SupporterStatus = {
  supporter: true,
  badgePublic: true,
  name: 'Jo',
  message: null,
};

describe('useSupporterStatus', () => {
  beforeEach(() => {
    fetchSupporterStatus.mockReset();
    updateSupporterProfile.mockReset();
    fetchSupporterStatus.mockResolvedValue(SUPPORTER);
    useSessionStore.setState({ status: 'unknown', user: null });
  });

  it('stays unsettled while the session is still resolving', () => {
    const { result } = renderHook(() => useSupporterStatus());
    expect(result.current.settled).toBe(false);
    // Asking now would answer for a session that has not resolved, settling the
    // panel on the wrong branch.
    expect(fetchSupporterStatus).not.toHaveBeenCalled();
  });

  it('settles immediately for an anonymous visitor without a request', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    const { result } = renderHook(() => useSupporterStatus());
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.status.supporter).toBe(false);
    expect(fetchSupporterStatus).not.toHaveBeenCalled();
  });

  it('reads the status once the session authenticates', async () => {
    useSessionStore.setState({ status: 'authenticated', user: USER });
    const { result } = renderHook(() => useSupporterStatus());
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.status).toEqual(SUPPORTER);
  });

  it('re-reads when the session flips, which is when a match can newly succeed', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    const { result } = renderHook(() => useSupporterStatus());
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.status.supporter).toBe(false);

    act(() => useSessionStore.setState({ status: 'authenticated', user: USER }));
    await waitFor(() => expect(result.current.status.supporter).toBe(true));
  });

  it('drops back to anonymous on sign-out', async () => {
    useSessionStore.setState({ status: 'authenticated', user: USER });
    const { result } = renderHook(() => useSupporterStatus());
    await waitFor(() => expect(result.current.status.supporter).toBe(true));

    act(() => useSessionStore.setState({ status: 'anonymous', user: null }));
    await waitFor(() => expect(result.current.status.supporter).toBe(false));
  });

  it("never shows the previous account's record to a different user", async () => {
    useSessionStore.setState({ status: 'authenticated', user: USER });
    const { result } = renderHook(() => useSupporterStatus());
    await waitFor(() => expect(result.current.status.name).toBe('Jo'));

    // Sign out and back in as somebody else. Until the new read lands, the
    // hook must report unsettled — not the prior account's name.
    fetchSupporterStatus.mockReturnValue(new Promise(() => {}));
    act(() => useSessionStore.setState({ status: 'anonymous', user: null }));
    act(() => useSessionStore.setState({ status: 'authenticated', user: OTHER_USER }));

    expect(result.current.status.name).toBeNull();
    expect(result.current.settled).toBe(false);
  });

  it('adopts the server-filtered record a save returns', async () => {
    useSessionStore.setState({ status: 'authenticated', user: USER });
    updateSupporterProfile.mockResolvedValue({ ...SUPPORTER, name: 'Joanne' });
    const { result } = renderHook(() => useSupporterStatus());
    await waitFor(() => expect(result.current.settled).toBe(true));

    let error: unknown;
    await act(async () => {
      error = await result.current.save({ name: 'Joanne' });
    });
    expect(error).toBeNull();
    expect(result.current.status.name).toBe('Joanne');
  });

  it('leaves the record untouched when a save is rejected', async () => {
    useSessionStore.setState({ status: 'authenticated', user: USER });
    updateSupporterProfile.mockResolvedValue({ kind: 'blocked', message: 'no' });
    const { result } = renderHook(() => useSupporterStatus());
    await waitFor(() => expect(result.current.settled).toBe(true));

    let error: unknown;
    await act(async () => {
      error = await result.current.save({ name: 'kys' });
    });
    expect(error).toEqual({ kind: 'blocked', message: 'no' });
    expect(result.current.status.name).toBe('Jo');
  });
});
