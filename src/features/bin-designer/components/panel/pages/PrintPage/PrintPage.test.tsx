import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PrintPage } from './PrintPage';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('PrintPage', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('composes its sections with their help targets', () => {
    const { container } = render(<PrintPage />);
    expect(
      container.querySelector('[data-help-target="bd-physical-units"]'),
      'bd-physical-units'
    ).not.toBeNull();
  });

  it('warns instead of offering a split when a slanted bin is too long for the bed', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 8,
        depth: 8,
        height: 6,
        slant: { angleDeg: 45, side: 'right' },
      },
    });
    const { container } = render(<PrintPage />);
    expect(container.textContent).toContain('binDesigner.printFit.slantTooLarge');
    expect(container.textContent).not.toContain('binDesigner.printFit.fits');
  });

  it('offers the split switch, on, for a bin that fits', () => {
    const { getByRole, container } = render(<PrintPage />);
    expect(container.textContent).toContain('binDesigner.printFit.fits');
    expect(getByRole('switch', { name: 'binDesigner.splitToFitBed' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(container.textContent).toContain('binDesigner.splitToFitBedHint');
  });

  it('splits an oversized bin into pieces with its connectors while the switch is on', () => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 } });
    const { container, getByRole } = render(<PrintPage />);
    expect(container.textContent).toContain('binDesigner.splitAxisInfo');
    expect(getByRole('switch', { name: 'binDesigner.splitConnectors' })).toBeInTheDocument();
  });

  it('says an oversized bin exports in one piece once splitting is off', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3, splitToFitBed: false },
    });
    const { container, getByRole, queryByRole } = render(<PrintPage />);
    expect(container.textContent).toContain('binDesigner.printFit.keptWhole');
    expect(container.textContent).not.toContain('binDesigner.splitAxisInfo');
    expect(queryByRole('switch', { name: 'binDesigner.splitConnectors' })).toBeNull();
    expect(getByRole('switch', { name: 'binDesigner.splitToFitBed' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('says a long bin fits laid diagonally instead of offering a split', () => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, width: 1.5, depth: 7 } });
    const { container } = render(<PrintPage />);
    expect(container.textContent).toContain('binDesigner.printFit.fitsDiagonally');
  });
});
