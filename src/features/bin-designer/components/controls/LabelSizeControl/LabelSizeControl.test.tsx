import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

import { LabelSizeControl } from './LabelSizeControl';

describe('LabelSizeControl', () => {
  const defaultProps = {
    onChange: vi.fn(),
    min: 4,
    max: 20,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const autoButton = () => screen.getByRole('button', { name: 'binDesigner.textSizeAuto' });

  it('renders in auto mode with no slider when value is undefined', () => {
    render(<LabelSizeControl {...defaultProps} value={undefined} />);
    expect(autoButton()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('seeds the override at max when toggled out of auto', () => {
    render(<LabelSizeControl {...defaultProps} value={undefined} />);
    fireEvent.click(autoButton());
    expect(defaultProps.onChange).toHaveBeenCalledWith(20);
  });

  it('shows the slider and clears the override when toggled back to auto', () => {
    render(<LabelSizeControl {...defaultProps} value={12} />);
    expect(autoButton()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('slider')).toBeInTheDocument();
    fireEvent.click(autoButton());
    expect(defaultProps.onChange).toHaveBeenCalledWith(null);
  });

  it('disables the toggle when disabled', () => {
    render(<LabelSizeControl {...defaultProps} value={undefined} disabled />);
    expect(autoButton()).toBeDisabled();
  });

  it('presents an explicit size as a ceiling, not the printed size', () => {
    // Generation applies the override as min(auto-fit, override), so a label
    // that cannot fit still renders smaller. The control must not read as a
    // target, or the number on screen looks like a promise about the print.
    render(<LabelSizeControl {...defaultProps} value={12} />);
    // Twice: the row heading beside the Auto toggle, and the slider's own label.
    expect(screen.getAllByText('binDesigner.textSizeMax')).toHaveLength(2);
    expect(screen.queryByText('binDesigner.textSize')).toBeNull();
  });

  it('reads as a plain size while auto-fit owns it', () => {
    render(<LabelSizeControl {...defaultProps} value={undefined} />);
    expect(screen.getByText('binDesigner.textSize')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.textSizeCapHint')).toBeNull();
  });

  it('explains the shared size only where siblings share one', () => {
    // Cutout labels are sized one at a time, so the sharing note would be false
    // there; only the label-tab call site opts in.
    const { unmount } = render(<LabelSizeControl {...defaultProps} value={12} />);
    expect(screen.queryByText('binDesigner.textSizeCapHint')).toBeNull();
    unmount();

    render(<LabelSizeControl {...defaultProps} value={12} explainShared />);
    const hint = screen.getByText('binDesigner.textSizeCapHint');
    // Routed through SliderInput's `info` so it is announced to whoever operates
    // the slider, rather than sitting beside it unlinked.
    expect(screen.getByRole('slider')).toHaveAttribute('aria-describedby', hint.id);
  });
});
