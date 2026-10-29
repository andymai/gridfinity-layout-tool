import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useProfileOverlay } from './useProfileOverlay';
import type { UseSupporterStatus } from './useSupporterStatus';
import type { SupportersData } from '../utils/supportersData';

const list: SupportersData = {
  supporters: [{ name: 'Jo', department: 1 }, { name: null }, { name: 'Sam', department: 4 }],
};

function statusHook(
  name: string | null,
  extra: Partial<UseSupporterStatus['status']> = {}
): UseSupporterStatus {
  return {
    status: { supporter: true, badgePublic: true, name, message: null, ...extra },
    settled: true,
    save: vi.fn(async () => null),
  };
}

describe('useProfileOverlay', () => {
  it('leaves the list alone until the caller saves', () => {
    const { result } = renderHook(() => useProfileOverlay(list, statusHook('Joanna')));
    expect(result.current.effective).toBe(list);
  });

  it('renames the caller’s record in place after a save', async () => {
    const { result, rerender } = renderHook(({ s }) => useProfileOverlay(list, s), {
      initialProps: { s: statusHook('Jo') },
    });
    await act(() => result.current.saveProfile({ name: 'Joanna' }));
    rerender({ s: statusHook('Joanna', { message: 'hi', department: 1 }) });
    const names = result.current.effective.supporters.map((r) => r.name);
    expect(names).toEqual(['Joanna', null, 'Sam']);
    expect(result.current.effective.supporters[0]).toMatchObject({ message: 'hi', department: 1 });
  });

  it('names an anonymous supporter into the department the server gave them', async () => {
    const { result, rerender } = renderHook(({ s }) => useProfileOverlay(list, s), {
      initialProps: { s: statusHook(null) },
    });
    await act(() => result.current.saveProfile({ name: 'Ada' }));
    rerender({ s: statusHook('Ada', { department: 6 }) });
    expect(result.current.effective.supporters[1]).toMatchObject({ name: 'Ada', department: 6 });
    expect(result.current.effective.supporters).toHaveLength(3);
  });

  it('shows a new message when only the message changed', async () => {
    const { result, rerender } = renderHook(({ s }) => useProfileOverlay(list, s), {
      initialProps: { s: statusHook('Jo') },
    });
    await act(() => result.current.saveProfile({ message: 'hello again' }));
    rerender({ s: statusHook('Jo', { message: 'hello again', department: 1 }) });
    expect(result.current.effective.supporters[0]).toMatchObject({
      name: 'Jo',
      message: 'hello again',
    });
  });

  it('takes the name, message and department off a supporter who goes anonymous', async () => {
    const withMessage: SupportersData = {
      supporters: [
        { name: 'Jo', message: 'hi', department: 1 },
        { name: 'Sam', department: 4 },
      ],
    };
    const { result, rerender } = renderHook(({ s }) => useProfileOverlay(withMessage, s), {
      initialProps: { s: statusHook('Jo', { message: 'hi' }) },
    });
    await act(() => result.current.saveProfile({ name: null }));
    rerender({ s: statusHook(null) });
    expect(result.current.effective.supporters[0]).toEqual({
      name: null,
      message: undefined,
      department: undefined,
    });
  });

  it('finds the caller among namesakes by join date', async () => {
    const twins: SupportersData = {
      supporters: [
        { name: 'Max', joinedAt: '2026-07-01T00:00:00Z', department: 2 },
        { name: 'Max', joinedAt: '2026-08-01T00:00:00Z', department: 5 },
      ],
    };
    const joinedAt = '2026-08-01T00:00:00Z';
    const { result, rerender } = renderHook(({ s }) => useProfileOverlay(twins, s), {
      initialProps: { s: statusHook('Max', { joinedAt }) },
    });
    await act(() => result.current.saveProfile({ message: 'mine' }));
    rerender({ s: statusHook('Max', { joinedAt, message: 'mine', department: 5 }) });
    expect(result.current.effective.supporters.map((r) => r.message)).toEqual([undefined, 'mine']);
  });

  it('tells namesakes apart by department when they share a join date too', async () => {
    const twins: SupportersData = {
      supporters: [
        { name: 'Sam', department: 2 },
        { name: 'Sam', department: 6 },
      ],
    };
    const { result, rerender } = renderHook(({ s }) => useProfileOverlay(twins, s), {
      initialProps: { s: statusHook('Sam', { department: 6 }) },
    });
    await act(() => result.current.saveProfile({ name: 'Samantha' }));
    rerender({ s: statusHook('Samantha', { department: 6 }) });
    expect(result.current.effective.supporters.map((r) => r.name)).toEqual(['Sam', 'Samantha']);
  });

  it('drops the edit once a different account is signed in', async () => {
    const { result, rerender } = renderHook(({ s }) => useProfileOverlay(list, s), {
      initialProps: { s: statusHook('Jo', { joinedAt: '2026-07-01T00:00:00Z' }) },
    });
    await act(() => result.current.saveProfile({ name: 'Joanna' }));
    rerender({ s: statusHook('Sam', { joinedAt: '2026-09-09T00:00:00Z', department: 4 }) });
    expect(result.current.effective).toBe(list);
  });

  it('leaves namesakes alone when nothing tells them apart', async () => {
    const twins: SupportersData = { supporters: [{ name: 'Max' }, { name: 'Max' }] };
    const { result, rerender } = renderHook(({ s }) => useProfileOverlay(twins, s), {
      initialProps: { s: statusHook('Max') },
    });
    await act(() => result.current.saveProfile({ message: 'mine' }));
    rerender({ s: statusHook('Max', { message: 'mine' }) });
    expect(result.current.effective).toBe(twins);
  });

  it('keeps tracking the original name across repeated renames', async () => {
    const { result, rerender } = renderHook(({ s }) => useProfileOverlay(list, s), {
      initialProps: { s: statusHook('Jo') },
    });
    await act(() => result.current.saveProfile({ name: 'Joanna' }));
    rerender({ s: statusHook('Joanna') });
    await act(() => result.current.saveProfile({ name: 'Jojo' }));
    rerender({ s: statusHook('Jojo') });
    expect(result.current.effective.supporters[0].name).toBe('Jojo');
  });
});
