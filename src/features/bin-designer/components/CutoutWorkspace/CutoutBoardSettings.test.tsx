import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutBoardSettings } from './CutoutBoardSettings';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const baseProps = {
  gridSize: 0.5,
  onGridSizeChange: vi.fn(),
  snapEnabled: true,
  onSnapToggle: vi.fn(),
  binWidth: 84,
  binDepth: 42,
  cutoutCount: 3,
};

describe('CutoutBoardSettings', () => {
  it('shows the board footprint and cutout count', () => {
    render(<CutoutBoardSettings {...baseProps} />);
    expect(screen.getByText('84 × 42 mm')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders grid-size options only when snap is enabled', () => {
    const { rerender } = render(<CutoutBoardSettings {...baseProps} snapEnabled />);
    expect(screen.getByRole('group', { name: 'binDesigner.gridSize' })).toBeInTheDocument();

    rerender(<CutoutBoardSettings {...baseProps} snapEnabled={false} />);
    expect(screen.queryByRole('group', { name: 'binDesigner.gridSize' })).not.toBeInTheDocument();
  });

  it('marks the active grid size as pressed and changes it on click', () => {
    const onGridSizeChange = vi.fn();
    render(
      <CutoutBoardSettings {...baseProps} gridSize={0.5} onGridSizeChange={onGridSizeChange} />
    );
    expect(screen.getByRole('button', { name: '0.5' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onGridSizeChange).toHaveBeenCalledWith(2);
  });

  it('toggles snap', () => {
    const onSnapToggle = vi.fn();
    render(<CutoutBoardSettings {...baseProps} snapEnabled onSnapToggle={onSnapToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onSnapToggle).toHaveBeenCalledWith(false);
  });
});
