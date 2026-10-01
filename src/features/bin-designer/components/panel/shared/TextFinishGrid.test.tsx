import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextFinishGrid } from './TextFinishGrid';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { TextMode } from '@/features/bin-designer/types';

const MODES: readonly TextMode[] = ['engrave', 'emboss', 'through-cut'];

function setMultiColor(enabled: boolean): void {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      featureColors: { ...DEFAULT_BIN_PARAMS.featureColors, enabled },
    },
  });
}

describe('TextFinishGrid', () => {
  beforeEach(() => setMultiColor(false));

  it('adds Flat for a multi-color design and reports the pick', () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <TextFinishGrid modes={MODES} value="engrave" onChange={onChange} />
    );
    expect(screen.queryByRole('radio', { name: 'Flat' })).toBeNull();
    unmount();

    setMultiColor(true);
    render(<TextFinishGrid modes={MODES} value="engrave" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Flat' }));
    expect(onChange).toHaveBeenCalledWith('flat');
  });

  it('ignores a click on the finish already shown', () => {
    const onChange = vi.fn();
    render(<TextFinishGrid modes={MODES} value="engrave" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Engrave' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
