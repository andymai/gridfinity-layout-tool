import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { LabelPlatesControls } from './LabelPlatesControls';

function setSocketModeParams() {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 1,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'socket', depth: 14 },
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 2,
        rows: 1,
        cells: [0, 1],
        compartmentTexts: ['SCREWS'],
      },
    },
  });
}

describe('LabelPlatesControls', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
  });

  it('renders nothing outside socket mode', () => {
    const { container } = render(<LabelPlatesControls />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists derived plates with width and text (blank fallback)', () => {
    setSocketModeParams();
    render(<LabelPlatesControls />);
    expect(screen.getByText('Label plates')).toBeInTheDocument();
    expect(screen.getByText('SCREWS')).toBeInTheDocument();
    expect(screen.getAllByText('1U')).toHaveLength(2);
    expect(screen.getByText('(blank)')).toBeInTheDocument();
  });

  it('disables preview/export when no bridge is active', () => {
    setSocketModeParams();
    render(<LabelPlatesControls />);
    expect(screen.getByRole('button', { name: 'Preview plates' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export plates' })).toBeDisabled();
  });
});
