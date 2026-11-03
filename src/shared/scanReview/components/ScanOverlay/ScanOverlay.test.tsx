import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { SceneShape, SceneTrace } from '@/shared/scanTrace';
import { ScanOverlay } from './ScanOverlay';

const box = (x0: number, y0: number, x1: number, y1: number): SceneShape => {
  const points = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return { imagePoints: points, outputPoints: points };
};

const IMAGE = { width: 100, height: 80, data: new Uint8ClampedArray(100 * 80 * 4) };
const ring: SceneShape = { ...box(10, 10, 50, 50), holes: [box(20, 20, 40, 40)] };
const scene = (shapes: SceneShape[]): SceneTrace => ({
  shapes,
  units: 'px',
  card: null,
  grid: null,
  reference: null,
});

describe('ScanOverlay', () => {
  it('draws a kept hole as part of its tool', () => {
    const { container } = render(
      <ScanOverlay image={IMAGE} scene={scene([ring])} shapes={[ring]} keepHoles />
    );
    const d = container.querySelector('path')?.getAttribute('d') ?? '';
    expect(d.match(/M/g)).toHaveLength(2);
  });

  it('draws the outline alone while holes are off', () => {
    const { container } = render(
      <ScanOverlay image={IMAGE} scene={scene([ring])} shapes={[ring]} keepHoles={false} />
    );
    expect(container.querySelector('path')?.getAttribute('d')?.match(/M/g)).toHaveLength(1);
  });

  it('numbers the tools only when there are several', () => {
    const one = render(
      <ScanOverlay image={IMAGE} scene={scene([ring])} shapes={[ring]} keepHoles={false} />
    );
    expect(one.container.querySelectorAll('text')).toHaveLength(0);
    const other = box(60, 10, 90, 30);
    const two = render(
      <ScanOverlay
        image={IMAGE}
        scene={scene([ring, other])}
        shapes={[ring, other]}
        keepHoles={false}
      />
    );
    expect(two.container.querySelectorAll('text')).toHaveLength(2);
  });

  it('sizes the number badges as asked', () => {
    const other = box(60, 10, 90, 30);
    const props = { image: IMAGE, scene: scene([ring, other]), shapes: [ring, other] };
    const fixed = render(<ScanOverlay {...props} keepHoles={false} badgeRadius={3} />);
    expect(fixed.container.querySelector('circle')?.getAttribute('r')).toBe('3');
    const shared = render(<ScanOverlay {...props} keepHoles={false} />);
    expect(shared.container.querySelector('circle')?.getAttribute('r')).toBe('2.5');
  });
});
