import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoCompartmentColorControls } from './BentoCompartmentColorControls';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { DEFAULT_CUTOUT_COLOR } from '@/features/bin-designer/constants/defaults';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const compartments = () => useDesignerStore.getState().params.compartments;

const segment = (choice: string) =>
  screen.getByRole('button', { name: `binDesigner.cutouts.color.${choice}` });

describe('BentoCompartmentColorControls', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().setCompartmentGrid(2, 1);
  });

  it('offers every surface while uncoloured, with Off pressed and no note', () => {
    render(<BentoCompartmentColorControls compartmentId={0} />);

    expect(segment('off')).toHaveAttribute('aria-pressed', 'true');
    expect(segment('floor')).toHaveAttribute('aria-pressed', 'false');
    expect(segment('floorAndWalls')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('binDesigner.bento.color.note')).not.toBeInTheDocument();
  });

  it('colours the compartment when a surface is picked', () => {
    render(<BentoCompartmentColorControls compartmentId={0} />);

    fireEvent.click(segment('floorAndWalls'));

    expect(compartments().compartmentColors?.[0]).toBe(DEFAULT_CUTOUT_COLOR);
    expect(compartments().compartmentColorScopes?.[0]).toBe('floorAndWalls');
    expect(segment('floorAndWalls')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('binDesigner.bento.color.note')).toBeInTheDocument();
  });

  it('colours on the default surface too, which stores no scope', () => {
    render(<BentoCompartmentColorControls compartmentId={0} />);

    fireEvent.click(segment('floor'));

    expect(compartments().compartmentColors?.[0]).toBe(DEFAULT_CUTOUT_COLOR);
    expect(compartments().compartmentColorScopes).toBeUndefined();
  });

  it('turns the colour on in one undo step', () => {
    render(<BentoCompartmentColorControls compartmentId={0} />);

    fireEvent.click(segment('floorAndWalls'));
    useDesignerStore.getState().undo();

    expect(compartments().compartmentColors).toBeUndefined();
    expect(compartments().compartmentColorScopes).toBeUndefined();
  });

  it('clears the colour on Off', () => {
    useDesignerStore.getState().setCompartmentColor(0, '#ff0000');
    render(<BentoCompartmentColorControls compartmentId={0} />);

    fireEvent.click(segment('off'));

    expect(compartments().compartmentColors).toBeUndefined();
  });

  it('switches the surface of a coloured compartment and keeps its colour', () => {
    useDesignerStore.getState().setCompartmentColor(0, '#ff0000');
    render(<BentoCompartmentColorControls compartmentId={0} />);

    fireEvent.click(segment('floorAndWalls'));

    expect(compartments().compartmentColors?.[0]).toBe('#ff0000');
    expect(compartments().compartmentColorScopes?.[0]).toBe('floorAndWalls');
  });

  it('does not regenerate geometry — colour is resolved at paint time', () => {
    const epoch = useDesignerStore.getState().generation.epoch;
    render(<BentoCompartmentColorControls compartmentId={0} />);

    fireEvent.click(segment('floorAndWalls'));

    expect(useDesignerStore.getState().generation.epoch).toBe(epoch);
  });

  it('edits only the compartment it was given', () => {
    render(<BentoCompartmentColorControls compartmentId={1} />);

    fireEvent.click(segment('floorAndWalls'));

    expect(compartments().compartmentColors?.[0]).toBeNull();
    expect(compartments().compartmentColors?.[1]).toBe(DEFAULT_CUTOUT_COLOR);
  });
});
