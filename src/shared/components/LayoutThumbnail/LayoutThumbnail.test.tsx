import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LayoutThumbnail } from './LayoutThumbnail';
import type { LayoutPreview } from '@/core/types';
import { gridUnits, heightUnits } from '@/core/types';

const emptyPreview: LayoutPreview = {
  drawerWidth: gridUnits(4),
  drawerDepth: gridUnits(3),
  drawerHeight: heightUnits(5),
  binCount: 0,
  layerCount: 1,
  binMap: [],
};

const previewWithBins: LayoutPreview = {
  drawerWidth: gridUnits(4),
  drawerDepth: gridUnits(3),
  drawerHeight: heightUnits(5),
  binCount: 2,
  layerCount: 1,
  binMap: [
    {
      x: gridUnits(0),
      y: gridUnits(0),
      w: gridUnits(2),
      d: gridUnits(1),
      c: '#4a90d9',
      l: 'Screws',
    },
    { x: gridUnits(2), y: gridUnits(0), w: gridUnits(1), d: gridUnits(1), c: '#e74c3c', l: '' },
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

  describe('responsive mode', () => {
    it('fills the container instead of using fixed dimensions', () => {
      const { container } = render(<LayoutThumbnail preview={previewWithBins} responsive />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '100%');
      expect(svg).toHaveAttribute('height', '100%');
      expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    });

    it('keeps a viewBox derived from the internal render size', () => {
      const { container } = render(<LayoutThumbnail preview={previewWithBins} responsive />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 200 150');
    });
  });

  describe('labels', () => {
    it('renders label text for bins with labels when space permits', () => {
      const { container } = render(
        <LayoutThumbnail preview={previewWithBins} showLabels responsive />
      );
      const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
      expect(texts).toContain('Screws');
    });

    it('does not render labels for unlabeled bins', () => {
      const { container } = render(
        <LayoutThumbnail preview={previewWithBins} showLabels responsive />
      );
      expect(container.querySelectorAll('text')).toHaveLength(1);
    });

    it('does not render labels below the minimum bin size', () => {
      const { container } = render(
        <LayoutThumbnail preview={previewWithBins} showLabels size={40} />
      );
      expect(container.querySelectorAll('text')).toHaveLength(0);
    });

    it('rotates text for bins significantly taller than wide', () => {
      const tallPreview: LayoutPreview = {
        ...previewWithBins,
        binMap: [
          {
            x: gridUnits(0),
            y: gridUnits(0),
            w: gridUnits(1),
            d: gridUnits(3),
            c: '#4a90d9',
            l: 'Tall',
          },
        ],
      };
      const { container } = render(<LayoutThumbnail preview={tallPreview} showLabels responsive />);
      const text = container.querySelector('text');
      expect(text?.getAttribute('transform')).toMatch(/^rotate\(-90/);
    });

    it('uses the theme contrast color for label text', () => {
      const { container } = render(
        <LayoutThumbnail preview={previewWithBins} showLabels responsive />
      );
      const text = container.querySelector('text');
      // #4a90d9 has luminance just above 0.5: dark text on a light fill
      expect(text?.getAttribute('fill')).toBe('var(--text-on-light)');
    });
  });
});
