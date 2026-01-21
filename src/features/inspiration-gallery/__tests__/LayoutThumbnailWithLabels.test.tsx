import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LayoutThumbnailWithLabels } from '../components/LayoutThumbnailWithLabels';
import type { Layout, Bin } from '@/core/types';

/**
 * Helper to create a minimal valid Layout for testing.
 */
function createTestLayout(overrides: Partial<Layout> = {}): Layout {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: {
      width: 10,
      depth: 8,
      height: 12,
    },
    layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
    categories: [{ id: 'cat-1', name: 'General', color: '#6b7280' }],
    bins: [],
    gridUnitMm: 42,
    heightUnitMm: 7,
    printBedSize: 256,
    ...overrides,
  };
}

/**
 * Helper to create a test bin.
 */
function createTestBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'bin-1',
    x: 0,
    y: 0,
    width: 2,
    depth: 2,
    height: 3,
    layerId: 'layer-1',
    category: 'cat-1',
    label: '',
    notes: '',
    ...overrides,
  };
}

describe('LayoutThumbnailWithLabels', () => {
  describe('rendering', () => {
    it('renders an SVG element', () => {
      const layout = createTestLayout();
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('has aria-hidden for accessibility', () => {
      const layout = createTestLayout();
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('uses fixed dimensions by default', () => {
      const layout = createTestLayout();
      const { container } = render(
        <LayoutThumbnailWithLabels layout={layout} size={200} />
      );

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '200');
    });

    it('uses responsive sizing when responsive prop is true', () => {
      const layout = createTestLayout();
      const { container } = render(
        <LayoutThumbnailWithLabels layout={layout} responsive />
      );

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '100%');
      expect(svg).toHaveAttribute('height', '100%');
      expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    });

    it('applies className prop', () => {
      const layout = createTestLayout();
      const { container } = render(
        <LayoutThumbnailWithLabels layout={layout} className="custom-class" />
      );

      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('custom-class');
    });

    it('renders drawer background rect', () => {
      const layout = createTestLayout();
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBeGreaterThanOrEqual(2); // Background + inner area
    });

    it('renders grid lines', () => {
      const layout = createTestLayout({
        drawer: { width: 5, depth: 4, height: 12 },
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const lines = container.querySelectorAll('line');
      // Should have (width-1) vertical + (depth-1) horizontal lines
      expect(lines.length).toBe(4 + 3); // 4 vertical, 3 horizontal
    });
  });

  describe('bin rendering', () => {
    it('renders bin rectangles', () => {
      const layout = createTestLayout({
        bins: [createTestBin({ id: 'b1', x: 0, y: 0, width: 2, depth: 2 })],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      // Should have: drawer bg + inner area + bin rect = 3 rects
      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBe(3);
    });

    it('renders multiple bins', () => {
      const layout = createTestLayout({
        bins: [
          createTestBin({ id: 'b1', x: 0, y: 0 }),
          createTestBin({ id: 'b2', x: 2, y: 0 }),
          createTestBin({ id: 'b3', x: 4, y: 0 }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBe(5); // 2 background + 3 bins
    });

    it('applies category color to bins', () => {
      const layout = createTestLayout({
        categories: [{ id: 'tools', name: 'Tools', color: '#ff0000' }],
        bins: [createTestBin({ id: 'b1', category: 'tools' })],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const rects = container.querySelectorAll('rect');
      const binRect = rects[rects.length - 1]; // Last rect is the bin
      expect(binRect).toHaveAttribute('fill', '#ff0000');
    });

    it('uses fallback color for unknown category', () => {
      const layout = createTestLayout({
        categories: [{ id: 'known', name: 'Known', color: '#ff0000' }],
        bins: [createTestBin({ id: 'b1', category: 'unknown' })],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const rects = container.querySelectorAll('rect');
      const binRect = rects[rects.length - 1];
      expect(binRect).toHaveAttribute('fill', '#94a3b8'); // fallback color
    });
  });

  describe('staging bin filtering', () => {
    it('excludes bins in staging area', () => {
      const layout = createTestLayout({
        bins: [
          createTestBin({ id: 'b1', layerId: 'layer-1' }),
          createTestBin({ id: 'b2', layerId: '__staging__' }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      // Should only render 1 bin (not the staging one)
      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBe(3); // 2 background + 1 bin
    });

    it('renders no bins when all are in staging', () => {
      const layout = createTestLayout({
        bins: [
          createTestBin({ id: 'b1', layerId: '__staging__' }),
          createTestBin({ id: 'b2', layerId: '__staging__' }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBe(2); // Just background rects
    });
  });

  describe('label rendering', () => {
    it('renders label text for bins with labels', () => {
      const layout = createTestLayout({
        bins: [
          createTestBin({
            id: 'b1',
            width: 4, // Large enough to show label
            depth: 4,
            label: 'Screws',
          }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const texts = container.querySelectorAll('text');
      expect(texts.length).toBe(1);
    });

    it('does not render label for empty label string', () => {
      const layout = createTestLayout({
        bins: [
          createTestBin({
            id: 'b1',
            width: 4,
            depth: 4,
            label: '',
          }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const texts = container.querySelectorAll('text');
      expect(texts.length).toBe(0);
    });

    it('does not render label for whitespace-only label', () => {
      const layout = createTestLayout({
        bins: [
          createTestBin({
            id: 'b1',
            width: 4,
            depth: 4,
            label: '   ',
          }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const texts = container.querySelectorAll('text');
      expect(texts.length).toBe(0);
    });

    it('does not render label for small bins', () => {
      const layout = createTestLayout({
        bins: [
          createTestBin({
            id: 'b1',
            width: 1, // Too small
            depth: 1,
            label: 'Screws',
          }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const texts = container.querySelectorAll('text');
      expect(texts.length).toBe(0);
    });
  });

  describe('aspect ratio', () => {
    it('calculates correct aspect ratio for square drawer', () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 10, height: 12 },
      });
      const { container } = render(
        <LayoutThumbnailWithLabels layout={layout} size={100} />
      );

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 100 100');
    });

    it('calculates correct aspect ratio for wide drawer', () => {
      const layout = createTestLayout({
        drawer: { width: 20, depth: 10, height: 12 },
      });
      const { container } = render(
        <LayoutThumbnailWithLabels layout={layout} size={100} />
      );

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 100 50');
    });

    it('calculates correct aspect ratio for tall drawer', () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 20, height: 12 },
      });
      const { container } = render(
        <LayoutThumbnailWithLabels layout={layout} size={100} />
      );

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 100 200');
    });
  });

  describe('defaults', () => {
    it('uses default size of 160', () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 10, height: 12 }, // Square for easy calculation
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '160');
      expect(svg).toHaveAttribute('height', '160');
    });

    it('uses empty string as default className', () => {
      const layout = createTestLayout();
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('rounded-lg');
    });
  });

  describe('text rotation', () => {
    it('rotates text for tall bins (depth > width * 1.5)', () => {
      const layout = createTestLayout({
        bins: [
          createTestBin({
            id: 'b1',
            width: 2,
            depth: 4, // depth > width * 1.5 (4 > 3)
            label: 'Test',
          }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const text = container.querySelector('text');
      if (text) {
        // Should have a rotation transform
        const transform = text.getAttribute('transform');
        expect(transform).toMatch(/rotate\(-90/);
      }
    });

    it('does not rotate text for wide bins', () => {
      const layout = createTestLayout({
        bins: [
          createTestBin({
            id: 'b1',
            width: 4,
            depth: 2, // width > depth, should not rotate
            label: 'Test',
          }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const text = container.querySelector('text');
      if (text) {
        const transform = text.getAttribute('transform');
        expect(transform).toBeNull();
      }
    });
  });

  describe('contrast color helper', () => {
    // We can test the contrast behavior indirectly by checking text fill colors
    it('uses dark text on light background', () => {
      const layout = createTestLayout({
        categories: [{ id: 'light', name: 'Light', color: '#ffffff' }],
        bins: [
          createTestBin({
            id: 'b1',
            width: 4,
            depth: 4,
            category: 'light',
            label: 'Test',
          }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const text = container.querySelector('text');
      if (text) {
        expect(text).toHaveAttribute('fill', '#1a1a1a');
      }
    });

    it('uses light text on dark background', () => {
      const layout = createTestLayout({
        categories: [{ id: 'dark', name: 'Dark', color: '#000000' }],
        bins: [
          createTestBin({
            id: 'b1',
            width: 4,
            depth: 4,
            category: 'dark',
            label: 'Test',
          }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const text = container.querySelector('text');
      if (text) {
        expect(text).toHaveAttribute('fill', '#ffffff');
      }
    });
  });
});
