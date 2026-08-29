import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { InteriorPage } from './InteriorPage';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('InteriorPage', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('composes its sections with their help targets', () => {
    const { container } = render(<InteriorPage />);
    expect(
      container.querySelector('[data-help-target="bd-interior"]'),
      'bd-interior'
    ).not.toBeNull();
    expect(
      container.querySelector('[data-help-target="bd-label-tabs"]'),
      'bd-label-tabs'
    ).not.toBeNull();
    expect(container.querySelector('[data-help-target="bd-scoop"]'), 'bd-scoop').not.toBeNull();
    expect(
      container.querySelector('[data-help-target="bd-knife-rest"]'),
      'bd-knife-rest'
    ).not.toBeNull();
  });
});
