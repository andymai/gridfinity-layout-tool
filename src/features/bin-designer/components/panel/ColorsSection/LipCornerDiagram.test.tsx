import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LipCornerDiagram } from './LipCornerDiagram';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const corners = {
  frontLeft: '#ff0000',
  frontRight: '#00ff00',
  backRight: '#0000ff',
  backLeft: '#ffffff',
};

describe('LipCornerDiagram', () => {
  it('renders 4 corner rects with their respective fills', () => {
    const { container } = render(<LipCornerDiagram corners={corners} hovered={null} />);
    const rects = container.querySelectorAll('rect');
    expect(rects).toHaveLength(4);
    const fills = [...rects].map((r) => r.getAttribute('fill'));
    expect(fills).toEqual(expect.arrayContaining(['#ff0000', '#00ff00', '#0000ff', '#ffffff']));
  });

  it('emphasizes only the hovered quadrant (higher stroke opacity)', () => {
    const { container } = render(<LipCornerDiagram corners={corners} hovered="lip:backRight" />);
    const rects = [...container.querySelectorAll('rect')];
    const opacities = rects.map((r) => Number(r.getAttribute('stroke-opacity')));
    const max = Math.max(...opacities);
    const min = Math.min(...opacities);
    expect(max).toBeGreaterThan(min);
  });

  it('emphasizes all 4 quadrants when the lip group header is hovered', () => {
    const { container } = render(<LipCornerDiagram corners={corners} hovered="lip" />);
    const rects = [...container.querySelectorAll('rect')];
    const opacities = new Set(rects.map((r) => r.getAttribute('stroke-opacity')));
    expect(opacities.size).toBe(1);
  });
});
