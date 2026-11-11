import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureInstallPrompt,
  closeInstallOffer,
  isInstallOfferClosed,
} from '@/shared/pwa/installPrompt';
import { InstallAppOffer } from './InstallAppOffer';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const tracked = vi.hoisted(() => ({
  trackPwaInstallPromptShown: vi.fn(),
  trackPwaInstallOfferClosed: vi.fn(),
  trackPwaInstallPromptResult: vi.fn(),
}));
vi.mock('@/shared/analytics/posthog', () => tracked);

function fireInstallAvailable(): ReturnType<typeof vi.fn> {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
  });
  window.dispatchEvent(event);
  return prompt;
}

beforeAll(() => {
  captureInstallPrompt();
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent(new Event('appinstalled'));
});

describe('InstallAppOffer', () => {
  it('renders nothing when the browser cannot install the app', () => {
    const { container } = render(<InstallAppOffer />);

    expect(container).toBeEmptyDOMElement();
    expect(tracked.trackPwaInstallPromptShown).not.toHaveBeenCalled();
  });

  it('offers the install and tracks that it was shown', () => {
    fireInstallAvailable();

    render(<InstallAppOffer />);

    expect(screen.getByText('pwaInstall.title')).toBeInTheDocument();
    expect(tracked.trackPwaInstallPromptShown).toHaveBeenCalledWith('export_success');
  });

  it('stays hidden while a recent close is in effect', () => {
    fireInstallAvailable();
    closeInstallOffer();

    const { container } = render(<InstallAppOffer />);

    expect(container).toBeEmptyDOMElement();
  });

  it('opens the browser install dialog on click', async () => {
    const prompt = fireInstallAvailable();
    render(<InstallAppOffer />);

    await act(async () => {
      fireEvent.click(screen.getByText('pwaInstall.title'));
      await Promise.resolve();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('hides and starts the cooldown when the user closes it', () => {
    fireInstallAvailable();
    render(<InstallAppOffer />);

    fireEvent.click(screen.getByRole('button', { name: 'pwaInstall.notNow' }));

    expect(screen.queryByText('pwaInstall.title')).not.toBeInTheDocument();
    expect(isInstallOfferClosed()).toBe(true);
    expect(tracked.trackPwaInstallOfferClosed).toHaveBeenCalledWith('export_success');
  });
});
