import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InteriorSection } from './InteriorSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('InteriorSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders style selector', () => {
    render(<InteriorSection />);
    expect(screen.getByText('Fixed')).toBeInTheDocument();
    expect(screen.getByText('Removable')).toBeInTheDocument();
  });
});
