import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
    fireEvent.click(screen.getByRole('button', { name: /About Lid thickness/ }));
    expect(screen.getByText(/Hinged lids start at 3\.2 mm/)).toBeInTheDocument();
  });

  it('keeps the hinge floor where it is when extra height lifts the lid', () => {
    seed({ attachment: 'hinge', extraHeightMm: 20, topThicknessMm: 0.8 });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /fine tuning/i }));
    const field = screen.getByLabelText('Lid top plate thickness in millimeters');
    expect(field).toHaveAttribute('min', '3.2');
    expect(field).toHaveValue(3.2);
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

  describe('retention magnet diameter', () => {
    const magnet = (diameter: number) => ({
      ...DEFAULT_BIN_PARAMS.lid.retentionMagnet,
      diameter,
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    function openMagnetFields(): void {
      render(<Harness />);
      fireEvent.click(screen.getByRole('button', { name: /fine tuning/i }));
    }

    it('keeps a typed 6.45mm and shows it with both decimals', () => {
      seed({ attachment: 'magnetic' });
      openMagnetFields();
      const field = screen.getByLabelText('Retention magnet diameter in millimeters');
      fireEvent.change(field, { target: { value: '6.45' } });
      fireEvent.blur(field);
      expect(useDesignerStore.getState().params.lid.retentionMagnet.diameter).toBe(6.45);
      expect(field).toHaveValue(6.45);
    });

    it('snaps a typed diameter between the 0.05mm steps, as the slider controls do', () => {
      seed({ attachment: 'magnetic' });
      openMagnetFields();
      const field = screen.getByLabelText('Retention magnet diameter in millimeters');
      fireEvent.change(field, { target: { value: '6.43' } });
      fireEvent.blur(field);
      expect(useDesignerStore.getState().params.lid.retentionMagnet.diameter).toBe(6.45);
    });

    it('steps the diameter by 0.05mm without float noise', () => {
      vi.useFakeTimers();
      seed({ attachment: 'magnetic', retentionMagnet: magnet(6.1) });
      openMagnetFields();
      fireEvent.click(
        screen.getByRole('button', { name: 'Increase Retention magnet diameter in millimeters' })
      );
      act(() => {
        vi.runOnlyPendingTimers();
      });
      expect(useDesignerStore.getState().params.lid.retentionMagnet.diameter).toBe(6.15);
    });

    it('keeps the 0.5mm step on the depth', () => {
      vi.useFakeTimers();
      seed({ attachment: 'magnetic' });
      openMagnetFields();
      fireEvent.click(
        screen.getByRole('button', { name: 'Increase Retention magnet depth in millimeters' })
      );
      act(() => {
        vi.runOnlyPendingTimers();
      });
      expect(useDesignerStore.getState().params.lid.retentionMagnet.depth).toBe(
        DEFAULT_BIN_PARAMS.lid.retentionMagnet.depth + 0.5
      );
      expect(useDesignerStore.getState().params.lid.retentionMagnet.diameter).toBe(
        DEFAULT_BIN_PARAMS.lid.retentionMagnet.diameter
      );
    });
  });
});
