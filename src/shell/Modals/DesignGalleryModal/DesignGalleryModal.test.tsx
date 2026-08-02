// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLabsStore } from '@/core/store';
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

function setCommunityFlag(enabled: boolean): void {
  useLabsStore.setState((s) => ({
    preferences: {
      ...s.preferences,
      enabledFeatures: { ...s.preferences.enabledFeatures, community_showcase: enabled },
    },
  }));
}

describe('DesignGalleryModal', () => {
  beforeEach(() => {
    localStorage.clear();
    setCommunityFlag(false);
  });

  it('flag off: renders the dialog with examples content and no tab bar', async () => {
    render(<DesignGalleryModal onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByTestId('examples-content')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Community' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('community-content')).not.toBeInTheDocument();
  });

  it('flag off: ignores a stored community tab and shows examples', async () => {
    localStorage.setItem('gridfinity-design-gallery-tab-v1', 'community');
    render(<DesignGalleryModal onClose={vi.fn()} />);

    expect(await screen.findByTestId('examples-content')).toBeInTheDocument();
    expect(screen.queryByTestId('community-content')).not.toBeInTheDocument();
  });

  it('flag on: shows the tab bar defaulting to Examples with the new dot', async () => {
    setCommunityFlag(true);
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

  it('flag on: switching to Community renders its panel and clears the new dot', async () => {
    setCommunityFlag(true);
    render(<DesignGalleryModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: /^Community/ }));

    expect(await screen.findByTestId('community-content')).toBeInTheDocument();
    expect(screen.queryByTestId('examples-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('community-new-dot')).not.toBeInTheDocument();

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'gallery-tab-community');
    expect(localStorage.getItem('gridfinity-design-gallery-tab-v1')).toBe('community');
  });

  it('flag on: restores the last-used tab from localStorage', async () => {
    setCommunityFlag(true);
    localStorage.setItem('gridfinity-design-gallery-tab-v1', 'community');
    render(<DesignGalleryModal onClose={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /^Community/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(await screen.findByTestId('community-content')).toBeInTheDocument();
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
