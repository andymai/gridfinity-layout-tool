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
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        featureColors: { body: '#3b82f6', lip: '#ef4444', labelTab: '#22c55e' },
      },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders body, lip, and label tab zone rows', () => {
    render(<ColorsSection />);
    expect(screen.getByText('Body')).toBeDefined();
    expect(screen.getByText('Stacking Lip')).toBeDefined();
    expect(screen.getByText('Label Tab')).toBeDefined();
  });

  it('hides lip row when stacking lip is off', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        featureColors: { body: '#3b82f6', lip: '#3b82f6', labelTab: '#3b82f6' },
      },
    });

    render(<ColorsSection />);
    expect(screen.queryByText('Stacking Lip')).toBeNull();
  });

  it('hides label tab row when labels are off', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
        featureColors: { body: '#3b82f6', lip: '#3b82f6', labelTab: '#3b82f6' },
      },
    });

    render(<ColorsSection />);
    expect(screen.queryByText('Label Tab')).toBeNull();
  });

  it('always shows body row', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
        featureColors: { body: '#3b82f6', lip: '#3b82f6', labelTab: '#3b82f6' },
      },
    });

    render(<ColorsSection />);
    expect(screen.getByText('Body')).toBeDefined();
  });
});
