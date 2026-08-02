import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CommunityDesign } from '@/shared/types/community';
import type { BinParams } from '@/shared/types/bin';

vi.mock('@/shared/components/GlbViewer', () => ({
  GlbViewer: ({
    loadBehavior,
    posterUrl,
    onModelReady,
  }: {
    loadBehavior?: string;
    posterUrl: string;
    onModelReady?: () => void;
  }) => (
    <div data-testid="glb-viewer" data-load={loadBehavior ?? 'auto'} data-poster={posterUrl}>
      <button type="button" data-testid="mock-model-ready" onClick={onModelReady} />
    </div>
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
  return render(
    <CommunityDetailContent
      design={design(overrides)}
      counts={{ likes: 12, remixes: 4, exports: 9 }}
      isMobile={false}
      parentResolution={{ kind: 'snapshot' }}
      {...props}
    />
  );
}

describe('CommunityDetailContent', () => {
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
    expect(screen.getByText('Prints')).toBeInTheDocument();
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

  it('switches the poster through the thumbnail angle strip', () => {
    renderContent();
    expect(screen.getByTestId('glb-viewer')).toHaveAttribute(
      'data-poster',
      'https://blob.example/t0.webp'
    );
    const second = screen.getByLabelText('Show preview angle 2');
    expect(second).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('glb-viewer')).toHaveAttribute(
      'data-poster',
      'https://blob.example/t1.webp'
    );
  });

  it('hides the angle strip once the model is live', () => {
    renderContent();
    expect(screen.getByLabelText('Show preview angle 2')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mock-model-ready'));
    expect(screen.queryByLabelText('Show preview angle 2')).not.toBeInTheDocument();
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
    expect(screen.getByText(/Remixed from Older Bin by Sam/)).toBeInTheDocument();
    expect(screen.getByText(/originally by Root Author/)).toBeInTheDocument();
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
    expect(screen.getByText(/Remixed from Renamed Parent by Samuel/)).toBeInTheDocument();
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
    expect(screen.getByText(/no longer published/)).toBeInTheDocument();
  });

  it('renders the updated date only when later than the published date', () => {
    const created = new Date('2026-06-01').getTime();
    renderContent({ createdAt: created, updatedAt: created + 86_400_000 });
    expect(screen.getByText(/Published .*2026/)).toBeInTheDocument();
    expect(screen.getByText(/Updated .*2026/)).toBeInTheDocument();
  });
});
