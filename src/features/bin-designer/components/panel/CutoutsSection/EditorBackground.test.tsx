import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EditorBackground } from './EditorBackground';

describe('EditorBackground', () => {
  it('renders dot grid elements', () => {
    const { container } = render(
      <svg>
        <EditorBackground
          binWidth={20}
          binDepth={20}
          scale={2}
          canvasWidth={40}
          canvasHeight={40}
        />
      </svg>
    );

    const circles = container.querySelectorAll('circle');
    // 20x20mm at 1mm intervals = 21x21 grid = 441 dots
    expect(circles.length).toBe(441);
  });

  it('renders center crosshair lines', () => {
    const { container } = render(
      <svg>
        <EditorBackground
          binWidth={20}
          binDepth={20}
          scale={2}
          canvasWidth={40}
          canvasHeight={40}
        />
      </svg>
    );

    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(2);
  });

  it('uses 2mm interval for large bins', () => {
    const { container } = render(
      <svg>
        <EditorBackground
          binWidth={120}
          binDepth={120}
          scale={2}
          canvasWidth={240}
          canvasHeight={240}
        />
      </svg>
    );

    const circles = container.querySelectorAll('circle');
    // 120x120mm at 2mm intervals = 61x61 grid = 3721 dots
    expect(circles.length).toBe(3721);
  });

  it('positions dots correctly', () => {
    const { container } = render(
      <svg>
        <EditorBackground
          binWidth={10}
          binDepth={10}
          scale={2}
          canvasWidth={20}
          canvasHeight={20}
        />
      </svg>
    );

    const circles = container.querySelectorAll('circle');
    const firstCircle = circles[0];

    // First dot should be at (0,0) in bin coords, which is bottom-left
    // In SVG coords: x=0, y=canvasHeight
    expect(firstCircle?.getAttribute('cx')).toBe('0');
    expect(firstCircle?.getAttribute('cy')).toBe('20');
  });

  it('positions center crosshair correctly', () => {
    const { container } = render(
      <svg>
        <EditorBackground
          binWidth={20}
          binDepth={20}
          scale={2}
          canvasWidth={40}
          canvasHeight={40}
        />
      </svg>
    );

    const lines = container.querySelectorAll('line');
    const horizontalLine = lines[0];
    const verticalLine = lines[1];

    // Center is at (10, 10) in bin coords
    // In SVG: centerX = 10 * 2 = 20, centerY = 40 - 10 * 2 = 20

    // Horizontal line at centerY
    expect(horizontalLine?.getAttribute('y1')).toBe('20');
    expect(horizontalLine?.getAttribute('y2')).toBe('20');

    // Vertical line at centerX
    expect(verticalLine?.getAttribute('x1')).toBe('20');
    expect(verticalLine?.getAttribute('x2')).toBe('20');
  });

  it('applies correct styling to dots', () => {
    const { container } = render(
      <svg>
        <EditorBackground
          binWidth={10}
          binDepth={10}
          scale={2}
          canvasWidth={20}
          canvasHeight={20}
        />
      </svg>
    );

    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('r')).toBe('0.5');
    expect(circle?.getAttribute('fill')).toBe('var(--color-stroke-subtle)');
    expect(circle?.getAttribute('opacity')).toBe('0.3');
  });

  it('applies correct styling to crosshair lines', () => {
    const { container } = render(
      <svg>
        <EditorBackground
          binWidth={10}
          binDepth={10}
          scale={2}
          canvasWidth={20}
          canvasHeight={20}
        />
      </svg>
    );

    const line = container.querySelector('line');
    expect(line?.getAttribute('stroke')).toBe('var(--color-stroke-subtle)');
    expect(line?.getAttribute('stroke-width')).toBe('0.5');
    expect(line?.getAttribute('stroke-dasharray')).toBe('4 2');
    expect(line?.getAttribute('opacity')).toBe('0.4');
  });
});
