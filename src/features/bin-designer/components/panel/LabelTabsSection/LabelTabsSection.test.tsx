import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LabelTabsSection } from './LabelTabsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('LabelTabsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders label tabs toggle', () => {
    render(<LabelTabsSection />);
    // There will be 2 matches: one for CollapsibleSection title, one for FeatureToggle label
    const labelTabs = screen.getAllByText('Label tabs');
    expect(labelTabs.length).toBeGreaterThanOrEqual(1);
  });
});
