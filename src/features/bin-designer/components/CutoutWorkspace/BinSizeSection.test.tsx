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
});
