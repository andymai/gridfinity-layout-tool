// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CommunityDesign } from '@/shared/types/community';
import type { BinParams } from '@/shared/types/bin';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('@/shared/components/GlbViewer', () => ({
  GlbViewer: ({ posterUrl }: { posterUrl: string }) => (
    <div data-testid="glb-viewer" data-poster={posterUrl} />
  ),
}));

vi.mock('@/shared/components/preview/GradientBackground', () => ({
  GradientBackground: () => null,
}));

import type { DesignImage } from '../../utils/designMedia';
import { FILMSTRIP_MAX_TILES } from '../../utils/designMedia';
import { DesignMediaPanel } from './DesignMediaPanel';

const params = { width: 2, depth: 3, height: 6 } as unknown as BinParams;

const DESIGN: CommunityDesign = {
  id: 'Abc123456789',
  authorPublicId: 'a'.repeat(32),
  authorName: 'Jo',
  name: 'Screw Bin',
  description: '',
  category: 'hardware',
  techniques: [],
  params,
  metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
  lineage: null,
  thumbnails: ['t0.webp', 't1.webp'],
  meshUrl: 'mesh.glb',
  photos: [],
  featured: false,
  createdAt: 0,
  updatedAt: 0,
  status: 'live',
};

const IMAGES: DesignImage[] = [
  { kind: 'render', url: 't0.webp', angle: 1 },
  { kind: 'render', url: 't1.webp', angle: 2 },
  { kind: 'photo', url: 'photo.webp', authorName: 'Ada', fitVerdict: 'as-designed', note: '' },
];

function renderPanel(images: readonly DesignImage[] = IMAGES, onOpenLightbox = vi.fn()) {
  render(
    <DesignMediaPanel
      design={DESIGN}
      images={images}
      isMobile={false}
      onOpenLightbox={onOpenLightbox}
    />
  );
  return onOpenLightbox;
}

describe('DesignMediaPanel', () => {
  it('leads with the 3D model, postered by the first render', () => {
    renderPanel();
    expect(screen.getByTestId('glb-viewer')).toHaveAttribute('data-poster', 't0.webp');
    expect(screen.getByTestId('design-media-tile-model')).toHaveAttribute('aria-pressed', 'true');
  });

  it('puts the model, the renders and the photos in one strip', () => {
    renderPanel();
    expect(screen.getByTestId('design-media-tile-model')).toBeInTheDocument();
    expect(screen.getByTestId('design-media-tile-0')).toBeInTheDocument();
    expect(screen.getByTestId('design-media-tile-2')).toBeInTheDocument();
  });

  it('swaps the hero to the picked image and back to the model', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('design-media-tile-2'));
    expect(screen.queryByTestId('glb-viewer')).not.toBeInTheDocument();
    expect(screen.getByTestId('design-media-hero')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('design-media-tile-model'));
    expect(screen.getByTestId('glb-viewer')).toBeInTheDocument();
  });

  it('enlarges the hero image on click', () => {
    const onOpenLightbox = renderPanel();

    fireEvent.click(screen.getByTestId('design-media-tile-1'));
    fireEvent.click(screen.getByTestId('design-media-hero'));

    expect(onOpenLightbox).toHaveBeenCalledWith(1);
  });

  it('does not offer an overflow tile while everything fits', () => {
    renderPanel();
    expect(screen.queryByTestId('design-media-tile-more')).not.toBeInTheDocument();
  });

  it('collapses the tail behind an overflow tile that opens the rest', () => {
    const many: DesignImage[] = Array.from({ length: 12 }, (_, index) => ({
      kind: 'render',
      url: `r${index}.webp`,
      angle: index + 1,
    }));
    const onOpenLightbox = renderPanel(many);

    const visible = FILMSTRIP_MAX_TILES - 1;
    expect(screen.getByTestId(`design-media-tile-${visible - 1}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`design-media-tile-${visible}`)).not.toBeInTheDocument();

    // Opens on the first image the strip could not show, so a capped strip
    // never makes an image unreachable.
    fireEvent.click(screen.getByTestId('design-media-tile-more'));
    expect(onOpenLightbox).toHaveBeenCalledWith(visible);
  });

  it('drops the strip entirely for a design with no imagery', () => {
    renderPanel([]);
    expect(screen.queryByTestId('design-media-filmstrip')).not.toBeInTheDocument();
    expect(screen.getByTestId('glb-viewer')).toBeInTheDocument();
  });
});
