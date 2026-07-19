import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { SlotConfigurator } from './SlotConfigurator';

describe('SlotConfigurator', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        slotConfig: {
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      },
    });
  });

  it('renders without crashing', () => {
    render(<SlotConfigurator />);
    expect(screen.getByText(/direction/i)).toBeInTheDocument();
  });

  it('shows direction toggle buttons', () => {
    render(<SlotConfigurator />);
    expect(screen.getByText(/vertical/i)).toBeInTheDocument();
    expect(screen.getByText(/horizontal/i)).toBeInTheDocument();
  });

  it('shows active direction', () => {
    render(<SlotConfigurator />);
    const horizontalButton = screen.getByText(/horizontal/i);
    expect(horizontalButton).toHaveClass('bg-accent');
  });

  it('switches to vertical direction when clicked', () => {
    const setParam = vi.fn();
    useDesignerStore.setState({ setParam });

    render(<SlotConfigurator />);
    const verticalButton = screen.getByText(/vertical/i);
    fireEvent.click(verticalButton);

    expect(setParam).toHaveBeenCalled();
  });

  it('shows slot count', () => {
    render(<SlotConfigurator />);
    expect(screen.getByText(/dividers/i)).toBeInTheDocument();
  });

  it('shows slot spacing control', () => {
    render(<SlotConfigurator />);
    expect(screen.getByText(/compartment width/i)).toBeInTheDocument();
  });

  it('shows divider height control', () => {
    render(<SlotConfigurator />);
    expect(screen.getByText(/divider height/i)).toBeInTheDocument();
  });

  it('shows divider thickness control', () => {
    render(<SlotConfigurator />);
    expect(screen.getByText(/divider thickness/i)).toBeInTheDocument();
  });

  it('shows divider clearance control', () => {
    render(<SlotConfigurator />);
    expect(screen.getByText(/fit tolerance/i)).toBeInTheDocument();
  });

  it('shows calculated divider dimensions', () => {
    render(<SlotConfigurator />);
    // The component shows dimensions at the bottom
    const texts = screen.getAllByText(/mm/i);
    expect(texts.length).toBeGreaterThan(0);
  });

  it('divider length tracks params.gridUnitMm (regression: panel must match mesh)', () => {
    // Identical configs at 42mm vs 30mm gridUnitMm produce different
    // divider lengths because innerD scales with the user-set grid unit.
    // Pre-fix, both render the 42mm-based length regardless.
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        slotConfig: {
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      },
    });
    const standard = render(<SlotConfigurator />);
    const standardText = standard.container.textContent ?? '';
    standard.unmount();

    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        gridUnitMm: 30,
        slotConfig: {
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      },
    });
    const halfPitch = render(<SlotConfigurator />);
    const halfPitchText = halfPitch.container.textContent ?? '';

    // 42mm bin has innerD ≈ 81.1, 30mm bin ≈ 57.1 → different length renders
    expect(standardText).not.toBe(halfPitchText);
    // Sanity: half-pitch bin shouldn't contain the 42mm-length number
    expect(halfPitchText).toMatch(/5[0-9]\.\d/);
  });

  it('shows auto height when divider height is auto', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        dividerPieces: {
          height: 'auto',
          thickness: 1.2,
          clearance: 0.2,
        },
      },
    });
    render(<SlotConfigurator />);
    expect(screen.getByText(/auto/i)).toBeInTheDocument();
  });

  it('updates divider thickness when changed', () => {
    const setParam = vi.fn();
    useDesignerStore.setState({ setParam });

    render(<SlotConfigurator />);
    const spinbuttons = screen.getAllByRole('spinbutton');
    const thicknessControl = spinbuttons.find((el) =>
      el.getAttribute('aria-label')?.includes('thickness')
    );

    if (thicknessControl) {
      fireEvent.change(thicknessControl, { target: { value: '1.5' } });
      fireEvent.blur(thicknessControl);
      expect(setParam).toHaveBeenCalled();
    }
  });

  it('updates slot pitch when changed', () => {
    const setParam = vi.fn();
    useDesignerStore.setState({ setParam });

    render(<SlotConfigurator />);
    const spinbuttons = screen.getAllByRole('spinbutton');
    const pitchControl = spinbuttons.find((el) => el.getAttribute('aria-label')?.includes('width'));

    if (pitchControl) {
      fireEvent.change(pitchControl, { target: { value: '25' } });
      fireEvent.blur(pitchControl);
      expect(setParam).toHaveBeenCalled();
    }
  });

  it('shows a both-directions toggle button', () => {
    render(<SlotConfigurator />);
    expect(screen.getByText(/both/i)).toBeInTheDocument();
  });

  it('enables both axes when both is clicked', () => {
    const setParam = vi.fn();
    useDesignerStore.setState({ setParam });

    render(<SlotConfigurator />);
    fireEvent.click(screen.getByText(/both/i));

    expect(setParam).toHaveBeenCalledWith(
      'slotConfig',
      expect.objectContaining({
        x: expect.objectContaining({ enabled: true }),
        y: expect.objectContaining({ enabled: true }),
      })
    );
  });

  it('shows a spacing control per direction when both axes are enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 30 },
        },
      },
    });
    render(<SlotConfigurator />);

    const bothButton = screen.getByText(/both/i);
    expect(bothButton).toHaveClass('bg-accent');

    const spinbuttons = screen.getAllByRole('spinbutton');
    const pitchControls = spinbuttons.filter((el) =>
      el.getAttribute('aria-label')?.includes('Compartment width')
    );
    expect(pitchControls).toHaveLength(2);
  });

  it('shows divider dimensions for both pieces when both axes are enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 3,
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 20 },
        },
      },
    });
    const { container } = render(<SlotConfigurator />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/vertical.*×.*mm.*horizontal.*×.*mm/is);
  });
});
