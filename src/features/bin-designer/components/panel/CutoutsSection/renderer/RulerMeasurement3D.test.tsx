import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RulerMeasurement3D } from './RulerMeasurement3D';
import type { RulerMeasurement } from '../handlers/rulerHandler';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-r3f-canvas">{children}</div>
  ),
}));

vi.mock('@react-three/drei', () => ({
  Line: () => <div data-testid="mock-line" />,
  Html: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-html">{children}</div>
  ),
}));

describe('RulerMeasurement3D', () => {
  it('renders measurement label for a valid measurement', () => {
    const measurement: RulerMeasurement = {
      startX: 0,
      startY: 0,
      endX: 10,
      endY: 0,
      distance: 10,
      deltaX: 10,
      deltaY: 0,
    };
    const { getByText } = render(<RulerMeasurement3D measurement={measurement} zoom={5} />);
    expect(getByText('10.0mm')).toBeDefined();
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
    const { container } = render(<RulerMeasurement3D measurement={measurement} zoom={5} />);
    expect(container.innerHTML).toBe('');
  });
});
