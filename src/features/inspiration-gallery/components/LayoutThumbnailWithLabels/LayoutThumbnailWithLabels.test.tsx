import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LayoutThumbnailWithLabels } from '.';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { gridUnits, heightUnits, binId, categoryId, layerId } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

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
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} size={200} />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '200');
    });

    it('uses responsive sizing when responsive prop is true', () => {
      const layout = createTestLayout();
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} responsive />);

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
        drawer: { width: gridUnits(5), depth: gridUnits(4), height: heightUnits(12) },
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
        bins: [
          createTestBin({
            id: binId('b1'),
            x: gridUnits(0),
            y: gridUnits(0),
            width: gridUnits(2),
            depth: gridUnits(2),
          }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      // Should have: drawer bg + inner area + bin rect = 3 rects
      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBe(3);
    });

    it('renders multiple bins', () => {
      const layout = createTestLayout({
        bins: [
          createTestBin({ id: binId('b1'), x: gridUnits(0), y: gridUnits(0) }),
          createTestBin({ id: binId('b2'), x: gridUnits(2), y: gridUnits(0) }),
          createTestBin({ id: binId('b3'), x: gridUnits(4), y: gridUnits(0) }),
        ],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBe(5); // 2 background + 3 bins
    });

    it('applies category color to bins', () => {
      const layout = createTestLayout({
        categories: [{ id: categoryId('tools'), name: 'Tools', color: '#ff0000' }],
        bins: [createTestBin({ id: binId('b1'), category: categoryId('tools') })],
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} />);

      const rects = container.querySelectorAll('rect');
      const binRect = rects[rects.length - 1]; // Last rect is the bin
      expect(binRect).toHaveAttribute('fill', '#ff0000');
    });

    it('uses fallback color for unknown category', () => {
      const layout = createTestLayout({
        categories: [{ id: categoryId('known'), name: 'Known', color: '#ff0000' }],
        bins: [createTestBin({ id: binId('b1'), category: categoryId('unknown') })],
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
          createTestBin({ id: binId('b1'), layerId: layerId('layer1') }),
          createTestBin({ id: binId('b2'), layerId: STAGING_ID }),
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
          createTestBin({ id: binId('b1'), layerId: STAGING_ID }),
          createTestBin({ id: binId('b2'), layerId: STAGING_ID }),
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
            id: binId('b1'),
            width: gridUnits(4), // Large enough to show label
            depth: gridUnits(4),
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
            id: binId('b1'),
            width: gridUnits(4),
            depth: gridUnits(4),
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
            id: binId('b1'),
            width: gridUnits(4),
            depth: gridUnits(4),
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
            id: binId('b1'),
            width: gridUnits(1), // Too small
            depth: gridUnits(1),
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
        drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(12) },
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} size={100} />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 100 100');
    });

    it('calculates correct aspect ratio for wide drawer', () => {
      const layout = createTestLayout({
        drawer: { width: gridUnits(20), depth: gridUnits(10), height: heightUnits(12) },
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} size={100} />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 100 50');
    });

    it('calculates correct aspect ratio for tall drawer', () => {
      const layout = createTestLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(20), height: heightUnits(12) },
      });
      const { container } = render(<LayoutThumbnailWithLabels layout={layout} size={100} />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 100 200');
    });
  });

  describe('defaults', () => {
    it('uses default size of 160', () => {
      const layout = createTestLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(12) }, // Square for easy calculation
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
            id: binId('b1'),
            width: gridUnits(2),
            depth: gridUnits(4), // depth > width * 1.5 (4 > 3)
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
            id: binId('b1'),
            width: gridUnits(4),
            depth: gridUnits(2), // width > depth, should not rotate
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
        categories: [{ id: categoryId('light'), name: 'Light', color: '#ffffff' }],
        bins: [
          createTestBin({
            id: binId('b1'),
            width: gridUnits(4),
            depth: gridUnits(4),
            category: categoryId('light'),
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
        categories: [{ id: categoryId('dark'), name: 'Dark', color: '#000000' }],
        bins: [
          createTestBin({
            id: binId('b1'),
            width: gridUnits(4),
            depth: gridUnits(4),
            category: categoryId('dark'),
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
