// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGapFitStore } from '@/core/store/gapFit';
import { gridUnits, heightUnits, layerId } from '@/core/types';
import type { Mm } from '@/core/types';
import { DesignGalleryModal } from './DesignGalleryModal';

vi.mock('@/features/bin-designer/components/ExampleGallery', () => ({
  ExampleGalleryContent: ({ onRequestClose }: { onRequestClose: () => void }) => (
    <button type="button" data-testid="examples-content" onClick={onRequestClose}>
      examples
    </button>
  ),
}));

vi.mock('@/features/community/components/CommunityGalleryTab', () => ({
  CommunityGalleryTab: () => <div data-testid="community-content" />,
}));

function setGapConstraint(): void {
  useGapFitStore.getState().setConstraint({
    maxWidth: gridUnits(2),
    maxDepth: gridUnits(2),
    maxHeight: heightUnits(6),
    gridUnitMm: 42 as Mm,
    gridUnitMmY: 42 as Mm,
    heightUnitMm: 7 as Mm,
    targetPosition: { x: gridUnits(0), y: gridUnits(0), layerId: layerId('layer_1') },
  });
}

describe('DesignGalleryModal', () => {
  beforeEach(() => {
    localStorage.clear();
    useGapFitStore.setState({ constraint: null });
  });

  it('titles itself Community Designs', async () => {
    render(<DesignGalleryModal onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Community designs');
  });

  it('gives its title the same bordered spacing every other modal has', async () => {
    render(<DesignGalleryModal onClose={vi.fn()} />);

    // Without the border variant the header collapses to pb-2, half of what
    // every other dialog title gets.
    expect(
      screen.getByRole('heading', { level: 2 }).parentElement?.parentElement?.className
    ).toContain('border-b');
  });

  it('shows the tab bar defaulting to Examples with the new dot', async () => {
    render(<DesignGalleryModal onClose={vi.fn()} />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Examples' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Community/ })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(screen.getByTestId('community-new-dot')).toBeInTheDocument();
    expect(await screen.findByTestId('examples-content')).toBeInTheDocument();
  });

  it('switching to Community renders its panel and clears the new dot', async () => {
    render(<DesignGalleryModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: /^Community/ }));

    expect(await screen.findByTestId('community-content')).toBeInTheDocument();
    expect(screen.queryByTestId('examples-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('community-new-dot')).not.toBeInTheDocument();

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'gallery-tab-community');
    expect(localStorage.getItem('gridfinity-design-gallery-tab-v1')).toBe('community');
  });

  it('restores the last-used tab from localStorage', async () => {
    localStorage.setItem('gridfinity-design-gallery-tab-v1', 'community');
    render(<DesignGalleryModal onClose={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /^Community/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(await screen.findByTestId('community-content')).toBeInTheDocument();
  });

  it('a fits-gap open lands on the Community tab despite a stored examples tab', async () => {
    localStorage.setItem('gridfinity-design-gallery-tab-v1', 'examples');
    setGapConstraint();
    render(<DesignGalleryModal onClose={vi.fn()} />);

    expect(await screen.findByTestId('community-content')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Community/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('closing the gallery clears the fits-gap handoff', async () => {
    setGapConstraint();
    const onClose = vi.fn();
    render(<DesignGalleryModal onClose={onClose} />);
    await screen.findByTestId('community-content');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useGapFitStore.getState().constraint).toBeNull();
  });

  it('the header close button and Escape both call onClose', async () => {
    const onClose = vi.fn();
    render(<DesignGalleryModal onClose={onClose} />);
    await screen.findByTestId('examples-content');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('tab content can close the whole modal via onRequestClose', async () => {
    const onClose = vi.fn();
    render(<DesignGalleryModal onClose={onClose} />);

    fireEvent.click(await screen.findByTestId('examples-content'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
