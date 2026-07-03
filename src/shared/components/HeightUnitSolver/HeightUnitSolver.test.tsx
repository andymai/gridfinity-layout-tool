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

  it('disables Apply when the suggestion already equals the current unit', () => {
    // 2 bins × 2 units, target 75.6 → 17.83. Current unit already 17.83.
    render(<HeightUnitSolver heightUnitMm={17.83} onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('stackSolver.targetLabel'), {
      target: { value: '75.6' },
    });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('keeps Apply enabled when the stored value differs beyond 2 decimals', () => {
    // Suggestion rounds to 17.83; stored 17.831 → applying is a real change.
    render(<HeightUnitSolver heightUnitMm={17.831} onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('stackSolver.targetLabel'), {
      target: { value: '75.6' },
    });
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('gives each instance unique input ids so two can mount at once', () => {
    const { container: a } = render(<HeightUnitSolver heightUnitMm={7} onApply={vi.fn()} />);
    const { container: b } = render(<HeightUnitSolver heightUnitMm={7} onApply={vi.fn()} />);
    const idsA = [...a.querySelectorAll('input')].map((el) => el.id);
    const idsB = [...b.querySelectorAll('input')].map((el) => el.id);
    expect(idsA.every((id) => id.length > 0)).toBe(true);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});
