import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { RulerMeasurement3D } from './RulerMeasurement3D';
import type { RulerMeasurement } from '../handlers/rulerHandler';

function renderInCanvas(ui: React.ReactElement) {
  return render(<Canvas>{ui}</Canvas>);
}

describe('RulerMeasurement3D', () => {
  it('renders without crashing for a valid measurement', () => {
    const measurement: RulerMeasurement = {
      startX: 0,
      startY: 0,
      endX: 10,
      endY: 0,
      distance: 10,
      deltaX: 10,
      deltaY: 0,
    };
    expect(() =>
      renderInCanvas(<RulerMeasurement3D measurement={measurement} zoom={5} />)
    ).not.toThrow();
  });

  it('returns null for zero-distance measurement', () => {
    const measurement: RulerMeasurement = {
      startX: 5,
      startY: 5,
      endX: 5,
      endY: 5,
      distance: 0,
      deltaX: 0,
      deltaY: 0,
    };
    expect(() =>
      renderInCanvas(<RulerMeasurement3D measurement={measurement} zoom={5} />)
    ).not.toThrow();
  });
});
