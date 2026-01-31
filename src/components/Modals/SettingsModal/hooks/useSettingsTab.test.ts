import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsTab } from './useSettingsTab';

describe('useSettingsTab', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('defaults to general tab when no initialTab or stored value', () => {
    const { result } = renderHook(() => useSettingsTab());
    expect(result.current.activeTab).toBe('general');
  });

  it('uses initialTab prop when provided', () => {
    const { result } = renderHook(() => useSettingsTab('labs'));
    expect(result.current.activeTab).toBe('labs');
  });

  it('restores from sessionStorage when no initialTab', () => {
    sessionStorage.setItem('gridfinity-settings-active-tab', 'privacy');
    const { result } = renderHook(() => useSettingsTab());
    expect(result.current.activeTab).toBe('privacy');
  });

  it('prefers initialTab over sessionStorage', () => {
    sessionStorage.setItem('gridfinity-settings-active-tab', 'privacy');
    const { result } = renderHook(() => useSettingsTab('integrations'));
    expect(result.current.activeTab).toBe('integrations');
  });

  it('ignores invalid sessionStorage values', () => {
    sessionStorage.setItem('gridfinity-settings-active-tab', 'invalid-tab');
    const { result } = renderHook(() => useSettingsTab());
    expect(result.current.activeTab).toBe('general');
  });

  it('persists tab changes to sessionStorage', () => {
    const { result } = renderHook(() => useSettingsTab());
    act(() => {
      result.current.setActiveTab('defaults');
    });
    expect(result.current.activeTab).toBe('defaults');
    expect(sessionStorage.getItem('gridfinity-settings-active-tab')).toBe('defaults');
  });

  it('captures initialTab at mount time (modal remounts on open)', () => {
    const { result } = renderHook(() => useSettingsTab('labs'));
    expect(result.current.activeTab).toBe('labs');
    expect(sessionStorage.getItem('gridfinity-settings-active-tab')).toBe('labs');
  });

  it('handles sessionStorage errors gracefully', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });
    const { result } = renderHook(() => useSettingsTab());
    expect(result.current.activeTab).toBe('general');
    getItemSpy.mockRestore();
  });
});
