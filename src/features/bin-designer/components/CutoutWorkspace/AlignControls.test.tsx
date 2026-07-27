import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlignControls } from './AlignControls';

function setup(over: Partial<React.ComponentProps<typeof AlignControls>> = {}) {
  const onAlign = vi.fn();
  const onDistribute = vi.fn();
  render(
    <AlignControls selectedCount={3} onAlign={onAlign} onDistribute={onDistribute} {...over} />
  );
  return { onAlign, onDistribute };
}

describe('AlignControls', () => {
  it('renders all six align modes', () => {
    setup();

    for (const label of [
      'Align left edges',
      'Align horizontal centers',
      'Align right edges',
      'Align top edges',
      'Align vertical centers',
      'Align bottom edges',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('reports the align mode that was clicked', async () => {
    const user = userEvent.setup();
    const { onAlign } = setup();

    await user.click(screen.getByRole('button', { name: 'Align right edges' }));

    expect(onAlign).toHaveBeenCalledWith('right');
  });

  it('reports the distribute axis that was clicked', async () => {
    const user = userEvent.setup();
    const { onDistribute } = setup();

    await user.click(screen.getByRole('button', { name: 'Distribute vertically' }));

    expect(onDistribute).toHaveBeenCalledWith('vertical');
  });

  // Two shapes have nothing between them to redistribute, so the control would
  // be a no-op rather than an error — better to show it as unavailable.
  it('disables distribute below three selected shapes', () => {
    setup({ selectedCount: 2 });

    expect(screen.getByRole('button', { name: 'Distribute horizontally' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Distribute vertically' })).toBeDisabled();
    // Align still works with two.
    expect(screen.getByRole('button', { name: 'Align left edges' })).toBeEnabled();
  });

  it('enables distribute at three', () => {
    setup({ selectedCount: 3 });

    expect(screen.getByRole('button', { name: 'Distribute horizontally' })).toBeEnabled();
  });

  it('disables everything when the editor is disabled', () => {
    setup({ disabled: true });

    expect(screen.getByRole('button', { name: 'Align left edges' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Distribute horizontally' })).toBeDisabled();
  });
});
