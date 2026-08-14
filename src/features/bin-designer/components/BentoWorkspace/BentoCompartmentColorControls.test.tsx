import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoCompartmentColorControls } from './BentoCompartmentColorControls';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { DEFAULT_CUTOUT_COLOR } from '@/features/bin-designer/constants/defaults';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const compartments = () => useDesignerStore.getState().params.compartments;

describe('BentoCompartmentColorControls', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().setCompartmentGrid(2, 1);
  });

  it('offers only the toggle while the compartment is uncoloured', () => {
    render(<BentoCompartmentColorControls compartmentId={0} />);

    expect(screen.getByText('binDesigner.bento.color.enable')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.color.floor')).not.toBeInTheDocument();
  });

  it('colours the compartment on toggle and reveals the surface selector', () => {
    render(<BentoCompartmentColorControls compartmentId={0} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'binDesigner.bento.color.enable' }));

    expect(compartments().compartmentColors?.[0]).toBe(DEFAULT_CUTOUT_COLOR);
    expect(screen.getByText('binDesigner.cutouts.color.floorAndWalls')).toBeInTheDocument();
  });

  it('clears the colour on toggle off', () => {
    useDesignerStore.getState().setCompartmentColor(0, '#ff0000');
    render(<BentoCompartmentColorControls compartmentId={0} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'binDesigner.bento.color.enable' }));

    expect(compartments().compartmentColors).toBeUndefined();
  });

  it('writes the picked surface scope', () => {
    useDesignerStore.getState().setCompartmentColor(0, '#ff0000');
    render(<BentoCompartmentColorControls compartmentId={0} />);

    fireEvent.click(screen.getByText('binDesigner.cutouts.color.floorAndWalls'));

    expect(compartments().compartmentColorScopes?.[0]).toBe('floorAndWalls');
  });

  it('does not regenerate geometry — colour is resolved at paint time', () => {
    useDesignerStore.getState().setCompartmentColor(0, '#ff0000');
    const epoch = useDesignerStore.getState().generation.epoch;
    render(<BentoCompartmentColorControls compartmentId={0} />);

    fireEvent.click(screen.getByText('binDesigner.cutouts.color.floorAndWalls'));

    expect(useDesignerStore.getState().generation.epoch).toBe(epoch);
  });

  it('edits only the compartment it was given', () => {
    render(<BentoCompartmentColorControls compartmentId={1} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'binDesigner.bento.color.enable' }));

    expect(compartments().compartmentColors?.[0]).toBeNull();
    expect(compartments().compartmentColors?.[1]).toBe(DEFAULT_CUTOUT_COLOR);
  });
});
