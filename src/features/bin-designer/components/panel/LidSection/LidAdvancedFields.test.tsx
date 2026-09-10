import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LidAdvancedFields } from './LidAdvancedFields';
import { useLidSection } from './useLidSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

function Harness() {
  const { state, handlers, t } = useLidSection();
  return <LidAdvancedFields state={state} handlers={handlers} t={t} />;
}

function seed(lid: Partial<typeof DEFAULT_BIN_PARAMS.lid> = {}) {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, ...lid } },
    ui: { ...DEFAULT_UI_STATE },
  });
}

describe('LidAdvancedFields', () => {
  beforeEach(() => {
    seed();
  });

  it('reveals the plate thickness and seam relief behind the fine-tuning disclosure', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /fine tuning/i }));
    expect(screen.getByLabelText('Lid top plate thickness in millimeters')).toBeInTheDocument();
    expect(screen.getByText('Relieve interior at the lid seam')).toBeInTheDocument();
  });

  it('shows the magnet fields only for a magnetic lid', () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /fine tuning/i }));
    expect(screen.queryByLabelText('Retention magnet diameter in millimeters')).toBeNull();
    unmount();

    seed({ attachment: 'magnetic' });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /fine tuning/i }));
    expect(screen.getByLabelText('Retention magnet diameter in millimeters')).toBeInTheDocument();
  });
});
