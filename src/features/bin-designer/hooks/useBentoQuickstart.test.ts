import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBentoQuickstart } from './useBentoQuickstart';

// The flag's cache is captured at module load, so a test that seeds
// localStorage afterwards cannot observe it. Key isolation between flags is
// covered by `quickstartFlag.test.ts`, which builds its flags per test.
describe('useBentoQuickstart', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists dismissal under its own key', () => {
    const { result } = renderHook(() => useBentoQuickstart());

    act(() => result.current.markQuickstartSeen());

    expect(result.current.quickstartSeen).toBe(true);
    expect(localStorage.getItem('gridfinity-bento-quickstart-seen')).toBe('true');
  });

  it('leaves the cutout workspace flag alone', () => {
    const { result } = renderHook(() => useBentoQuickstart());

    act(() => result.current.markQuickstartSeen());

    expect(localStorage.getItem('gridfinity-cutout-quickstart-seen')).toBeNull();
  });
});
