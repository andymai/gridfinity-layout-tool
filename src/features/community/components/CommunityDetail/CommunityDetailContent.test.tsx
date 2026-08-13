import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CommunityDesign } from '@/shared/types/community';
import type { BinParams } from '@/shared/types/bin';
import { INITIAL_BROWSE_STATE, useBrowseStore } from '../../store/browseStore';
import { buildDesignImages } from '../../utils/designMedia';

vi.mock('@/shared/components/GlbViewer', () => ({
  GlbViewer: ({ loadBehavior, posterUrl }: { loadBehavior?: string; posterUrl: string }) => (
    <div data-testid="glb-viewer" data-load={loadBehavior ?? 'auto'} data-poster={posterUrl} />
  ),
}));

vi.mock('@/shared/components/preview/GradientBackground', () => ({
  GradientBackground: () => null,
}));

import { CommunityDetailContent } from './CommunityDetailContent';

const params = { width: 2, depth: 3, height: 6 } as unknown as BinParams;

function design(overrides: Partial<CommunityDesign> = {}): CommunityDesign {
  return {
    id: 'Abc123456789',
    authorPublicId: 'a'.repeat(32),
    authorName: 'Jo',
    name: 'Screw Bin',
    description: 'Line one\nLine two',
    category: 'hardware',
    techniques: ['scoop', 'labelTab'],
    params,
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    lineage: null,
    thumbnails: ['https://blob.example/t0.webp', 'https://blob.example/t1.webp'],
    meshUrl: 'https://blob.example/mesh.glb',
    photos: [],
    featured: false,
    createdAt: new Date('2026-06-01').getTime(),
    updatedAt: new Date('2026-06-01').getTime(),
    status: 'live',
    ...overrides,
  };
}

function renderContent(
  overrides: Partial<CommunityDesign> = {},
  props: Partial<Parameters<typeof CommunityDetailContent>[0]> = {}
) {
  const subject = design(overrides);
  return render(
    <CommunityDetailContent
      design={subject}
      counts={{ likes: 12, remixes: 4, exports: 9 }}
      isMobile={false}
      parentResolution={{ kind: 'snapshot' }}
      images={buildDesignImages(subject.thumbnails, [])}
      onOpenLightbox={vi.fn()}
      {...props}
    />
  );
}

