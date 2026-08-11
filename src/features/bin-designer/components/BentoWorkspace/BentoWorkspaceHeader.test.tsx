import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoWorkspaceHeader } from './BentoWorkspaceHeader';
import type { CompartmentGridApi } from '../CompartmentEditor/useCompartmentGrid';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function makeGrid(overrides: Partial<CompartmentGridApi> = {}): CompartmentGridApi {
  return {
    cols: 3,
    rows: 2,
    compartmentCount: 6,
    hasMergedCompartments: false,
    applyGrid: vi.fn(),
    stepGrid: vi.fn(),
    handleReset: vi.fn(),
    ...overrides,
  } as unknown as CompartmentGridApi;
}

describe('BentoWorkspaceHeader', () => {
  it('shows the compartment count', () => {
    render(<BentoWorkspaceHeader grid={makeGrid()} onClose={vi.fn()} />);

    expect(screen.getByText(/6/)).toBeInTheDocument();
  });

  it('closes the workspace from Done', () => {
    const onClose = vi.fn();
    render(<BentoWorkspaceHeader grid={makeGrid()} onClose={onClose} />);

    fireEvent.click(screen.getByText('common.done'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers reset only once compartments have been merged', () => {
    const { rerender } = render(<BentoWorkspaceHeader grid={makeGrid()} onClose={vi.fn()} />);
    expect(screen.queryByText('common.reset')).not.toBeInTheDocument();

    rerender(
      <BentoWorkspaceHeader grid={makeGrid({ hasMergedCompartments: true })} onClose={vi.fn()} />
    );
    expect(screen.getByText('common.reset')).toBeInTheDocument();
  });

  it('resets the layout through the shared grid model', () => {
    const handleReset = vi.fn();
    render(
      <BentoWorkspaceHeader
        grid={makeGrid({ hasMergedCompartments: true, handleReset })}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('common.reset'));

    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('exposes column and row steppers', () => {
    render(<BentoWorkspaceHeader grid={makeGrid()} onClose={vi.fn()} />);

    expect(screen.getAllByLabelText('binDesigner.columns').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('binDesigner.rows').length).toBeGreaterThan(0);
  });
});
