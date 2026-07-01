import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeightUnitSolver } from './HeightUnitSolver';

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string, vars?: Record<string, unknown>): string =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

describe('HeightUnitSolver', () => {
  it('suggests the unit that fills the target and applies it', () => {
    const onApply = vi.fn();
    render(<HeightUnitSolver heightUnitMm={7} onApply={onApply} />);

    // Default: 2 bins × 2 units/bin. Target 75.6mm → (75.6 − 4.3) / 4 = 17.825,
    // which is out of the 3–20mm range only if >20; here it's in range.
    fireEvent.change(screen.getByLabelText('stackSolver.targetLabel'), {
      target: { value: '75.6' },
    });

    const applyBtn = screen.getByRole('button');
    // (75.6 − 4.3) / (2 × 2) = 17.825 → rounded 17.83
    expect(applyBtn.textContent).toContain('17.83');
    fireEvent.click(applyBtn);
    expect(onApply).toHaveBeenCalledWith(17.83);
  });

  it('flags a suggestion outside the allowed unit range', () => {
    render(<HeightUnitSolver heightUnitMm={7} onApply={vi.fn()} />);
    // 1 bin, 1 unit, target 200mm → 195.7mm/unit, far above the 20mm max.
    fireEvent.change(screen.getByLabelText('stackSolver.binsLabel'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('stackSolver.unitsPerBinLabel'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('stackSolver.targetLabel'), {
      target: { value: '200' },
    });
    expect(screen.getByText(/stackSolver\.outOfRange/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows nothing to apply until a target is entered', () => {
    render(<HeightUnitSolver heightUnitMm={7} onApply={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
