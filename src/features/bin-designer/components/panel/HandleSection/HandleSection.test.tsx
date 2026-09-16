import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HandleSection } from './HandleSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('HandleSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders handles toggle', () => {
    render(<HandleSection />);
    const labels = screen.getAllByText('Handles');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows side chips and controls when enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true },
      },
    });

    render(<HandleSection />);
    expect(screen.getByText('Front')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
    expect(screen.getByText('Left')).toBeDefined();
    expect(screen.getByText('Right')).toBeDefined();
  });

  it('toggles the chamfer through the store', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true, chamfer: false },
      },
    });
    render(<HandleSection />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Chamfer edges' }));

    expect(useDesignerStore.getState().params.handles.chamfer).toBe(true);
  });

  it('renders the back side chip as off + disabled when a label tab blocks it', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
          // Stored as enabled, but the active label tab blocks the back handle.
          back: { ...DEFAULT_BIN_PARAMS.handles.back, enabled: true },
        },
      },
    });

    render(<HandleSection />);
    const back = screen.getByRole<HTMLInputElement>('switch', { name: 'Back' });
    expect(back.disabled).toBe(true);
    // Must read as off (not an accent-tinted "on"), matching generation which
    // skips back handles while a label tab is active.
    expect(back.getAttribute('aria-checked')).toBe('false');
  });

  it('does not show controls when disabled', () => {
    render(<HandleSection />);
    expect(screen.queryByText('Front')).toBeNull();
  });

  it('shows disabled reason when both slot directions claim every wall', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 20 },
        },
      },
    });

    render(<HandleSection />);
    expect(screen.getByText(/Not available/)).toBeDefined();
  });

  it('disables only the slotted wall pair on a single-axis slotted bin', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
        handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true },
      },
    });

    render(<HandleSection />);
    // X-axis slots groove the left and right walls; front and back stay free.
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Left' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Right' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Front' }).disabled).toBe(false);
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Back' }).disabled).toBe(false);
  });

  it('disables the front and back chips when only Y-axis slots are enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: false, pitch: 20 },
          y: { enabled: true, pitch: 20 },
        },
        handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true },
      },
    });

    render(<HandleSection />);
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Front' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Back' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Left' }).disabled).toBe(false);
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Right' }).disabled).toBe(false);
  });

  it('shows disabled reason for solid bins', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'solid' },
    });

    render(<HandleSection />);
    expect(screen.getByText(/Not available/)).toBeDefined();
  });
});
