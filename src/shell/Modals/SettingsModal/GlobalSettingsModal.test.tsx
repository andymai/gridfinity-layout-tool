// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GlobalSettingsModal } from './GlobalSettingsModal';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('./SettingsModal', () => ({
  SettingsModal: ({
    isOpen,
    onClose,
    initialTab,
  }: {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: string;
  }) =>
    isOpen ? (
      <div data-testid="settings-modal" data-tab={initialTab ?? 'none'}>
        <button data-testid="close-settings" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

const open = (detail?: { tab?: string }): void => {
  act(() => {
    window.dispatchEvent(
      detail
        ? new CustomEvent('open-settings-modal', { detail })
        : new CustomEvent('open-settings-modal')
    );
  });
};

describe('GlobalSettingsModal', () => {
  it('renders nothing until the event fires', () => {
    render(<GlobalSettingsModal />);
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });

  it('opens on a detail-less open-settings-modal event (default tab)', async () => {
    render(<GlobalSettingsModal />);
    open();
    expect(await screen.findByTestId('settings-modal')).toHaveAttribute('data-tab', 'none');
  });

  it('deep-links the tab carried in the event detail', async () => {
    render(<GlobalSettingsModal />);
    open({ tab: 'account' });
    expect(await screen.findByTestId('settings-modal')).toHaveAttribute('data-tab', 'account');
  });

  it('closes when the modal requests it', async () => {
    render(<GlobalSettingsModal />);
    open();
    fireEvent.click(await screen.findByTestId('close-settings'));
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });
});
