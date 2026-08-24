import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WhatsNewModal } from './WhatsNewModal';
import { WHATS_NEW_ENTRIES } from '@/features/whats-new/entries';
import { hasUnseen, markAllSeen, reloadSeenState } from '@/features/whats-new';
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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('does not claim missed updates to someone who is caught up', () => {
    markAllSeen();
    useViewStore.getState().setWhatsNewOpen(true);
    render(<WhatsNewModal />);

    expect(screen.getByText('whatsNew.subtitleRecent')).toBeInTheDocument();
    expect(screen.queryByText('whatsNew.subtitleUnseenMany')).not.toBeInTheDocument();
  });

  it('clears the unseen badge once opened', () => {
    localStorage.setItem(
      'gridfinity-whats-new-v1',
      JSON.stringify({ lastSeenId: 'an-older-entry', lastAutoOpenAt: 0 })
    );
    reloadSeenState();
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

  it('navigates in-app rather than hard-reloading for a layout action', async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    // Restored in afterEach: nothing here auto-restores mocks, and a leaked
    // window.location getter would follow into every later test.
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      assign,
    });

    // Rewind the marker just past the newest layout-action entry so the digest
    // is guaranteed to contain one, without hardcoding an id that may be pruned.
    const idx = WHATS_NEW_ENTRIES.findIndex(
      (e) => e.action?.kind === 'openTool' && e.action.tool === 'layout'
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    localStorage.setItem(
      'gridfinity-whats-new-v1',
      JSON.stringify({ lastSeenId: WHATS_NEW_ENTRIES[idx + 1].id, lastAutoOpenAt: 0 })
    );
    reloadSeenState();

    useViewStore.getState().setWhatsNewOpen(true);
    render(<WhatsNewModal />);

    const layoutAction = screen.getAllByRole('button', {
      name: 'whatsNew.action.openTool.layout',
    })[0];
    await user.click(layoutAction);

    // A full reload would drop in-memory UI state; the routing hooks do not.
    expect(assign).not.toHaveBeenCalled();
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
