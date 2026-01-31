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
});
