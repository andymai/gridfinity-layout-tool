import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { WallThicknessSection } from './WallThicknessSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('WallThicknessSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders the wall thickness slider', () => {
    const { container } = render(<WallThicknessSection />);
    expect(container.querySelector('div[role="slider"]')).toBeInTheDocument();
  });
});
