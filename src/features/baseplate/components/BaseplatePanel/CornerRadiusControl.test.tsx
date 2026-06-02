import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CornerRadiusControl } from './CornerRadiusControl';

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string): string =>
      key,
}));

describe('CornerRadiusControl', () => {
  it('shows only the uniform control when not in per-corner mode', () => {
    render(
      <CornerRadiusControl
        cornerRadius={3}
        cornerRadii={undefined}
        maxRadius={10}
        onUniformChange={vi.fn()}
        onPerCornerChange={vi.fn()}
      />
    );
    expect(screen.getByText('baseplate.cornerRadius')).toBeInTheDocument();
    expect(screen.queryByText('baseplate.cornerRadiusTL')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('seeds all four corners from the uniform value when unlinking', () => {
    const onPerCornerChange = vi.fn();
    render(
      <CornerRadiusControl
        cornerRadius={4}
        cornerRadii={undefined}
        maxRadius={10}
        onUniformChange={vi.fn()}
        onPerCornerChange={onPerCornerChange}
      />
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onPerCornerChange).toHaveBeenCalledWith({ tl: 4, tr: 4, bl: 4, br: 4 });
  });

  it('shows per-corner controls and collapses back to the TL value when relinking', () => {
    const onUniformChange = vi.fn();
    render(
      <CornerRadiusControl
        cornerRadius={undefined}
        cornerRadii={{ tl: 1, tr: 2, bl: 3, br: 4 }}
        maxRadius={10}
        onUniformChange={onUniformChange}
        onPerCornerChange={vi.fn()}
      />
    );
    expect(screen.getByText('baseplate.cornerRadiusTL')).toBeInTheDocument();
    expect(screen.getByText('baseplate.cornerRadiusBR')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onUniformChange).toHaveBeenCalledWith(1);
  });
});
