import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PaddingDistributionControl } from './PaddingDistributionControl';

// Mock i18n — returns the key with interpolated values
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), key);
    }
    return key;
  },
}));

describe('PaddingDistributionControl', () => {
  const baseProps = {
    axis: 'width' as const,
    drawerMm: 300,
    gridMm: 252, // 6 × 42mm
    ratio: 0.5,
    onDrawerMmChange: vi.fn(),
    onRatioChange: vi.fn(),
  };

  it('renders with remainder info text', () => {
    render(<PaddingDistributionControl {...baseProps} />);

    // Mock returns key strings — verify both info fragments are present
    expect(screen.getByText(/baseplate\.gridUses/)).toBeInTheDocument();
    expect(screen.getByText(/baseplate\.remaining/)).toBeInTheDocument();
  });

  it('shows warning when drawer < grid', () => {
    render(<PaddingDistributionControl {...baseProps} drawerMm={200} />);

    expect(screen.getByText('baseplate.drawerTooSmall')).toBeInTheDocument();
  });

  it('shows no remaining space when drawer equals grid', () => {
    render(<PaddingDistributionControl {...baseProps} drawerMm={252} />);

    expect(screen.getByText('baseplate.noRemaining')).toBeInTheDocument();
  });

  it('fires correct ratio on quick-align buttons', () => {
    const onRatioChange = vi.fn();
    render(<PaddingDistributionControl {...baseProps} onRatioChange={onRatioChange} />);

    const startBtn = screen.getByLabelText('baseplate.alignStart');
    const centerBtn = screen.getByLabelText('baseplate.alignCenter');
    const endBtn = screen.getByLabelText('baseplate.alignEnd');

    fireEvent.click(startBtn);
    expect(onRatioChange).toHaveBeenCalledWith(0);

    fireEvent.click(centerBtn);
    expect(onRatioChange).toHaveBeenCalledWith(0.5);

    fireEvent.click(endBtn);
    expect(onRatioChange).toHaveBeenCalledWith(1);
  });

  it('hides slider and buttons when no remainder', () => {
    render(<PaddingDistributionControl {...baseProps} drawerMm={252} />);

    // Quick-align buttons should not be rendered when no remainder
    expect(screen.queryByLabelText('baseplate.alignStart')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('baseplate.alignCenter')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('baseplate.alignEnd')).not.toBeInTheDocument();
  });

  it('calls onDrawerMmChange when stepper value changes', () => {
    const onDrawerMmChange = vi.fn();
    render(<PaddingDistributionControl {...baseProps} onDrawerMmChange={onDrawerMmChange} />);

    // Find increase button for the stepper
    const increaseBtn = screen.getByLabelText(/increase/i);
    fireEvent.click(increaseBtn);

    expect(onDrawerMmChange).toHaveBeenCalledWith(301);
  });
});
