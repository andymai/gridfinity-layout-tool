import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppVersionButton, AppVersionRailButton } from './AppVersionButton';
import { usePWAUpdateStore } from '@/core/store/pwaUpdate';
import { useViewStore } from '@/core/store/view';
import { markAllSeen, reloadSeenState } from '@/features/whats-new';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, string>) =>
    key === 'sidebar.version' ? `v${vars?.version ?? ''}` : key,
}));

function button(): HTMLElement {
  return screen.getByRole('button');
}

describe('AppVersionButton', () => {
  beforeEach(() => {
    resetAllStores();
    localStorage.clear();
    reloadSeenState();
    usePWAUpdateStore.getState().clearUpdate();
  });

  it('shows the version alone when nothing is pending', () => {
    markAllSeen();
    render(<AppVersionButton />);
    expect(button()).toHaveTextContent(/^v\d/);
    expect(button()).not.toHaveTextContent('whatsNew.badge');
  });

  it('badges unseen highlights and opens the digest', async () => {
    const user = userEvent.setup();
    render(<AppVersionButton />);
    expect(button()).toHaveTextContent('whatsNew.badge');

    await user.click(button());
    expect(useViewStore.getState().whatsNewOpen).toBe(true);
  });

  it('a pending update takes precedence over unseen highlights', () => {
    usePWAUpdateStore.getState().announceUpdate(() => {});
    render(<AppVersionButton />);
    // Both conditions are true, but only the update chip may render: the two
    // signals share one slot precisely so they cannot compete.
    expect(button()).toHaveTextContent('pwaUpdate.reload');
    expect(button()).not.toHaveTextContent('whatsNew.badge');
  });

  it('applies the update instead of opening the digest while one is pending', async () => {
    const user = userEvent.setup();
    const apply = vi.fn();
    usePWAUpdateStore.getState().announceUpdate(apply);
    render(<AppVersionButton />);

    await user.click(button());
    expect(apply).toHaveBeenCalledOnce();
    expect(useViewStore.getState().whatsNewOpen).toBe(false);
  });

  it('runs onBeforeAction first, so a panel can close behind it', async () => {
    const user = userEvent.setup();
    const onBeforeAction = vi.fn();
    render(<AppVersionButton onBeforeAction={onBeforeAction} />);

    await user.click(button());
    expect(onBeforeAction).toHaveBeenCalledOnce();
  });
});

describe('AppVersionRailButton', () => {
  beforeEach(() => {
    resetAllStores();
    localStorage.clear();
    reloadSeenState();
    usePWAUpdateStore.getState().clearUpdate();
  });

  it('renders nothing when there is nothing to say', () => {
    markAllSeen();
    const { container } = render(<AppVersionRailButton />);
    expect(container.firstChild).toBeNull();
  });

  it('stays available when a pending update needs applying', async () => {
    const user = userEvent.setup();
    const apply = vi.fn();
    usePWAUpdateStore.getState().announceUpdate(apply);
    render(<AppVersionRailButton />);

    await user.click(screen.getByRole('button', { name: 'pwaUpdate.reloadAria' }));
    expect(apply).toHaveBeenCalledOnce();
  });
});
