import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InteriorFilletSection } from './InteriorFilletSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('InteriorFilletSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS }, ui: { ...DEFAULT_UI_STATE } });
  });

  it('renders the toggle, off by default', () => {
    render(<InteriorFilletSection />);
    expect(screen.getAllByText('Interior fillet').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Radius')).toBeNull();
  });

  it('shows the radius slider when on', () => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, interiorFilletMm: 3 } });
    render(<InteriorFilletSection />);
    expect(screen.getByText('Radius')).toBeDefined();
  });

  it('explains a radius the smallest compartments cannot reach', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 1,
        depth: 1,
        interiorFilletMm: 12,
        compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      },
    });
    render(<InteriorFilletSection />);
    expect(
      screen.getByText('Compartments too small for this radius round as far as they fit.')
    ).toBeDefined();
  });
});