describe('CommunityDetailContent', () => {
  beforeEach(() => {
    // Ready + fresh so the embedded similar rail never starts a real index
    // load; empty items keep the rail out of unrelated assertions.
    useBrowseStore.setState({
      ...INITIAL_BROWSE_STATE,
      status: 'ready',
      fetchedAt: Date.now(),
    });
  });

  it('renders author, category, techniques, dimensions, and license', () => {
    renderContent();
    expect(screen.getByText('by Jo')).toBeInTheDocument();
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Scoop')).toBeInTheDocument();
    expect(screen.getByText('Label tab')).toBeInTheDocument();
    expect(screen.getByText('2×3×6 grid units')).toBeInTheDocument();
    expect(screen.getByText('83.5×125.5×42 mm')).toBeInTheDocument();
    expect(screen.getByText('Published under the CC BY 4.0 license.')).toBeInTheDocument();
  });

  it('renders the description as plain text with line breaks preserved', () => {
    renderContent();
    const paragraph = screen.getByText((_, el) => el?.textContent === 'Line one\nLine two', {
      selector: 'p',
    });
    expect(paragraph).toHaveClass('whitespace-pre-line');
  });

  it('falls back when the description is empty', () => {
    renderContent({ description: '' });
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
  });

  it('shows read-only counts from the card', () => {
    renderContent();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('Likes')).toBeInTheDocument();
    expect(screen.getByText('Remixes')).toBeInTheDocument();
    // counts.exports is file downloads. Labelling it "Prints" put a hard 0
    // beside a design whose own print list was rendering below it.
    expect(screen.getByText('Downloads')).toBeInTheDocument();
  });

  it('reports prints separately, and only once someone has reported one', () => {
    renderContent({}, { counts: { likes: 12, remixes: 4, exports: 9, prints: 3 } });
    expect(screen.getByTestId('community-detail-prints-stat')).toHaveTextContent('3');
    expect(screen.getByText('Prints')).toBeInTheDocument();
  });

  it('omits the print stat when the count is absent', () => {
    // Absent means the card snapshot predates the field; an unknown count must
    // not read as a measured zero.
    renderContent({}, { counts: { likes: 12, remixes: 4, exports: 9 } });
    expect(screen.queryByTestId('community-detail-prints-stat')).not.toBeInTheDocument();
  });

  it('keeps a measured zero, which is a fact rather than an absence', () => {
    renderContent({}, { counts: { likes: 0, remixes: 0, exports: 0, prints: 0 } });
    expect(screen.getByTestId('community-detail-prints-stat')).toHaveTextContent('0');
    // Every tile stays put, so the row does not reflow when a design gets its
    // first like.
    expect(screen.getByTestId('community-detail-stats')).toHaveTextContent('Likes');
    expect(screen.getByTestId('community-detail-stats')).toHaveTextContent('Downloads');
  });

  it('hides the stats row without card counts', () => {
    renderContent({}, { counts: null });
    expect(screen.queryByText('Likes')).not.toBeInTheDocument();
  });

  it('auto-loads the viewer on desktop and tap-loads on mobile', () => {
    const { unmount } = renderContent();
    expect(screen.getByTestId('glb-viewer')).toHaveAttribute('data-load', 'auto');
    unmount();
    renderContent({}, { isMobile: true });
    expect(screen.getByTestId('glb-viewer')).toHaveAttribute('data-load', 'tap');
  });

  it('opens on the 3D model with the first render as its poster', () => {
    renderContent();
    expect(screen.getByTestId('glb-viewer')).toHaveAttribute(
      'data-poster',
      'https://blob.example/t0.webp'
    );
    expect(screen.getByTestId('design-media-tile-model')).toHaveAttribute('aria-pressed', 'true');
  });

  it('layers a filmstrip image over the viewer without tearing it down', () => {
    renderContent();
    const second = screen.getByLabelText('Show preview angle 2');
    expect(second).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(second);

    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('design-media-hero')).toBeInTheDocument();
    // Unmounting it would drop the tap-to-load flag and the orbit camera, so a
    // mobile visitor would be back at "Show 3D" after every photo.
    expect(screen.getByTestId('glb-viewer')).toBeInTheDocument();
  });

  it('enlarges the selected image through the hero', () => {
    const onOpenLightbox = vi.fn();
    renderContent({}, { onOpenLightbox });

    fireEvent.click(screen.getByLabelText('Show preview angle 2'));
    fireEvent.click(screen.getByTestId('design-media-hero'));

    expect(onOpenLightbox).toHaveBeenCalledWith(1);
  });

  it('renders the primary actions in the rail rather than the footer', () => {
    renderContent({}, { primaryActions: <button type="button">Remix</button> });
    expect(screen.getByTestId('community-detail-primary-actions')).toHaveTextContent('Remix');
  });

  it('renders the lineage snapshot with the root credit when deeper than one level', () => {
    renderContent({
      lineage: {
        parentId: 'Parent123456',
        rootId: 'Root12345678',
        parentName: 'Older Bin',
        parentAuthorName: 'Sam',
        rootAuthorName: 'Root Author',
      },
    });
    expect(screen.getByTestId('remix-lineage-parent')).toHaveTextContent('Older Bin');
    expect(screen.getByTestId('remix-lineage-root')).toHaveTextContent('Originally by Root Author');
    // Only parentId and rootId are stored, so the strip says so rather than
    // drawing a chain it cannot vouch for.
    expect(screen.getByTestId('remix-lineage-gap')).toBeInTheDocument();
  });

  it('upgrades the lineage line to the live parent name', () => {
    renderContent(
      {
        lineage: {
          parentId: 'Parent123456',
          rootId: 'Parent123456',
          parentName: 'Old Snapshot Name',
          parentAuthorName: 'Sam',
          rootAuthorName: 'Sam',
        },
      },
      { parentResolution: { kind: 'live', name: 'Renamed Parent', authorName: 'Samuel' } }
    );
    const parent = screen.getByTestId('remix-lineage-parent');
    expect(parent).toHaveTextContent('Renamed Parent');
    expect(parent).toHaveTextContent('Samuel');
  });

  it('marks the parent as no longer published when it is gone', () => {
    renderContent(
      {
        lineage: {
          parentId: 'Parent123456',
          rootId: 'Parent123456',
          parentName: 'Older Bin',
          parentAuthorName: 'Sam',
          rootAuthorName: 'Sam',
        },
      },
      { parentResolution: { kind: 'gone' } }
    );
    expect(screen.getByTestId('remix-lineage-parent')).toHaveTextContent('No longer available');
  });

  it('renders the updated date only when later than the published date', () => {
    const created = new Date('2026-06-01').getTime();
    renderContent({ createdAt: created, updatedAt: created + 86_400_000 });
    expect(screen.getByText(/Published .*2026/)).toBeInTheDocument();
    expect(screen.getByText(/Updated .*2026/)).toBeInTheDocument();
  });

  it('renders the author as a labeled button when the author view is wired', () => {
    const onFilterByAuthor = vi.fn();
    renderContent({}, { onFilterByAuthor });
    const author = screen.getByTestId('community-detail-author');
    expect(author.tagName).toBe('BUTTON');
    expect(author).toHaveAccessibleName('See all designs by Jo');
    fireEvent.click(author);
    expect(onFilterByAuthor).toHaveBeenCalledTimes(1);
  });

  it('keeps the author as plain text when no author view is wired', () => {
    renderContent();
    expect(screen.queryByTestId('community-detail-author')).not.toBeInTheDocument();
    expect(screen.getByText('by Jo')).toBeInTheDocument();
  });

  it('opens the direct-remix list from the remix count', () => {
    useBrowseStore.setState({
      status: 'ready',
      fetchedAt: Date.now(),
      items: [
        {
          id: 'Remix1234567',
          name: 'Remixed Bin',
          authorName: 'Sam',
          authorPublicId: 'b'.repeat(32),
          category: 'kitchen',
          techniques: [],
          metrics: { width: 420, depth: 420, height: 42, gridUnitMm: 42 },
          thumbnailUrl: 'https://blob.example/remix.webp',
          isRemix: true,
          parentId: 'Abc123456789',
          featured: false,
          counts: { likes: 0, remixes: 0, exports: 0 },
          createdAt: 1000,
          updatedAt: 1000,
          status: 'live',
        },
      ],
    });
    renderContent();
    const remixes = screen.getByTestId('community-detail-remixes');
    expect(remixes).toHaveAccessibleName('4 designs build on this');
    expect(remixes).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('community-remix-list')).not.toBeInTheDocument();
    fireEvent.click(remixes);
    expect(remixes).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('community-remix-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('community-remix-tile')).toHaveLength(1);
    expect(screen.getByText('Remixed Bin')).toBeInTheDocument();
  });

  it('explains when the counted remixes are not in the loaded index', () => {
    renderContent();
    fireEvent.click(screen.getByTestId('community-detail-remixes'));
    expect(
      screen.getByText('The designs that build on this are not in the loaded gallery.')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('community-remix-tile')).not.toBeInTheDocument();
  });

  it('keeps the remix count as plain text at zero', () => {
    renderContent({}, { counts: { likes: 12, remixes: 0, exports: 9 } });
    expect(screen.queryByTestId('community-detail-remixes')).not.toBeInTheDocument();
    expect(screen.getByText('Remixes')).toBeInTheDocument();
  });

  it('embeds the similar rail between lineage and license when the index holds matches', () => {
    useBrowseStore.setState({
      status: 'ready',
      fetchedAt: Date.now(),
      items: [
        {
          id: 'Other1234567',
          name: 'Other Bin',
          authorName: 'Sam',
          authorPublicId: 'b'.repeat(32),
          category: 'hardware',
          techniques: ['scoop'],
          metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
          thumbnailUrl: 'https://blob.example/other.webp',
          isRemix: false,
          featured: false,
          counts: { likes: 0, remixes: 0, exports: 0 },
          createdAt: 1000,
          updatedAt: 1000,
          status: 'live',
        },
      ],
    });
    renderContent();
    expect(screen.getByTestId('community-similar-rail')).toBeInTheDocument();
    expect(screen.getByText('Other Bin')).toBeInTheDocument();
  });
});

