import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

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
});
