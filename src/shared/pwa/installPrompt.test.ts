// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canPromptInstall,
  captureInstallPrompt,
  closeInstallOffer,
  isInstallOfferClosed,
  promptInstall,
  subscribeInstallPrompt,
  wasAppInstalled,
} from './installPrompt';

const DAY_MS = 24 * 60 * 60 * 1000;

function fireInstallAvailable(
  outcome: 'accepted' | 'dismissed' = 'accepted'
): ReturnType<typeof vi.fn> {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  window.dispatchEvent(event);
  return prompt;
}

beforeAll(() => {
  captureInstallPrompt();
});

beforeEach(() => {
  window.dispatchEvent(new Event('appinstalled'));
  localStorage.clear();
});

describe('install prompt', () => {
  it('becomes available when Chrome fires beforeinstallprompt', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInstallPrompt(listener);

    expect(canPromptInstall()).toBe(false);
    fireInstallAvailable();

    expect(canPromptInstall()).toBe(true);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('opens the dialog once and returns the outcome', async () => {
    const prompt = fireInstallAvailable('dismissed');

    await expect(promptInstall()).resolves.toBe('dismissed');

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(canPromptInstall()).toBe(false);
    await expect(promptInstall()).resolves.toBe('unavailable');
  });

  it('reports unavailable when Chrome rejects the prompt', async () => {
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn().mockRejectedValue(new DOMException('no user gesture', 'NotAllowedError')),
      userChoice: new Promise(() => undefined),
    });
    window.dispatchEvent(event);

    await expect(promptInstall()).resolves.toBe('unavailable');
  });

  it('is unavailable after the app is installed, and remembers the install', () => {
    fireInstallAvailable();
    expect(wasAppInstalled()).toBe(false);

    window.dispatchEvent(new Event('appinstalled'));

    expect(canPromptInstall()).toBe(false);
    expect(wasAppInstalled()).toBe(true);
  });
});

describe('install offer cooldown', () => {
  it('is open when the user never closed it', () => {
    expect(isInstallOfferClosed()).toBe(false);
  });

  it('stays closed for 90 days after the user closes it', () => {
    const closedAt = Date.UTC(2026, 10, 1);
    closeInstallOffer(closedAt);

    expect(isInstallOfferClosed(closedAt + 89 * DAY_MS)).toBe(true);
    expect(isInstallOfferClosed(closedAt + 91 * DAY_MS)).toBe(false);
  });
});
