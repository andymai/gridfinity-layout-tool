import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LOUPE_PX, LOUPE_ZOOM } from '../panel/CutoutsSection/renderer/loupe';
import { TraceLoupe } from './TraceLoupe';

describe('TraceLoupe', () => {
  it('centres the point it magnifies', () => {
    const { container } = render(
      <TraceLoupe
        url="blob:photo"
        image={{ width: 400, height: 300 }}
        at={{ x: 100, y: 50 }}
        scale={2}
        screen={{ x: 600, y: 100 }}
        canvas={{ width: 800, height: 600 }}
      />
    );
    const loupe = container.firstElementChild as HTMLElement;
    const s = 2 * LOUPE_ZOOM;
    expect(loupe.style.backgroundSize).toBe(`${400 * s}px ${300 * s}px`);
    expect(loupe.style.backgroundPosition).toBe(
      `${LOUPE_PX / 2 - 100 * s}px ${LOUPE_PX / 2 - 50 * s}px`
    );
    // The point is on the right, so the loupe takes the left.
    expect(loupe.style.left).toBe('12px');
  });
});
