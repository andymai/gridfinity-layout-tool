import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloorTextSection } from './FloorTextSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('FloorTextSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, surfaceText: { floorText: 'Screws' } },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('opens with saved floor text and offers no through-cut', () => {
    render(<FloorTextSection />);
    expect(screen.getByRole('radio', { name: 'Engrave' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Cut through' })).not.toBeInTheDocument();
  });

  it('writes the turn and drops the key again at 0°', () => {
    render(<FloorTextSection />);
    fireEvent.click(screen.getByRole('radio', { name: '90°' }));
    expect(useDesignerStore.getState().params.surfaceText).toEqual({
      floorText: 'Screws',
      floorTextRotation: 90,
    });
    fireEvent.click(screen.getByRole('radio', { name: '0°' }));
    expect(useDesignerStore.getState().params.surfaceText).toEqual({ floorText: 'Screws' });
  });

  it('is disabled on a slotted bin', () => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, style: 'slotted' } });
    render(<FloorTextSection />);
    expect(screen.getByText('Needs a standard bin with a closed floor.')).toBeInTheDocument();
  });
});
