import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TaperBand3D } from './TaperBand3D';

// The band's geometry rules are asserted in taperBandGeometry.test.ts. R3F
// intrinsics (<group>, <mesh>) render as unknown elements under jsdom, which is
// enough to cover the render gate without a WebGL canvas.
describe('TaperBand3D', () => {
  it('renders nothing when no side is flared', () => {
    const { container } = render(
      <TaperBand3D binWidth={100} binDepth={80} band={{ left: 0, right: 0, front: 0, back: 0 }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the overlay when a side is flared', () => {
    const { container } = render(
      <TaperBand3D binWidth={100} binDepth={80} band={{ left: 0, right: 5, front: 0, back: 0 }} />
    );
    expect(container.querySelector('group')).not.toBeNull();
  });
});
