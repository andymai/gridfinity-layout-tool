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

  it('floors the plate thickness on a hinged lid and says why', () => {
    seed({ attachment: 'hinge', topThicknessMm: 0.8 });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /fine tuning/i }));
    const field = screen.getByLabelText('Lid top plate thickness in millimeters');
    expect(field).toHaveValue(3.2);
    expect(field).toHaveAttribute('min', '3.2');
    expect(screen.getByText(/Hinged lids start at 3\.2 mm/)).toBeInTheDocument();
  });

  it('pins the stepper at the floor when extra height lifts it past the persisted maximum', () => {
    seed({ attachment: 'hinge', extraHeightMm: 20, topThicknessMm: 0.8 });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /fine tuning/i }));
    const field = screen.getByLabelText('Lid top plate thickness in millimeters');
    const min = Number(field.getAttribute('min'));
    expect(min).toBeGreaterThan(10);
    expect(Number(field.getAttribute('max'))).toBe(min);
    expect(field).toHaveValue(min);
  });

  it('shares the hinge floor with a tray, so the floor knob cannot undercut the plate', () => {
    seed({
      attachment: 'hinge',
      topThicknessMm: 0.8,
      tray: { enabled: true, depthMm: 1, wallMm: 2 },
    });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /fine tuning/i }));
    const field = screen.getByLabelText('Material left under the tray recess, in millimeters');
    expect(field).toHaveAttribute('min', '2.2');
    expect(field).toHaveValue(2.2);
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
