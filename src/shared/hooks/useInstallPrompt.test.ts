// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureInstallPrompt, isInstallOfferClosed } from '@/shared/pwa/installPrompt';
import { useInstallPrompt } from './useInstallPrompt';

const { trackPwaInstallPromptResult } = vi.hoisted(() => ({
  trackPwaInstallPromptResult: vi.fn(),
}));

vi.mock('@/shared/analytics/posthog', () => ({ trackPwaInstallPromptResult }));

function fireInstallAvailable(outcome: 'accepted' | 'dismissed'): void {
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  window.dispatchEvent(event);
}

beforeAll(() => {
  captureInstallPrompt();
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent(new Event('appinstalled'));
});

describe('useInstallPrompt', () => {
  it('reports when Chrome makes install available', () => {
    const { result } = renderHook(() => useInstallPrompt('settings'));
    expect(result.current.canInstall).toBe(false);

    act(() => fireInstallAvailable('accepted'));

    expect(result.current.canInstall).toBe(true);
  });

  it('tracks an accepted install with its placement', async () => {
    const { result } = renderHook(() => useInstallPrompt('settings'));
    act(() => fireInstallAvailable('accepted'));

    await act(async () => {
      await expect(result.current.install()).resolves.toBe('accepted');
    });

    expect(trackPwaInstallPromptResult).toHaveBeenCalledWith('settings', 'accepted');
    expect(isInstallOfferClosed()).toBe(false);
  });

  it('closes the post-export offer after a dismissal', async () => {
    const { result } = renderHook(() => useInstallPrompt('export_success'));
    act(() => fireInstallAvailable('dismissed'));

    await act(async () => {
      await result.current.install();
    });

    expect(trackPwaInstallPromptResult).toHaveBeenCalledWith('export_success', 'dismissed');
    expect(isInstallOfferClosed()).toBe(true);
  });

  it('does nothing when no install is available', async () => {
    const { result } = renderHook(() => useInstallPrompt('settings'));

    await act(async () => {
      await expect(result.current.install()).resolves.toBe('unavailable');
    });

    expect(trackPwaInstallPromptResult).not.toHaveBeenCalled();
  });
});
