import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { WallsSection } from './WallsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('WallsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders wall thickness slider', () => {
    const { container } = render(<WallsSection />);
    expect(container.querySelector('div[role="slider"]')).toBeInTheDocument();
  });
});
