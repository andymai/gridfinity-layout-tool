import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ColorZoneSelectionEditor } from './ColorZoneSelectionEditor';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';

describe('ColorZoneSelectionEditor', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        featureColors: { ...DEFAULT_FEATURE_COLOR_CONFIG, enabled: true, body: '#aabbcc' },
      },
    });
  });

  it('renders the inline color picker for the zone (hex input present)', () => {
    render(<ColorZoneSelectionEditor zone="body" />);
    // ColorPicker renders inputs (hex text + native picker) seeded with the zone color.
    expect(screen.getAllByDisplayValue('#aabbcc').length).toBeGreaterThan(0);
  });
});
