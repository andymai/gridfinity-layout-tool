import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlatTextClashWarning } from './FlatTextClashWarning';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

const LIGHT = '#d4d8dc';

function setWallText(text: string): void {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode: 'flat' },
      surfaceText: { walls: { front: 'AB' } },
      featureColors: { ...DEFAULT_BIN_PARAMS.featureColors, enabled: true, body: LIGHT, text },
    },
  });
}

describe('FlatTextClashWarning', () => {
  beforeEach(() => setWallText(LIGHT));

  it('warns when flat letters match their surface and fixes the colour in one click', () => {
    render(<FlatTextClashWarning />);
    expect(screen.getByText(/won't show/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use a contrasting color' }));
    expect(useDesignerStore.getState().params.featureColors.text).not.toBe(LIGHT);
    expect(screen.queryByText(/won't show/)).toBeNull();
  });

  it('stays quiet when the colours contrast, or for another host', () => {
    const { unmount } = render(<FlatTextClashWarning surfaces={['lid']} />);
    expect(screen.queryByText(/won't show/)).toBeNull();
    unmount();

    setWallText('#1a1a1a');
    render(<FlatTextClashWarning />);
    expect(screen.queryByText(/won't show/)).toBeNull();
  });
});
