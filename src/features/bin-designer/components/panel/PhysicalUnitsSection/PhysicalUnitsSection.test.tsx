import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhysicalUnitsSection } from './PhysicalUnitsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('PhysicalUnitsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders unit inputs', () => {
    render(<PhysicalUnitsSection />);
    expect(screen.getByLabelText('Grid unit')).toBeInTheDocument();
    expect(screen.getByLabelText('Height unit')).toBeInTheDocument();
  });
});
