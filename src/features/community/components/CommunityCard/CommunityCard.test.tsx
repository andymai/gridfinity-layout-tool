// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, createEvent, waitFor } from '@testing-library/react';
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
    // The title is the only link; the author stays plain text until the
    // author view is wired in, and never becomes a second navigation target.
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('2×3×6')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('community.card.likesLabel')).toBeInTheDocument();
    expect(screen.getByText('community.card.remixesLabel')).toBeInTheDocument();
  });

  it('exposes the card as a real link to the design, not a role=button container', () => {
    const { container } = render(<CommunityCard card={card()} onSelect={vi.fn()} index={0} />);
    const link = screen.getByRole('link', { name: 'Screw Sorter' });
    expect(link).toHaveAttribute('href', '/community/d/abc123def456');
    // The nested-interactive violation: a button may not contain focusable
    // descendants, and this card contains the heart (and optionally the
    // author). No ancestor of them may claim button semantics.
    expect(container.querySelector('[role="button"]')).toBeNull();
    expect(container.querySelector('[data-community-card]')).not.toHaveAttribute('tabindex');
  });

  it('opens in place on a plain click but leaves a modified click to the browser', () => {
    const onSelect = vi.fn();
    render(<CommunityCard card={card()} onSelect={onSelect} index={0} />);
    const link = screen.getByRole('link', { name: 'Screw Sorter' });

    // A new-tab click must navigate for real, so the handler neither
    // preventDefaults nor opens the in-place overlay.
    const modified = createEvent.click(link, { ctrlKey: true, bubbles: true, cancelable: true });
    fireEvent(link, modified);
    expect(onSelect).not.toHaveBeenCalled();
    expect(modified.defaultPrevented).toBe(false);

    const plain = createEvent.click(link, { bubbles: true, cancelable: true });
    fireEvent(link, plain);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(card());
    expect(plain.defaultPrevented).toBe(true);
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
    fireEvent.click(screen.getByRole('link', { name: 'Screw Sorter' }));
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

  describe('remix count', () => {
    it('is absent until somebody has remixed it', () => {
      // "0 remixes" was a glyph and a digit that said nothing on most cards,
      // and it was the piece pushing the stat row onto a second line.
      render(
        <CommunityCard
          card={card({ counts: { likes: 2, remixes: 0, exports: 0 } })}
          onSelect={vi.fn()}
          index={0}
        />
      );
      expect(screen.queryByText('community.card.remixesLabel')).toBeNull();
    });

    it('shows once there is one', () => {
      render(<CommunityCard card={card()} onSelect={vi.fn()} index={0} />);
      expect(screen.getByText('community.card.remixesLabel')).toBeInTheDocument();
    });

    it('keeps the like control at zero, being a control and not a statistic', () => {
      render(
        <CommunityCard
          card={card({ counts: { likes: 0, remixes: 0, exports: 0 } })}
          onSelect={vi.fn()}
          index={0}
        />
      );
      expect(screen.getByTestId('community-card-like')).toBeInTheDocument();
    });
  });

  describe('featured', () => {
    it('says nothing when the design is not featured', () => {
      render(<CommunityCard card={card()} onSelect={vi.fn()} index={0} />);
      expect(screen.queryByTestId('community-card-featured')).toBeNull();
    });

    it("states the curator's reason rather than a bare star", () => {
      render(
        <CommunityCard
          card={card({ featured: true, featureReason: 'clever' })}
          onSelect={vi.fn()}
          index={0}
        />
      );
      expect(screen.getByTestId('community-card-featured')).toHaveTextContent(
        'community.featured.reason.clever'
      );
    });

    it('shows no badge for a reason outside the known set', () => {
      render(
        <CommunityCard
          card={card({
            featured: true,
            featureReason: 'retired-reason' as unknown as 'clever',
          })}
          onSelect={vi.fn()}
          index={0}
        />
      );
      // A retired or corrupt value must not hand an undefined key to t().
      expect(screen.queryByTestId('community-card-featured')).toBeNull();
    });

    it('shows no badge for a pick made before reasons existed', () => {
      render(<CommunityCard card={card({ featured: true })} onSelect={vi.fn()} index={0} />);
      // Better silent than inventing a reason the curator never gave.
      expect(screen.queryByTestId('community-card-featured')).toBeNull();
    });
  });
});
