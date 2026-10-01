import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextColorControl } from './TextColorControl';
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

describe('TextColorControl', () => {
  beforeEach(() => setMultiColor(false));

  it('shows the Text colour swatch for any finish once multi-color is on', () => {
    const { unmount } = render(<TextColorControl flat={false} />);
    expect(screen.queryByRole('button', { name: /^Text color:/ })).toBeNull();
    unmount();

    setMultiColor(true);
    render(<TextColorControl flat={false} />);
    expect(screen.getByRole('button', { name: /^Text color:/ })).toBeInTheDocument();
  });

  it('turns multi-color on in one click for flat text', () => {
    render(<TextColorControl flat />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on Multi-Color' }));
    expect(useDesignerStore.getState().params.featureColors.enabled).toBe(true);
    expect(screen.getByRole('button', { name: /^Text color:/ })).toBeInTheDocument();
  });
});
