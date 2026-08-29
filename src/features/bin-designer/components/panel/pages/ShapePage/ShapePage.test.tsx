import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ShapePage } from './ShapePage';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('ShapePage', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('composes its sections with their help targets', () => {
    const { container } = render(<ShapePage />);
    expect(
      container.querySelector('[data-help-target="bd-dimensions"]'),
      'bd-dimensions'
    ).not.toBeNull();
    expect(
      container.querySelector('[data-help-target="bd-overhang"]'),
      'bd-overhang'
    ).not.toBeNull();
    expect(container.querySelector('[data-help-target="bd-shape"]'), 'bd-shape').not.toBeNull();
    expect(container.querySelector('[data-help-target="bd-walls"]'), 'bd-walls').not.toBeNull();
    expect(container.querySelector('[data-help-target="bd-base"]'), 'bd-base').not.toBeNull();
  });
});
