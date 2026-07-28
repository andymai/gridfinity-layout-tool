import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LABEL_ICON_PATHS } from '@/shared/constants/labelIconPaths';
import { LABEL_PLATE_ICONS } from '@/shared/constants/labelPlates';
import { LabelIconGlyph } from './LabelIconGlyph';

const pathOf = (container: HTMLElement): SVGPathElement | null => container.querySelector('path');

describe('LabelIconGlyph', () => {
  it('renders a path for every icon in the catalog', () => {
    for (const icon of LABEL_PLATE_ICONS) {
      const { container, unmount } = render(<LabelIconGlyph icon={icon} />);
      expect(pathOf(container)?.getAttribute('d'), icon).toBeTruthy();
      unmount();
    }
  });

  // The point of sharing the catalog is that a preview can't drift from the
  // print. If this stops matching, the grid is showing something the plate
  // won't produce.
  it('draws the exact path data the worker extrudes', () => {
    const { container } = render(<LabelIconGlyph icon="bolt" />);
    expect(pathOf(container)?.getAttribute('d')).toBe(LABEL_ICON_PATHS.bolt.outline);
  });

  it('appends holes as extra subpaths under evenodd', () => {
    const { container } = render(<LabelIconGlyph icon="washer" />);
    const path = pathOf(container);
    expect(path?.getAttribute('fill-rule')).toBe('evenodd');
    expect(path?.getAttribute('d')).toBe(
      `${LABEL_ICON_PATHS.washer.outline} ${LABEL_ICON_PATHS.washer.holes?.[0]}`
    );
  });

  it('is decorative — the interactive parent supplies the name', () => {
    const { container } = render(<LabelIconGlyph icon="nut" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes its size from the caller', () => {
    const { container } = render(<LabelIconGlyph icon="nut" size={40} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '40');
    expect(svg).toHaveAttribute('height', '40');
  });
});
