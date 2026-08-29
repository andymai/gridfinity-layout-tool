import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StylePage } from './StylePage';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('StylePage', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('composes its sections with their help targets', () => {
    const { container } = render(<StylePage />);
    expect(container.querySelector('[data-help-target="bd-type"]'), 'bd-type').not.toBeNull();
    expect(container.querySelector('[data-help-target="bd-colors"]'), 'bd-colors').not.toBeNull();
  });
});
