// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import { CommunityCard } from './CommunityCard';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

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

describe('CommunityCard', () => {
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

  it('is a native button per the design-system card convention', () => {
    render(<CommunityCard card={card()} onSelect={vi.fn()} index={0} />);
    const button = screen.getByRole('button');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
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
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(card());
  });
});
