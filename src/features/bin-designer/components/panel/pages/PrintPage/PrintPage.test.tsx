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
});
