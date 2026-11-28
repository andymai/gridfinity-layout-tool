import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TileFill } from './TileFill';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function canvas(): HTMLCanvasElement {
  const found = document.querySelector('canvas');
  if (!found) throw new Error('no canvas');
  return found;
}

describe('TileFill', () => {
  it('stays hidden between transitions and never takes a tap', () => {
    render(<TileFill transition={null} background="#2733E0" reduced={false} />);
    expect(canvas()).toHaveStyle({ visibility: 'hidden' });
    expect(canvas()).toHaveClass('pointer-events-none');
    expect(canvas()).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows while the next colour fills in', () => {
    render(
      <TileFill
        transition={{ phase: 'fill', target: 1, time: 0.2, length: 0.68 }}
        background="#2733E0"
        reduced={false}
      />
    );
    expect(canvas()).toHaveStyle({ visibility: 'visible', opacity: '1' });
  });

  it('fades off the new card by opacity alone', () => {
    render(
      <TileFill
        transition={{ phase: 'dissolve', target: 1, progress: 0.5 }}
        background="#2733E0"
        reduced={false}
      />
    );
    const opacity = Number(canvas().style.opacity);
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(0.5);
  });
});
