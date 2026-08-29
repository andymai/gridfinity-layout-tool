import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BinSizeSection } from './BinSizeSection';

// Interpolating mock: a key-only mock cannot tell "Grow bin to 5 × 3" from a
// button with no size in it, which is the behaviour this panel exists for.
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}));

/** Mirrors the mock, so assertions read as the string the panel renders. */
const tk = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;
const K = 'binDesigner.cutoutEditor';

vi.mock('../panel/DimensionsSection/DimensionsSection', () => ({
  DimensionsSection: () => <div data-testid="dimensions-section" />,
}));

describe('BinSizeSection', () => {
  it('always renders the dimensions controls', () => {
    render(<BinSizeSection offBoardCount={0} />);
    expect(screen.getByTestId('dimensions-section')).toBeInTheDocument();
  });

  it('hides the off-board warning when nothing is stranded', () => {
    render(<BinSizeSection offBoardCount={0} onClampOffBoard={vi.fn()} />);
    expect(
      screen.queryByText(tk(`${K}.offBoardWarning.other`, { count: 0 }))
    ).not.toBeInTheDocument();
  });

  it('shows the warning and recover button when cutouts are off-board', () => {
    const onClamp = vi.fn();
    render(<BinSizeSection offBoardCount={2} onClampOffBoard={onClamp} />);
    expect(screen.getByText(tk(`${K}.offBoardWarning.other`, { count: 2 }))).toBeInTheDocument();
    fireEvent.click(screen.getByText(`${K}.bringBackIn`));
    expect(onClamp).toHaveBeenCalledTimes(1);
  });

  it('omits the recover button when no handler is provided', () => {
    render(<BinSizeSection offBoardCount={2} />);
    expect(screen.getByText(tk(`${K}.offBoardWarning.other`, { count: 2 }))).toBeInTheDocument();
    expect(screen.queryByText(`${K}.bringBackIn`)).not.toBeInTheDocument();
  });

  it('shows the depth-shortfall warning only when a cut falls short', () => {
    const { rerender } = render(<BinSizeSection offBoardCount={0} depthShortfallCount={0} />);
    expect(
      screen.queryByText(tk(`${K}.depthShortfallWarning`, { count: 0 }))
    ).not.toBeInTheDocument();
    rerender(<BinSizeSection offBoardCount={0} depthShortfallCount={3} />);
    expect(screen.getByText(tk(`${K}.depthShortfallWarning`, { count: 3 }))).toBeInTheDocument();
  });

  it('offers to grow the bin alongside clamping back in', () => {
    const onGrow = vi.fn();
    render(
      <BinSizeSection
        offBoardCount={1}
        onClampOffBoard={vi.fn()}
        growTarget={{ width: 4, depth: 3 }}
        onGrowToFit={onGrow}
      />
    );
    fireEvent.click(screen.getByText(tk(`${K}.growBinToFit`, { width: 4, depth: 3 })));
    expect(onGrow).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`${K}.bringBackIn`)).toBeInTheDocument();
    expect(screen.queryByText(`${K}.growBinUnavailable`)).not.toBeInTheDocument();
  });

  it('leads with the grow action', () => {
    render(
      <BinSizeSection
        offBoardCount={1}
        onClampOffBoard={vi.fn()}
        growTarget={{ width: 4, depth: 3 }}
        onGrowToFit={vi.fn()}
      />
    );
    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    const grow = labels.indexOf(tk(`${K}.growBinToFit`, { width: 4, depth: 3 }));
    // Assert presence first: a missing button indexes to -1, which would pass
    // the ordering comparison on its own.
    expect(grow).toBeGreaterThanOrEqual(0);
    expect(grow).toBeLessThan(labels.indexOf(`${K}.bringBackIn`));
  });

  it('explains why instead of offering a grow that cannot clear the warning', () => {
    render(
      <BinSizeSection
        offBoardCount={1}
        onClampOffBoard={vi.fn()}
        growTarget={null}
        onGrowToFit={vi.fn()}
      />
    );
    expect(
      screen.queryByText(tk(`${K}.growBinToFit`, { width: 4, depth: 3 }))
    ).not.toBeInTheDocument();
    expect(screen.getByText(`${K}.growBinUnavailable`)).toBeInTheDocument();
    expect(screen.getByText(`${K}.bringBackIn`)).toBeInTheDocument();
  });

  it('keeps the grow action out of the panel when nothing is stranded', () => {
    render(<BinSizeSection offBoardCount={0} growTarget={{ width: 4, depth: 3 }} />);
    expect(
      screen.queryByText(tk(`${K}.growBinToFit`, { width: 4, depth: 3 }))
    ).not.toBeInTheDocument();
  });

  // Naming the resulting size is the point of the action: it lets you see what
  // the click will produce before committing to it. Half-grid targets are
  // fractional, so the exact values have to survive into the label.
  it.each([
    { width: 4, depth: 3 },
    { width: 3.5, depth: 2 },
  ])('names the exact size it will produce ($width × $depth)', (target) => {
    render(
      <BinSizeSection
        offBoardCount={1}
        onClampOffBoard={vi.fn()}
        growTarget={target}
        onGrowToFit={vi.fn()}
      />
    );
    expect(screen.getByText(tk(`${K}.growBinToFit`, target))).toBeInTheDocument();
  });

  // Screen readers got nothing when a cutout went off-board before this.
  it('announces the warning assertively', () => {
    render(<BinSizeSection offBoardCount={1} onClampOffBoard={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(`${K}.offBoardWarning.one`);
  });

  it('puts the unavailable reason above the actions, not after them', () => {
    render(<BinSizeSection offBoardCount={1} onClampOffBoard={vi.fn()} growTarget={null} />);
    const alert = screen.getByRole('alert');
    const order = [...alert.querySelectorAll('p, button')].map((n) => n.textContent);
    expect(order.indexOf(`${K}.growBinUnavailable`)).toBeLessThan(
      order.indexOf(`${K}.bringBackIn`)
    );
  });

  describe('center action', () => {
    const CENTER = 'binDesigner.cutouts.centerInBin';

    it('offers centering alongside the clamp when it can clear the warning', () => {
      const onCenter = vi.fn();
      render(
        <BinSizeSection offBoardCount={1} onClampOffBoard={vi.fn()} onCenterOffBoard={onCenter} />
      );
      fireEvent.click(screen.getByText(CENTER));
      expect(onCenter).toHaveBeenCalledTimes(1);
    });

    // Absent handler is the whole guard against duplicating "Bring back in":
    // the workspace withholds it unless centering actually fixes every stray.
    it('stays out of the panel when centering cannot clear the warning', () => {
      render(<BinSizeSection offBoardCount={1} onClampOffBoard={vi.fn()} />);
      expect(screen.getByText(`${K}.bringBackIn`)).toBeInTheDocument();
      expect(screen.queryByText(CENTER)).not.toBeInTheDocument();
    });

    it('never appears without a warning to attach to', () => {
      render(<BinSizeSection offBoardCount={0} onCenterOffBoard={vi.fn()} />);
      expect(screen.queryByText(CENTER)).not.toBeInTheDocument();
    });

    // Grow changes the part; center and clamp only move shapes, and center is
    // the gentler of the two.
    it('sits between growing the bin and clamping to the edge', () => {
      render(
        <BinSizeSection
          offBoardCount={1}
          onClampOffBoard={vi.fn()}
          onCenterOffBoard={vi.fn()}
          growTarget={{ width: 4, depth: 3 }}
          onGrowToFit={vi.fn()}
        />
      );
      const labels = screen.getAllByRole('button').map((b) => b.textContent);
      const center = labels.indexOf(CENTER);
      expect(center).toBeGreaterThan(
        labels.indexOf(tk(`${K}.growBinToFit`, { width: 4, depth: 3 }))
      );
      expect(center).toBeLessThan(labels.indexOf(`${K}.bringBackIn`));
    });

    it('lets its label wrap in the narrow dock like its siblings', () => {
      render(<BinSizeSection offBoardCount={1} onCenterOffBoard={vi.fn()} />);
      expect(screen.getByText(CENTER)).toHaveClass('h-auto', 'whitespace-normal');
    });
  });

  // The dock narrows to 220px and 7 of 15 locales overrun the label there, so a
  // fixed-height button would clip the second line.
  it('lets the action labels wrap instead of clipping', () => {
    render(
      <BinSizeSection
        offBoardCount={1}
        onClampOffBoard={vi.fn()}
        growTarget={{ width: 4, depth: 3 }}
        onGrowToFit={vi.fn()}
      />
    );
    for (const label of [tk(`${K}.growBinToFit`, { width: 4, depth: 3 }), `${K}.bringBackIn`]) {
      expect(screen.getByText(label)).toHaveClass('h-auto', 'whitespace-normal');
    }
  });
});