describe('CommunityDetailContent owner hidden-state notice', () => {
  it('renders nothing moderation-related without ownerModeration', () => {
    renderContent({ status: 'hidden' });
    expect(screen.queryByTestId('community-detail-hidden-notice')).not.toBeInTheDocument();
  });

  it('explains a report hide with the dominant reason category', () => {
    renderContent(
      { status: 'hidden' },
      { ownerModeration: { hiddenReason: 'reports', hiddenReasonCategory: 'spam' } }
    );
    expect(screen.getByTestId('community-detail-hidden-notice')).toBeInTheDocument();
    expect(screen.getByTestId('community-hidden-badge')).toHaveTextContent('Hidden after reports');
    expect(
      screen.getByText(
        'This design was hidden after reports (Spam) and is no longer publicly visible.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('A moderator will review it.')).toBeInTheDocument();
  });

  it('falls back to the reasonless explanation when nothing was tallied', () => {
    renderContent(
      { status: 'hidden' },
      { ownerModeration: { hiddenReason: null, hiddenReasonCategory: null } }
    );
    expect(screen.getByTestId('community-hidden-badge')).toBeInTheDocument();
    expect(
      screen.getByText('This design was hidden after reports and is no longer publicly visible.')
    ).toBeInTheDocument();
  });

  it('explains a manual moderation hide without promising a future review', () => {
    renderContent(
      { status: 'hidden' },
      { ownerModeration: { hiddenReason: 'moderation', hiddenReasonCategory: null } }
    );
    expect(screen.getByTestId('community-moderation-badge')).toHaveTextContent(
      'Hidden by moderation'
    );
    expect(
      screen.getByText('This design was hidden by the moderation team and is not publicly visible.')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('community-hidden-badge')).not.toBeInTheDocument();
    expect(screen.queryByText('A moderator will review it.')).not.toBeInTheDocument();
  });

  it('marks a deny-list hide distinctly, without the moderator review note', () => {
    renderContent(
      { status: 'hidden' },
      { ownerModeration: { hiddenReason: 'denylist', hiddenReasonCategory: null } }
    );
    expect(screen.getByTestId('community-denylisted-badge')).toHaveTextContent(
      'Publishing restricted'
    );
    expect(
      screen.getByText('This design is hidden. Publishing is not available for this account.')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('community-hidden-badge')).not.toBeInTheDocument();
    expect(screen.queryByText('A moderator will review it.')).not.toBeInTheDocument();
  });
});
