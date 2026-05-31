// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { BinGridIdenticon } from './BinGridIdenticon';
import { identiconFromSeed, identiconCellColor } from './identicon';

afterEach(() => cleanup());

describe('BinGridIdenticon', () => {
  it('renders all 16 grid cells', () => {
    const { container } = render(<BinGridIdenticon seed="andy@example.com" />);
    expect(container.querySelectorAll('rect')).toHaveLength(16);
  });

  it('fills cells according to the seed', () => {
    const seed = 'fill-check@example.com';
    const { cells } = identiconFromSeed(seed);
    const expectedFilled = cells.filter(Boolean).length;

    const { container } = render(<BinGridIdenticon seed={seed} />);
    const filled = Array.from(container.querySelectorAll('rect')).filter(
      (r) => r.getAttribute('fill-opacity') === '1'
    );
    expect(filled).toHaveLength(expectedFilled);
  });

  it('uses the desaturated palette when muted', () => {
    const seed = 'muted@example.com';
    const { cells, hue } = identiconFromSeed(seed);
    const firstFilled = cells.findIndex(Boolean);
    const row = Math.floor(firstFilled / 4);

    const { container } = render(<BinGridIdenticon seed={seed} muted />);
    const rects = container.querySelectorAll('rect');
    expect(rects[firstFilled].getAttribute('fill')).toBe(identiconCellColor(hue, row, true));
  });

  it('marks the SVG as decorative', () => {
    const { container } = render(<BinGridIdenticon seed="a" />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses hueOverride instead of the seed-derived hue', () => {
    const seed = 'override@example.com';
    const { cells } = identiconFromSeed(seed);
    const firstFilled = cells.findIndex(Boolean);
    const row = Math.floor(firstFilled / 4);

    const { container } = render(<BinGridIdenticon seed={seed} hueOverride={123} />);
    const rects = container.querySelectorAll('rect');
    expect(rects[firstFilled].getAttribute('fill')).toBe(identiconCellColor(123, row, false));
  });
});
