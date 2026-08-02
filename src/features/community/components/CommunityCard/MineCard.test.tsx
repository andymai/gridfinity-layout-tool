// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ok, err } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import { unpublishDesign } from '../../api/client';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { INITIAL_MINE_STATE, useMineStore } from '../../store/mineStore';
import { MineCard } from './MineCard';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

let mockIsMobile = false;
vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: mockIsMobile }),
}));

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return { ...actual, unpublishDesign: vi.fn() };
});

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from '@/shared/analytics/posthog';

const unpublishMock = vi.mocked(unpublishDesign);

function card(overrides: Partial<CommunityCardData> = {}): CommunityCardData {
  return {
    id: 'abc123def456',
    name: 'Screw Sorter',
    authorName: 'Andy',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['compartments'],
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    thumbnailUrl: 'https://blob/abc-0-0.webp',
    isRemix: false,
    featured: false,
    counts: { likes: 12, remixes: 4, exports: 9 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

function renderCard(
  overrides: Partial<CommunityCardData> = {},
  props: Partial<Parameters<typeof MineCard>[0]> = {}
) {
  return render(
    <MineCard
      card={card(overrides)}
      onSelect={vi.fn()}
      onEdit={vi.fn()}
      editBusy={false}
      index={0}
      {...props}
    />
  );
}

beforeEach(() => {
  mockIsMobile = false;
  unpublishMock.mockReset();
  useMineStore.setState({ ...INITIAL_MINE_STATE });
  useBrowseStore.setState({ ...INITIAL_BROWSE_STATE });
  useToastStore.setState({ toasts: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MineCard stats row', () => {
  it('renders name, dims, and the likes/remixes/prints counts', () => {
    renderCard();
    expect(screen.getByText('Screw Sorter')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('community.mine.printsLabel')).toBeInTheDocument();
  });

  it('renders the owner-only opens/views stats when the API provides them', () => {
    renderCard({ counts: { likes: 0, remixes: 0, exports: 0, opens: 7, views: 31 } });
    expect(screen.getByTestId('community-mine-opens')).toHaveTextContent('7');
    expect(screen.getByTestId('community-mine-views')).toHaveTextContent('31');
  });

  it('omits opens/views entirely when absent rather than faking zeros', () => {
    renderCard();
    expect(screen.queryByTestId('community-mine-opens')).not.toBeInTheDocument();
    expect(screen.queryByTestId('community-mine-views')).not.toBeInTheDocument();
  });
});

describe('MineCard status badges', () => {
  it('shows no badge on a live design', () => {
    renderCard();
    expect(screen.queryByTestId('community-hidden-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('community-denylisted-badge')).not.toBeInTheDocument();
  });

  it('badges a report auto-hide as hidden-after-reports', () => {
    renderCard({ status: 'hidden', hiddenReason: 'reports' });
    expect(screen.getByTestId('community-hidden-badge')).toHaveTextContent(
      'community.mine.badge.hiddenReports'
    );
    expect(screen.queryByTestId('community-denylisted-badge')).not.toBeInTheDocument();
  });

  it('reads a hidden card with no reason as a report auto-hide (pre-field default)', () => {
    renderCard({ status: 'hidden' });
    expect(screen.getByTestId('community-hidden-badge')).toBeInTheDocument();
  });

  it('badges a deny-list hide distinctly from a report hide', () => {
    renderCard({ status: 'hidden', hiddenReason: 'denylist' });
    expect(screen.getByTestId('community-denylisted-badge')).toHaveTextContent(
      'community.mine.badge.accountRestricted'
    );
    expect(screen.queryByTestId('community-hidden-badge')).not.toBeInTheDocument();
  });

  it('badges a manual moderation hide without the pending-review framing', () => {
    renderCard({ status: 'hidden', hiddenReason: 'moderation' });
    expect(screen.getByTestId('community-moderation-badge')).toHaveTextContent(
      'community.mine.badge.hiddenModeration'
    );
    expect(screen.queryByTestId('community-hidden-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('community-denylisted-badge')).not.toBeInTheDocument();
  });

  it('folds the hidden status into the accessible card name', () => {
    renderCard({ status: 'hidden', hiddenReason: 'reports' });
    // The aria-label is the whole accessible name, so the visual badge would
    // otherwise be silent for screen-reader users navigating card by card.
    expect(
      screen.getByRole('button', { name: 'community.mine.cardHiddenAria' })
    ).toBeInTheDocument();
  });

  it('keeps the bare design name as the accessible name while live', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'Screw Sorter' })).toBeInTheDocument();
  });
});

describe('MineCard actions', () => {
  it('selects the card on click and keyboard activation', () => {
    const onSelect = vi.fn();
    renderCard({}, { onSelect });
    fireEvent.click(screen.getByTestId('community-mine-card'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByTestId('community-mine-card'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('edits without also opening the detail', () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();
    renderCard({}, { onSelect, onEdit });
    fireEvent.click(screen.getByTestId('community-mine-edit'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc123def456' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('disables Edit on a hidden design with the explanatory tooltip', () => {
    const onEdit = vi.fn();
    renderCard({ status: 'hidden', hiddenReason: 'reports' }, { onEdit });
    const edit = screen.getByTestId('community-mine-edit');
    expect(edit).toBeDisabled();
    expect(edit).toHaveAttribute('title', 'community.mine.editDisabledHidden');
  });

  it('disables Edit while another edit is in flight', () => {
    renderCard({}, { editBusy: true });
    expect(screen.getByTestId('community-mine-edit')).toBeDisabled();
  });

  it('grows Edit/Unpublish to the 44px touch target on mobile', () => {
    mockIsMobile = true;
    renderCard();
    expect(screen.getByTestId('community-mine-edit').className).toContain('min-h-[44px]');
    expect(screen.getByTestId('community-mine-unpublish').className).toContain('min-h-[44px]');
  });

  it('does not grow Edit/Unpublish beyond their compact size on desktop', () => {
    renderCard();
    expect(screen.getByTestId('community-mine-edit').className).not.toContain('min-h-[44px]');
    expect(screen.getByTestId('community-mine-unpublish').className).not.toContain('min-h-[44px]');
  });

  it('unpublishes through the confirm dialog and cleans up on success', async () => {
    useMineStore.setState({ items: [card()], status: 'ready' });
    useBrowseStore.setState({ items: [card()], status: 'ready' });
    unpublishMock.mockResolvedValue(ok({ success: true }));
    const onUnpublished = vi.fn().mockResolvedValue(undefined);
    const onSelect = vi.fn();
    renderCard({}, { onUnpublished, onSelect });

    fireEvent.click(screen.getByTestId('community-mine-unpublish'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('community.publish.unpublishTitle')).toBeInTheDocument();
    expect(unpublishMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'community.publish.unpublish' }));
    await waitFor(() => {
      expect(useMineStore.getState().items).toHaveLength(0);
    });
    expect(useBrowseStore.getState().items).toHaveLength(0);
    expect(unpublishMock).toHaveBeenCalledWith('abc123def456');
    expect(trackEvent).toHaveBeenCalledWith('community_unpublish');
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
      'community.toast.unpublished'
    );
    await waitFor(() => {
      expect(onUnpublished).toHaveBeenCalledWith('abc123def456');
    });
  });

  it('keeps the card and shows an error when the unpublish fails', async () => {
    useMineStore.setState({ items: [card()], status: 'ready' });
    unpublishMock.mockResolvedValue(err({ kind: 'server' }));
    renderCard();
    fireEvent.click(screen.getByTestId('community-mine-unpublish'));
    fireEvent.click(screen.getByRole('button', { name: 'community.publish.unpublish' }));
    await waitFor(() => {
      expect(screen.getByText('community.mine.unpublishFailed')).toBeInTheDocument();
    });
    expect(useMineStore.getState().items).toHaveLength(1);
  });

  it('maps a network unpublish failure to the offline copy', async () => {
    unpublishMock.mockResolvedValue(err({ kind: 'network' }));
    renderCard();
    fireEvent.click(screen.getByTestId('community-mine-unpublish'));
    fireEvent.click(screen.getByRole('button', { name: 'community.publish.unpublish' }));
    await waitFor(() => {
      expect(screen.getByText('community.publish.error.offline')).toBeInTheDocument();
    });
  });
});
