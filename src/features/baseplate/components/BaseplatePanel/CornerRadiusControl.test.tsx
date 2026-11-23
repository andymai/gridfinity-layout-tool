import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CornerRadiusControl } from './CornerRadiusControl';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('CornerRadiusControl', () => {
  it('shows only the uniform control when not in per-corner mode', () => {
    render(
      <CornerRadiusControl
        cornerRadius={3}
        cornerRadii={undefined}
        maxRadius={10}
        onUniformChange={vi.fn()}
        onPerCornerChange={vi.fn()}
        onChangeEnd={vi.fn()}
      />
    );
    expect(screen.getByText('baseplate.cornerRadius')).toBeInTheDocument();
    expect(screen.queryByText('baseplate.cornerRadiusTL')).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('seeds all four corners from the uniform value when unlinking, as one finished change', () => {
    const onPerCornerChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(
      <CornerRadiusControl
        cornerRadius={4}
        cornerRadii={undefined}
        maxRadius={10}
        onUniformChange={vi.fn()}
        onPerCornerChange={onPerCornerChange}
        onChangeEnd={onChangeEnd}
      />
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onPerCornerChange).toHaveBeenCalledWith({ tl: 4, tr: 4, bl: 4, br: 4 });
    expect(onChangeEnd).toHaveBeenCalledOnce();
  });

  it('ends the change after a slider key step', () => {
    const onUniformChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(
      <CornerRadiusControl
        cornerRadius={4}
        cornerRadii={undefined}
        maxRadius={10}
        onUniformChange={onUniformChange}
        onPerCornerChange={vi.fn()}
        onChangeEnd={onChangeEnd}
      />
    );
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onUniformChange).toHaveBeenCalledWith(4.5);
    expect(onChangeEnd).toHaveBeenCalledOnce();
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
        onChangeEnd={vi.fn()}
      />
    );
    expect(screen.getByText('baseplate.cornerRadiusTL')).toBeInTheDocument();
    expect(screen.getByText('baseplate.cornerRadiusBR')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeChecked();

    fireEvent.click(screen.getByRole('switch'));
    expect(onUniformChange).toHaveBeenCalledWith(1);
  });
});
