import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WhatsNewModal } from './WhatsNewModal';
import { WHATS_NEW_ENTRIES } from '@/features/whats-new/entries';
import { hasUnseen, reloadSeenState } from '@/features/whats-new';
import { getSeenState } from '@/features/whats-new/seenState';
import { useSettingsStore } from '@/core/store/settings';
import { useViewStore } from '@/core/store/view';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
  useCurrentLocale: () => 'en' as const,
}));

describe('WhatsNewModal', () => {
  beforeEach(() => {
    resetAllStores();
    localStorage.clear();
    reloadSeenState();
  });

  it('renders nothing while closed', () => {
    const { container } = render(<WhatsNewModal />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the newest entries when opened with no marker', () => {
    useViewStore.getState().setWhatsNewOpen(true);
    render(<WhatsNewModal />);
    expect(screen.getByText(WHATS_NEW_ENTRIES[0].title.en)).toBeInTheDocument();
  });

  it('clears the unseen badge once opened', () => {
    expect(hasUnseen(getSeenState())).toBe(true);
    useViewStore.getState().setWhatsNewOpen(true);
    render(<WhatsNewModal />);
    expect(hasUnseen(getSeenState())).toBe(false);
  });

  it('keeps the digest on screen after marking it seen', () => {
    useViewStore.getState().setWhatsNewOpen(true);
    render(<WhatsNewModal />);
    // markAllSeen() empties the unseen list on open; the frozen digest must survive it.
    expect(screen.getByText(WHATS_NEW_ENTRIES[0].title.en)).toBeInTheDocument();
  });

  it('opts out through the settings store rather than local state', async () => {
    const user = userEvent.setup();
    useViewStore.getState().setWhatsNewOpen(true);
    render(<WhatsNewModal />);

    expect(useSettingsStore.getState().settings.showUpdateSummaries).toBe(true);
    await user.click(screen.getByLabelText('whatsNew.dontShowAgain'));
    expect(useSettingsStore.getState().settings.showUpdateSummaries).toBe(false);
  });
});
