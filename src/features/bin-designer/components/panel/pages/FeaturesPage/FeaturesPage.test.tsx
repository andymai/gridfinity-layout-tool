import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { FeaturesPage } from './FeaturesPage';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLabsStore } from '@/core/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

function setSlideFlag(enabled: boolean): void {
  useLabsStore.setState((s) => ({
    preferences: {
      ...s.preferences,
      enabledFeatures: { ...s.preferences.enabledFeatures, sliding_tray: enabled },
    },
  }));
}

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('FeaturesPage', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
    setSlideFlag(false);
  });

  it('composes its sections with their help targets', () => {
    const { container } = render(<FeaturesPage />);
    expect(container.querySelector('[data-help-target="bd-lid"]'), 'bd-lid').not.toBeNull();
    expect(container.querySelector('[data-help-target="bd-handles"]'), 'bd-handles').not.toBeNull();
    expect(
      container.querySelector('[data-help-target="bd-wall-cutouts"]'),
      'bd-wall-cutouts'
    ).not.toBeNull();
  });

  it('renders no slide-tray section (not even an empty band) while the flag is off', () => {
    setSlideFlag(false);
    const { container } = render(<FeaturesPage />);
    expect(container.querySelector('[data-help-target="bd-slide-tray"]')).toBeNull();
  });

  it('renders the slide-tray section with its help target when the flag is on', () => {
    setSlideFlag(true);
    const { container } = render(<FeaturesPage />);
    expect(container.querySelector('[data-help-target="bd-slide-tray"]')).not.toBeNull();
  });
});
