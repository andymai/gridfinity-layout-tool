// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DesignImage } from '../../utils/designMedia';
import { MediaLightbox } from './MediaLightbox';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const RENDER_A: DesignImage = {
  kind: 'render',
  url: 'render-a.webp',
  thumbUrl: 'render-a.webp',
  angle: 1,
};
const RENDER_B: DesignImage = {
  kind: 'render',
  url: 'render-b.webp',
  thumbUrl: 'render-b.webp',
  angle: 2,
};
const PHOTO: DesignImage = {
  kind: 'photo',
  url: 'photo.webp',
  thumbUrl: 'photo.webp',
  authorName: 'Ada',
  fitVerdict: 'adjusted',
  note: 'Scaled to 101%.',
};

const IMAGES = [RENDER_A, RENDER_B, PHOTO];

function renderLightbox(startIndex = 0, onClose = vi.fn()) {
  render(
    <MediaLightbox
      images={IMAGES}
      startIndex={startIndex}
      designName="Socket tray"
      onClose={onClose}
    />
  );
  return onClose;
}

function currentSrc(): string | null {
  return screen.getByTestId('lightbox-image').getAttribute('src');
}

describe('MediaLightbox', () => {
  it('opens on the image the gesture pointed at', () => {
    renderLightbox(2);
    expect(currentSrc()).toBe('photo.webp');
  });

  it('steps forward and back through the whole sequence', () => {
    renderLightbox(0);

    fireEvent.click(screen.getByTestId('lightbox-next'));
    expect(currentSrc()).toBe('render-b.webp');

    fireEvent.click(screen.getByTestId('lightbox-previous'));
    expect(currentSrc()).toBe('render-a.webp');
  });

  it('wraps at both ends rather than dead-ending', () => {
    renderLightbox(0);

    fireEvent.click(screen.getByTestId('lightbox-previous'));
    expect(currentSrc()).toBe('photo.webp');

    fireEvent.click(screen.getByTestId('lightbox-next'));
    expect(currentSrc()).toBe('render-a.webp');
  });

  it('navigates with the arrow keys', () => {
    renderLightbox(0);

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(currentSrc()).toBe('render-b.webp');

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(currentSrc()).toBe('render-a.webp');
  });

  it('navigates on a swipe past the threshold', () => {
    renderLightbox(0);
    const stage = screen.getByTestId('lightbox-stage');

    fireEvent.touchStart(stage, { changedTouches: [{ clientX: 200 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 100 }] });
    expect(currentSrc()).toBe('render-b.webp');
  });

  it('ignores a drift too small to be a swipe', () => {
    renderLightbox(0);
    const stage = screen.getByTestId('lightbox-stage');

    fireEvent.touchStart(stage, { changedTouches: [{ clientX: 200 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 190 }] });
    expect(currentSrc()).toBe('render-a.webp');
  });

  it('shows the position in the sequence', () => {
    renderLightbox(1);
    expect(screen.getByTestId('lightbox-counter')).toBeInTheDocument();
  });

  it('drops the navigation affordances for a lone image', () => {
    render(
      <MediaLightbox
        images={[RENDER_A]}
        startIndex={0}
        designName="Socket tray"
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByTestId('lightbox-next')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lightbox-previous')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lightbox-counter')).not.toBeInTheDocument();
  });

  it('captions a photo with its printer, verdict and note', () => {
    renderLightbox(2);
    const caption = screen.getByTestId('lightbox-caption');

    expect(caption).toHaveTextContent('community.media.photoBy');
    // The verdict travels with the photo: it is what decides whether you print
    // the thing, so an enlarged photo without it is decoration.
    expect(caption).toHaveTextContent('community.print.fit.adjusted');
    expect(caption).toHaveTextContent('Scaled to 101%.');
  });

  it('captions a render with its angle instead of an attribution', () => {
    renderLightbox(0);
    const caption = screen.getByTestId('lightbox-caption');

    expect(caption).toHaveTextContent('community.media.renderCaption');
    expect(caption).not.toHaveTextContent('community.media.photoBy');
  });

  it('renders nothing when the start index falls outside the sequence', () => {
    render(<MediaLightbox images={[]} startIndex={0} designName="Socket tray" onClose={vi.fn()} />);
    expect(screen.queryByTestId('lightbox-image')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = renderLightbox(0);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
