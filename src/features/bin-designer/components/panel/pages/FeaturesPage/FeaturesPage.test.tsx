import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { FeaturesPage } from './FeaturesPage';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('FeaturesPage', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('composes its sections with their help targets', () => {
    const { container } = render(<FeaturesPage />);
    expect(container.querySelector('[data-help-target="bd-lid"]'), 'bd-lid').not.toBeNull();
    expect(container.querySelector('[data-help-target="bd-handles"]'), 'bd-handles').not.toBeNull();
    expect(
      container.querySelector('[data-help-target="bd-wall-cutouts"]'),
      'bd-wall-cutouts'
    ).not.toBeNull();
    expect(
      container.querySelector('[data-help-target="bd-slide-tray"]'),
      'bd-slide-tray'
    ).not.toBeNull();
  });
});
