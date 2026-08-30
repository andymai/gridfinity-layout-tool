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

  it('hides typography until the design carries text', () => {
    const { container } = render(<StylePage />);
    expect(container.querySelector('[data-help-target="bd-type"]')).toBeNull();
    // The rest of Style still renders.
    expect(container.querySelector('[data-help-target="bd-colors"]')).not.toBeNull();
  });

  it('composes its sections with their help targets once text exists', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: { ...DEFAULT_BIN_PARAMS.compartments, compartmentTexts: ['A'] },
      },
    });
    const { container } = render(<StylePage />);
    for (const target of ['bd-type', 'bd-colors', 'bd-wall-style', 'bd-floor-pattern']) {
      expect(container.querySelector(`[data-help-target="${target}"]`), target).not.toBeNull();
    }
  });
});
