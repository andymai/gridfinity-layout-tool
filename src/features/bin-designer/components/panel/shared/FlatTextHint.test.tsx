import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlatTextHint } from './FlatTextHint';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

function setMultiColor(enabled: boolean): void {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      featureColors: { ...DEFAULT_BIN_PARAMS.featureColors, enabled },
    },
    ui: { ...DEFAULT_UI_STATE },
  });
}

describe('FlatTextHint', () => {
  beforeEach(() => setMultiColor(false));

  it('asks for multi-color while the design prints in one color', () => {
    render(<FlatTextHint />);
    expect(screen.getByText(/Turn on multi-color/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colors' })).toBeInTheDocument();
  });

  it('asks for a contrasting text color once multi-color is on', () => {
    setMultiColor(true);
    render(<FlatTextHint />);
    expect(screen.getByText(/contrasts/)).toBeInTheDocument();
    expect(screen.queryByText(/Turn on multi-color/)).not.toBeInTheDocument();
  });
});
