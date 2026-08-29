import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DependencyHint } from './DependencyHint';

describe('DependencyHint', () => {
  it('names the reason and fires the action', () => {
    const onAction = vi.fn();
    render(
      <DependencyHint reason="Needs a stacking lip" actionLabel="Enable" onAction={onAction} />
    );
    expect(screen.getByText('Needs a stacking lip')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
