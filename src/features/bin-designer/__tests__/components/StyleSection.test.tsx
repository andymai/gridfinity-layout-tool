import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StyleSection } from '../../components/parameters/StyleSection';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';

describe('StyleSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'standard' },
    });
  });

  it('renders all 5 style options', () => {
    render(<StyleSection />);

    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Lite')).toBeInTheDocument();
    expect(screen.getByText('Solid')).toBeInTheDocument();
    expect(screen.getByText('Vase')).toBeInTheDocument();
    expect(screen.getByText('Rugged')).toBeInTheDocument();
  });

  it('shows wall thickness for each style', () => {
    render(<StyleSection />);

    // Wall thicknesses per spec: d_wall=0.95mm (standard), 0.65mm (lite)
    expect(screen.getByText('0.95mm wall')).toBeInTheDocument();
    expect(screen.getByText('0.65mm wall')).toBeInTheDocument();
    expect(screen.getByText('1.6mm wall')).toBeInTheDocument();
    expect(screen.getByText('0.4mm wall')).toBeInTheDocument();
    expect(screen.getByText('2mm wall')).toBeInTheDocument();
  });

  it('highlights the currently selected style', () => {
    render(<StyleSection />);

    const standardBtn = screen.getByText('Standard').closest('button');
    expect(standardBtn).toHaveAttribute('aria-pressed', 'true');

    const liteBtn = screen.getByText('Lite').closest('button');
    expect(liteBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking a style updates the store', () => {
    render(<StyleSection />);

    fireEvent.click(screen.getByText('Rugged').closest('button')!);

    expect(useDesignerStore.getState().params.style).toBe('rugged');
  });

  it('shows description for each style', () => {
    render(<StyleSection />);

    expect(screen.getByText('Default balance of strength and material')).toBeInTheDocument();
    expect(screen.getByText('Single wall, no interior features')).toBeInTheDocument();
  });
});
