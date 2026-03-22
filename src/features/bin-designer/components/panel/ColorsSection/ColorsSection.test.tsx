import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ColorsSection } from './ColorsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('ColorsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        featureColors: { body: 'slot1', lip: 'slot2', labelTab: 'slot1' },
      },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders body, lip, and label tab dropdowns', () => {
    render(<ColorsSection />);
    expect(screen.getByText('Body')).toBeDefined();
    expect(screen.getByText('Stacking Lip')).toBeDefined();
    expect(screen.getByText('Label Tab')).toBeDefined();
  });

  it('disables lip dropdown when stacking lip is off', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        featureColors: { body: 'slot1', lip: 'slot1', labelTab: 'slot1' },
      },
    });

    render(<ColorsSection />);
    const selects = screen.getAllByRole('combobox');
    // Lip dropdown (second select) should be disabled
    expect(selects[1].hasAttribute('disabled')).toBe(true);
  });

  it('disables label tab dropdown when labels are off', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
        featureColors: { body: 'slot1', lip: 'slot1', labelTab: 'slot1' },
      },
    });

    render(<ColorsSection />);
    const selects = screen.getAllByRole('combobox');
    // Label Tab dropdown (third select) should be disabled
    expect(selects[2].hasAttribute('disabled')).toBe(true);
  });
});
