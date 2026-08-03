// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ok } from '@/core/result';
import { useSessionStore } from '@/core/sync/session/useSession';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import { loadPendingLikeAction } from '@/shared/utils/communityPendingLikeAction';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { CommunityCard } from './CommunityCard';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('../../api/client', () => ({
  setDesignLiked: vi.fn(),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

// Hash URLs keep jsdom quiet on the sign-in redirect.
vi.mock('@/core/sync/session/sessionApi', () => ({
  signInUrl: (provider: string) => `#signin-${provider}`,
}));

import { setDesignLiked } from '../../api/client';

const likeMock = vi.mocked(setDesignLiked);

function card(overrides: Partial<CommunityCardData> = {}): CommunityCardData {
  return {
    id: 'abc123def456',
    name: 'Screw Sorter',
    authorName: 'Alice',
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

function heartButton(): HTMLElement {
  return screen.getByTestId('community-card-like');
}

describe('CommunityCard', () => {
  beforeEach(() => {
    likeMock.mockReset();
    sessionStorage.clear();
    window.location.hash = '';
    useBrowseStore.setState({ ...INITIAL_BROWSE_STATE, items: [card()] });
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
  });

  it('renders name, author as plain text, and a dims-first footer with counts', () => {
    render(<CommunityCard card={card()} onSelect={vi.fn()} index={0} />);
    expect(screen.getByText('Screw Sorter')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('community.card.byAuthor')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('2×3×6')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('community.card.likesLabel')).toBeInTheDocument();
    expect(screen.getByText('community.card.remixesLabel')).toBeInTheDocument();
  });

  it('keeps a keyboard-activatable card surface despite the nested heart button', () => {
    const onSelect = vi.fn();
    render(<CommunityCard card={card()} onSelect={onSelect} index={0} />);
    const surface = screen.getByRole('button', { name: 'Screw Sorter' });
    expect(surface.tagName).not.toBe('BUTTON');
    expect(surface).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(surface, { key: 'Enter' });
    fireEvent.keyDown(surface, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('shows the corner remix glyph only for remixes', () => {
    const { rerender } = render(
      <CommunityCard card={card({ isRemix: true })} onSelect={vi.fn()} index={0} />
    );
    expect(screen.getByTestId('community-card-remix-glyph')).toBeInTheDocument();
    rerender(<CommunityCard card={card({ isRemix: false })} onSelect={vi.fn()} index={0} />);
    expect(screen.queryByTestId('community-card-remix-glyph')).not.toBeInTheDocument();
  });

  it('lazy-loads the thumbnail and hides the placeholder once loaded', () => {
    const { container } = render(<CommunityCard card={card()} onSelect={vi.fn()} index={0} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(screen.getByTestId('community-card-placeholder')).toBeInTheDocument();
    if (img === null) throw new Error('missing thumbnail img');
    fireEvent.load(img);
    expect(screen.queryByTestId('community-card-placeholder')).not.toBeInTheDocument();
  });

  it('keeps the neutral placeholder when the thumbnail fails or is missing', () => {
    const { container } = render(
      <CommunityCard card={card({ thumbnailUrl: '' })} onSelect={vi.fn()} index={0} />
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('community-card-placeholder')).toBeInTheDocument();
  });

  it('calls onSelect with the card on click', () => {
    const onSelect = vi.fn();
    render(<CommunityCard card={card()} onSelect={onSelect} index={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Screw Sorter' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(card());
  });

  it('renders the author as a real button with an aria-label when the author view is wired', () => {
    render(<CommunityCard card={card()} onSelect={vi.fn()} onSelectAuthor={vi.fn()} index={0} />);
    const author = screen.getByTestId('community-card-author');
    expect(author.tagName).toBe('BUTTON');
    expect(author).toHaveAccessibleName('community.authorFilterAria');
  });

  it('author tap fires onSelectAuthor without also opening the detail view', () => {
    const onSelect = vi.fn();
    const onSelectAuthor = vi.fn();
    render(
      <CommunityCard card={card()} onSelect={onSelect} onSelectAuthor={onSelectAuthor} index={0} />
    );
    fireEvent.click(screen.getByTestId('community-card-author'));
    expect(onSelectAuthor).toHaveBeenCalledTimes(1);
    expect(onSelectAuthor).toHaveBeenCalledWith(card());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the author as plain text when no author view is wired', () => {
    render(<CommunityCard card={card()} onSelect={vi.fn()} index={0} />);
    expect(screen.queryByTestId('community-card-author')).not.toBeInTheDocument();
    expect(screen.getByText('community.card.byAuthor')).toBeInTheDocument();
  });

  it('exposes like state via aria-pressed and a filled heart', () => {
    const { rerender } = render(
      <CommunityCard card={card({ likedByMe: false })} onSelect={vi.fn()} index={0} />
    );
    expect(heartButton()).toHaveAttribute('aria-pressed', 'false');
    expect(heartButton()).toHaveAccessibleName('community.like.like');
    rerender(<CommunityCard card={card({ likedByMe: true })} onSelect={vi.fn()} index={0} />);
    expect(heartButton()).toHaveAttribute('aria-pressed', 'true');
    expect(heartButton()).toHaveAccessibleName('community.like.unlike');
  });

  it('toggles the like without also opening the detail view', async () => {
    likeMock.mockResolvedValue(ok({ likes: 13, likedByMe: true }));
    const onSelect = vi.fn();
    render(<CommunityCard card={card()} onSelect={onSelect} index={0} />);

    fireEvent.click(heartButton());

    await waitFor(() => {
      expect(likeMock).toHaveBeenCalledWith('abc123def456', true);
    });
    expect(onSelect).not.toHaveBeenCalled();
    const patched = useBrowseStore.getState().items[0];
    expect(patched.likedByMe).toBe(true);
    expect(patched.counts.likes).toBe(13);
  });

  it('opens the sign-in prompt on a signed-out tap and stashes the pending like on provider choice', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    render(<CommunityCard card={card()} onSelect={vi.fn()} index={0} />);

    fireEvent.click(heartButton());

    expect(await screen.findByText('community.signin.likeMessage')).toBeInTheDocument();
    expect(likeMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'auth.signInWithGoogle' }));
    const pending = loadPendingLikeAction();
    expect(pending?.designId).toBe('abc123def456');
    expect(pending?.liked).toBe(true);
    expect(window.location.hash).toBe('#signin-google');
  });

  describe('print count', () => {
    it('is absent until somebody has printed it', () => {
      render(<CommunityCard card={card()} onSelect={vi.fn()} index={0} />);
      expect(screen.queryByTestId('community-card-prints')).toBeNull();
    });

    it('shows the distinct-printer count once there is one', () => {
      render(
        <CommunityCard
          card={card({ counts: { likes: 2, remixes: 1, exports: 5, prints: 7 } })}
          onSelect={vi.fn()}
          index={0}
        />
      );
      const prints = screen.getByTestId('community-card-prints');
      expect(prints).toHaveTextContent('7');
      expect(prints).toHaveTextContent('community.card.printsLabel');
    });
  });
});
