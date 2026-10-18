import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin } from '@/core/types';
import { BinSlantExtension } from './BinSlantExtension';

// 32px cells with a 2px gap: one grid unit spans 34px.
const props = { cellSize: 32, cellSizeY: 32, gap: 2, color: '#ff0000' };

function bin(overrides: Partial<Bin> = {}): Bin {
  return createTestBin({ width: gridUnits(2), height: heightUnits(6), ...overrides });
}

beforeEach(() => {
  useLayoutStore.setState({ layout: createTestLayout() });
});

describe('BinSlantExtension', () => {
  it('draws nothing for an upright bin', () => {
    const { container } = render(<BinSlantExtension bin={bin()} {...props} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('draws the strip the top leans over, past the leaning side', () => {
    render(<BinSlantExtension bin={bin({ slant: { angleDeg: 45, side: 'back' } })} {...props} />);
    // 45 degrees over 42 - 4.75 mm of body: 37.25 mm, 30.2 px.
    const lean = screen.getByTestId('slant-lean');
    expect(parseFloat(lean.style.height)).toBeCloseTo((37.25 / 42) * 34, 3);
    expect(parseFloat(lean.style.top)).toBeCloseTo(-(37.25 / 42) * 34, 3);
    expect(screen.queryByTestId('slant-support-cells')).toBeNull();
  });

  it('stops the strip at the first bin it reaches', () => {
    const leaning = bin({ slant: { angleDeg: 45, side: 'back' } });
    const behind = (y: number): Bin =>
      createTestBin({ id: binId('behind'), y: gridUnits(y), width: gridUnits(2) });

    useLayoutStore.setState({ layout: createTestLayout({ bins: [leaning, behind(1)] }) });
    const { unmount } = render(<BinSlantExtension bin={leaning} {...props} />);
    expect(screen.queryByTestId('slant-lean')).toBeNull();
    unmount();

    useLayoutStore.setState({
      layout: createTestLayout({ bins: [leaning, behind(1.5)] }),
    });
    render(<BinSlantExtension bin={leaning} {...props} />);
    expect(parseFloat(screen.getByTestId('slant-lean').style.height)).toBeCloseTo(0.5 * 34, 3);
  });

  it('runs under bins on other layers', () => {
    const leaning = bin({ slant: { angleDeg: 45, side: 'back' } });
    const above = createTestBin({
      id: binId('above'),
      y: gridUnits(1),
      width: gridUnits(2),
      layerId: layerId('other'),
    });
    useLayoutStore.setState({ layout: createTestLayout({ bins: [leaning, above] }) });
    render(<BinSlantExtension bin={leaning} {...props} />);
    expect(parseFloat(screen.getByTestId('slant-lean').style.height)).toBeCloseTo(
      (37.25 / 42) * 34,
      3
    );
  });

  it("hatches the end support's cells, a gap past the bin", () => {
    render(
      <BinSlantExtension
        bin={bin({ slant: { angleDeg: 45, side: 'left', endSupport: true } })}
        {...props}
      />
    );
    const support = screen.getByTestId('slant-support-cells');
    expect(support.style.width).toBe('32px');
    expect(support.style.left).toBe('-34px');
  });
});
