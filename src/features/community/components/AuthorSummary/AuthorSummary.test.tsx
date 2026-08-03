// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CommunityCard } from '@/shared/types/community';
import { AuthorSummary } from './AuthorSummary';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const AUTHOR = 'a'.repeat(32);

function card(overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id: 'abc123def456',
    name: 'Bin',
    authorName: 'Casey',
    authorPublicId: AUTHOR,
    category: 'tools',
    techniques: ['compartments'],
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    thumbnailUrl: '',
    isRemix: false,
    featured: false,
    counts: { likes: 0, remixes: 0, exports: 0 },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    status: 'live',
    ...overrides,
  };
}

function setup(items: CommunityCard[], indexCapped = false) {
  render(
    <AuthorSummary
      items={items}
      authorPublicId={AUTHOR}
      authorName="Casey"
      indexCapped={indexCapped}
    />
  );
}

describe('AuthorSummary', () => {
  it('renders nothing when the author has no loaded designs', () => {
    setup([card({ authorPublicId: 'b'.repeat(32) })]);
    expect(screen.queryByTestId('author-summary')).toBeNull();
  });

  it('shows the author name and their basic facts', () => {
    setup([card({ id: 'a' }), card({ id: 'b' })]);

    expect(screen.getByText('Casey')).toBeInTheDocument();
    const facts = screen.getByTestId('author-summary-facts');
    expect(facts).toHaveTextContent('community.author.designsOther');
    expect(facts).toHaveTextContent('community.author.since');
    expect(facts).toHaveTextContent('community.author.makes');
  });

  it('uses the singular for a single design', () => {
    setup([card()]);
    expect(screen.getByTestId('author-summary-facts')).toHaveTextContent(
      'community.author.designsOne'
    );
  });

  it('omits proof signals that are zero', () => {
    setup([card()]);
    // "Built on 0 times" says nothing while looking like a measurement.
    expect(screen.queryByTestId('author-summary-proof')).toBeNull();
  });

  it('shows prints and remixes once they are non-zero', () => {
    setup([card({ counts: { likes: 0, remixes: 2, exports: 0, prints: 5 } })]);

    const proof = screen.getByTestId('author-summary-proof');
    expect(proof).toHaveTextContent('community.author.printedOther');
    expect(proof).toHaveTextContent('community.author.remixedOther');
  });

  it('lists the techniques they reach for', () => {
    setup([card({ techniques: ['scoop', 'labelTab'] })]);
    expect(screen.getByTestId('author-summary-techniques').children.length).toBeGreaterThan(0);
  });

  it('admits when the loaded index may be missing older designs', () => {
    setup([card()], true);
    // An understated count that looks authoritative is worse than one that
    // states its own limits.
    expect(screen.getByTestId('author-summary-partial')).toBeInTheDocument();
  });

  it('stays quiet about limits when the index is complete', () => {
    setup([card()]);
    expect(screen.queryByTestId('author-summary-partial')).toBeNull();
  });
});
