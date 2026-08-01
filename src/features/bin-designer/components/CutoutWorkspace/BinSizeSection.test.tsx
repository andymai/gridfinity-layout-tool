import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BinSizeSection } from './BinSizeSection';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

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
    expect(screen.queryByText('binDesigner.cutoutEditor.offBoardWarning')).not.toBeInTheDocument();
  });

  it('shows the warning and recover button when cutouts are off-board', () => {
    const onClamp = vi.fn();
    render(<BinSizeSection offBoardCount={2} onClampOffBoard={onClamp} />);
    expect(screen.getByText('binDesigner.cutoutEditor.offBoardWarning')).toBeInTheDocument();
    fireEvent.click(screen.getByText('binDesigner.cutoutEditor.bringBackIn'));
    expect(onClamp).toHaveBeenCalledTimes(1);
  });

  it('omits the recover button when no handler is provided', () => {
    render(<BinSizeSection offBoardCount={2} />);
    expect(screen.getByText('binDesigner.cutoutEditor.offBoardWarning')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutoutEditor.bringBackIn')).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByText('binDesigner.cutoutEditor.growBinToFit'));
    expect(onGrow).toHaveBeenCalledTimes(1);
    expect(screen.getByText('binDesigner.cutoutEditor.bringBackIn')).toBeInTheDocument();
    expect(
      screen.queryByText('binDesigner.cutoutEditor.growBinUnavailable')
    ).not.toBeInTheDocument();
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
    expect(labels.indexOf('binDesigner.cutoutEditor.growBinToFit')).toBeLessThan(
      labels.indexOf('binDesigner.cutoutEditor.bringBackIn')
    );
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
    expect(screen.queryByText('binDesigner.cutoutEditor.growBinToFit')).not.toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutoutEditor.growBinUnavailable')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutoutEditor.bringBackIn')).toBeInTheDocument();
  });

  it('keeps the grow action out of the panel when nothing is stranded', () => {
    render(<BinSizeSection offBoardCount={0} growTarget={{ width: 4, depth: 3 }} />);
    expect(screen.queryByText('binDesigner.cutoutEditor.growBinToFit')).not.toBeInTheDocument();
  });

  // Screen readers got nothing when a cutout went off-board before this.
  it('announces the warning assertively', () => {
    render(<BinSizeSection offBoardCount={1} onClampOffBoard={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('binDesigner.cutoutEditor.offBoardWarning');
  });

  it('puts the unavailable reason above the actions, not after them', () => {
    render(<BinSizeSection offBoardCount={1} onClampOffBoard={vi.fn()} growTarget={null} />);
    const alert = screen.getByRole('alert');
    const order = [...alert.querySelectorAll('p, button')].map((n) => n.textContent);
    expect(order.indexOf('binDesigner.cutoutEditor.growBinUnavailable')).toBeLessThan(
      order.indexOf('binDesigner.cutoutEditor.bringBackIn')
    );
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
    for (const name of ['growBinToFit', 'bringBackIn']) {
      const btn = screen.getByText(`binDesigner.cutoutEditor.${name}`);
      expect(btn).toHaveClass('h-auto', 'whitespace-normal');
    }
  });
});
