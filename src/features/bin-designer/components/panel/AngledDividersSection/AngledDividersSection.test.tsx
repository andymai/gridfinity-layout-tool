import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AngledDividersSection } from './AngledDividersSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLabsStore } from '@/core/store/labs';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('AngledDividersSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS });
    useLabsStore.getState().enableFeature('angled_dividers');
  });

  it('renders nothing when the labs flag is off', () => {
    useLabsStore.getState().disableFeature('angled_dividers');
    const { container } = render(<AngledDividersSection />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the section title when at least one interior divider exists', () => {
    useDesignerStore.setState((s) => ({
      params: {
        ...s.params,
        compartments: { ...s.params.compartments, cols: 1, rows: 2, cells: [0, 1] },
      },
    }));
    render(<AngledDividersSection />);
    expect(screen.getAllByText('Diagonal dividers').length).toBeGreaterThanOrEqual(1);
  });

  it('renders only the section header for a 1×1 layout (no eligible rows)', () => {
    useDesignerStore.setState((s) => ({
      params: {
        ...s.params,
        compartments: { ...s.params.compartments, cols: 1, rows: 1, cells: [0] },
      },
    }));
    render(<AngledDividersSection />);
    expect(screen.getAllByText('Diagonal dividers').length).toBeGreaterThanOrEqual(1);
    // No divider rows for a 1×1.
    expect(screen.queryByText(/Comp 1 ↔ Comp 2/)).not.toBeInTheDocument();
  });
});
