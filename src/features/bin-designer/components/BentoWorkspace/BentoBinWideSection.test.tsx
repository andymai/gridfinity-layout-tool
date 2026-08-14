import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoBinWideSection } from './BentoBinWideSection';
import { useDesignerStore } from '@/features/bin-designer/store/designer';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('BentoBinWideSection', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('renders the wall thickness and divider height controls', () => {
    render(<BentoBinWideSection />);

    expect(screen.getByText('binDesigner.bento.binWideTitle')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.wallThickness')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.dividerHeight')).toBeInTheDocument();
  });

  it('writes the picked wall thickness to the compartment config', () => {
    render(<BentoBinWideSection />);

    // The i18n echo mock drops interpolation, so every tick shares one aria
    // label (and an aria-label beats text content for the accessible name) —
    // the rendered number is the only thing that tells the ticks apart.
    fireEvent.click(screen.getByText('0.4'));

    expect(useDesignerStore.getState().params.compartments.thickness).toBe(0.4);
  });

  it('keeps the rest of the compartment config when thickness changes', () => {
    useDesignerStore.getState().setCompartmentGrid(4, 3);
    const before = useDesignerStore.getState().params.compartments;
    render(<BentoBinWideSection />);

    fireEvent.click(screen.getByText('2.4'));

    const after = useDesignerStore.getState().params.compartments;
    expect(after.thickness).toBe(2.4);
    expect(after.cols).toBe(before.cols);
    expect(after.rows).toBe(before.rows);
    expect(after.cells).toEqual(before.cells);
  });
});
