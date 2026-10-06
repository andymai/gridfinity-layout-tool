import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LidTextRotation } from './LidTextRotation';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('LidTextRotation', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        surfaceText: { lidText: 'Cables' },
      },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('offers the four quarter turns with 0° selected by default', () => {
    render(<LidTextRotation />);
    const group = screen.getByRole('radiogroup', { name: 'Rotation' });
    expect(group).toBeInTheDocument();
    for (const label of ['0°', '90°', '180°', '270°']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('radio', { name: '0°' })).toBeChecked();
  });

  it('writes the picked turn and keeps the caption', () => {
    render(<LidTextRotation />);
    fireEvent.click(screen.getByRole('radio', { name: '90°' }));
    expect(useDesignerStore.getState().params.surfaceText).toEqual({
      lidText: 'Cables',
      lidTextRotation: 90,
    });
    expect(screen.getByRole('radio', { name: '90°' })).toBeChecked();
  });

  it('drops the key again at 0° so the design serializes as before', () => {
    render(<LidTextRotation />);
    fireEvent.click(screen.getByRole('radio', { name: '270°' }));
    fireEvent.click(screen.getByRole('radio', { name: '0°' }));
    expect(useDesignerStore.getState().params.surfaceText).toEqual({ lidText: 'Cables' });
  });
});
