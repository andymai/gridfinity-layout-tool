import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WhatsNewModal } from './WhatsNewModal';
import { WHATS_NEW_ENTRIES } from '@/features/whats-new/entries';
import { DIGEST_MAX } from '@/features/whats-new/digest';
import { hasUnseen, markAllSeen, reloadSeenState } from '@/features/whats-new';
import { getSeenState } from '@/features/whats-new/seenState';
import { useSettingsStore } from '@/core/store/settings';
import { useViewStore } from '@/core/store/view';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
  useCurrentLocale: () => 'en' as const,
}));

function open(): void {
  useViewStore.getState().setWhatsNewOpen(true);
}

/** Rewinds the seen marker to `steps` entries back, producing an unseen digest. */
function rewind(steps: number): void {
  localStorage.setItem(
    'gridfinity-whats-new-v1',
    JSON.stringify({ lastSeenId: WHATS_NEW_ENTRIES[steps].id, lastAutoOpenAt: 0 })
  );
  reloadSeenState();
}

/**
 * Puts the newest featured entry inside the digest window. Entries are prepended
 * every release, so a test that assumed the promoted one was still among the
 * newest few would rot the moment enough unflagged entries shipped above it.
 */
function rewindPastFirstFeatured(): void {
  const index = WHATS_NEW_ENTRIES.findIndex((entry) => entry.featured === true);
  expect(index).toBeGreaterThanOrEqual(0);
  expect(index).toBeLessThan(DIGEST_MAX);
  rewind(index + 1);
}

/** The lead card is the digest's only article. */
function leadCard(): HTMLElement {
  return screen.getByRole('article');
}

/** Matches a button by the start of its accessible name, which for a row
 *  concatenates the title, the body and the destination label. */
function rowNamed(title: string) {
  return { name: (name: string) => name.startsWith(title) };
}

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

  it('leads with a featured entry, not simply the newest one', () => {
    rewindPastFirstFeatured();
    open();
    render(<WhatsNewModal />);

    const card = leadCard();
    const heading = within(card).getByRole('heading', { level: 3 });
    const promoted = WHATS_NEW_ENTRIES.find((entry) => entry.title.en === heading.textContent);
    expect(promoted?.featured).toBe(true);
    // A promoted entry keeps its full body; the rows below it are clamped.
    expect(within(card).getByText(promoted?.body?.en ?? '')).toBeInTheDocument();
  });

  it('states each kind once, as a heading, never per row', () => {
    rewindPastFirstFeatured();
    open();
    render(<WhatsNewModal />);

    // The lead card's title plus at least one section heading, so the counts
    // below are measuring a rendered list rather than an empty one.
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(1);

    for (const kind of ['new', 'improved', 'fixed'] as const) {
      expect(screen.queryAllByText(`whatsNew.kind.${kind}`).length).toBeLessThanOrEqual(1);
    }
  });

  it('anchors the digest to the running version', () => {
    open();
    render(<WhatsNewModal />);
    expect(screen.getByText('sidebar.version')).toBeInTheDocument();
  });

  it('does not claim missed updates to someone who is caught up', () => {
    markAllSeen();
    open();
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
    open();
    render(<WhatsNewModal />);
    expect(hasUnseen(getSeenState())).toBe(false);
  });

  it('keeps the digest on screen after marking it seen', () => {
    open();
    render(<WhatsNewModal />);
    // markAllSeen() empties the unseen list on open; the frozen digest must survive it.
    expect(screen.getByText(WHATS_NEW_ENTRIES[0].title.en)).toBeInTheDocument();
  });

  it('caps a long absence and offers the remainder rather than listing it', async () => {
    const user = userEvent.setup();
    rewind(DIGEST_MAX + 6);
    open();
    render(<WhatsNewModal />);

    // The entry just past the cap is held back, not dropped.
    const heldBack = WHATS_NEW_ENTRIES[DIGEST_MAX + 1];
    expect(screen.queryByText(heldBack.title.en)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /whatsNew.overflowMany/ }));
    expect(screen.getByText(heldBack.title.en)).toBeInTheDocument();
  });

  it('navigates in-app rather than hard-reloading from the lead card', async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    // Restored in afterEach: nothing here auto-restores mocks, and a leaked
    // window.location getter would follow into every later test.
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      assign,
    });

    rewindPastFirstFeatured();
    open();
    render(<WhatsNewModal />);

    // Scoped to the card: rows below it carry the same destination labels.
    const action = within(leadCard()).getByRole('button');
    await user.click(action);

    // A full reload would drop in-memory UI state; the routing hooks do not.
    expect(assign).not.toHaveBeenCalled();
    expect(useViewStore.getState().whatsNewOpen).toBe(false);
  });

  it('narrows the archive by kind', async () => {
    const user = userEvent.setup();
    open();
    render(<WhatsNewModal />);

    await user.click(screen.getByRole('button', { name: /whatsNew.seeAll/ }));

    const aNewEntry = WHATS_NEW_ENTRIES.find((entry) => (entry.kind ?? 'new') === 'new');
    const title = aNewEntry?.title.en ?? '';
    expect(screen.getByText(title)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /whatsNew.kind.fixed/ }));
    expect(screen.queryByText(title)).not.toBeInTheDocument();
  });

  it('keeps archive rows to one line until one is expanded', async () => {
    const user = userEvent.setup();
    open();
    render(<WhatsNewModal />);
    await user.click(screen.getByRole('button', { name: /whatsNew.seeAll/ }));

    const newest = WHATS_NEW_ENTRIES[0];
    expect(screen.queryByText(newest.body?.en ?? '')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', rowNamed(newest.title.en)));
    expect(screen.getByText(newest.body?.en ?? '')).toBeInTheDocument();
  });

  it('reaches a destination from an expanded archive row', async () => {
    const user = userEvent.setup();
    open();
    render(<WhatsNewModal />);
    await user.click(screen.getByRole('button', { name: /whatsNew.seeAll/ }));

    const withAction = WHATS_NEW_ENTRIES.find(
      (e) => e.action !== undefined && e.labs === undefined
    );
    expect(withAction).toBeDefined();
    const title = withAction?.title.en ?? '';

    await user.click(screen.getByRole('button', rowNamed(title)));
    await user.click(screen.getByRole('button', { name: /whatsNew.action.openTool/ }));

    expect(useViewStore.getState().whatsNewOpen).toBe(false);
  });

  it('reopens on the digest rather than resuming the archive', async () => {
    const user = userEvent.setup();
    open();
    const { rerender } = render(<WhatsNewModal />);

    await user.click(screen.getByRole('button', { name: /whatsNew.seeAll/ }));
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'whatsNew.dismiss' }));
    open();
    rerender(<WhatsNewModal />);

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByText('sidebar.version')).toBeInTheDocument();
  });

  it('opts out through the settings store rather than local state', async () => {
    const user = userEvent.setup();
    open();
    render(<WhatsNewModal />);

    expect(useSettingsStore.getState().settings.showUpdateSummaries).toBe(true);
    await user.click(screen.getByLabelText('whatsNew.dontShowAgain'));
    expect(useSettingsStore.getState().settings.showUpdateSummaries).toBe(false);
  });
});
