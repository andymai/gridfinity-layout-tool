import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LayoutThumbnail } from './LayoutThumbnail';
import type { LayoutPreview } from '@/core/types';

const emptyPreview: LayoutPreview = {
  drawerWidth: 4,
  drawerDepth: 3,
  binMap: [],
};

const previewWithBins: LayoutPreview = {
  drawerWidth: 4,
  drawerDepth: 3,
  binMap: [
    { x: 0, y: 0, w: 2, d: 1, c: '#4a90d9', l: 'Screws' },
    { x: 2, y: 0, w: 1, d: 1, c: '#e74c3c', l: '' },
  ],
};

describe('LayoutThumbnail', () => {
  it('renders an SVG element', () => {
    const { container } = render(<LayoutThumbnail preview={emptyPreview} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with specified size', () => {
    const { container } = render(<LayoutThumbnail preview={emptyPreview} size={100} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '100');
  });

  it('renders default size of 48', () => {
    const { container } = render(<LayoutThumbnail preview={emptyPreview} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '48');
  });

  it('is aria-hidden', () => {
    const { container } = render(<LayoutThumbnail preview={emptyPreview} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders grid lines for empty layout', () => {
    const { container } = render(<LayoutThumbnail preview={emptyPreview} />);
    // Empty layout shows grid lines
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders bin rectangles', () => {
    const { container } = render(<LayoutThumbnail preview={previewWithBins} />);
    // Background + inner + bins = at least 4 rects
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(4);
  });

  it('applies custom className', () => {
    const { container } = render(<LayoutThumbnail preview={emptyPreview} className="custom" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('custom');
  });

  it('renders grid lines when showLabels is true', () => {
    const { container } = render(
      <LayoutThumbnail preview={previewWithBins} showLabels size={200} />
    );
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
  });
});
