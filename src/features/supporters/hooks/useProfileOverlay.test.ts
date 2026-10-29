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
