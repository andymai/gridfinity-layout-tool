import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewControls } from './PreviewControls';

describe('PreviewControls', () => {
  const defaultProps = {
    wireframe: false,
    previewColor: '#d4d8dc',
    activePreset: null as 'front' | 'side' | 'top' | 'isometric' | null,
    onWireframeToggle: vi.fn(),
    onColorChange: vi.fn(),
    onCameraPreset: vi.fn(),
    onResetView: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PreviewControls {...defaultProps} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('renders camera preset buttons', () => {
    render(<PreviewControls {...defaultProps} />);
    expect(screen.getAllByLabelText(/Front camera view/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Side camera view/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Top camera view/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Iso camera view/).length).toBeGreaterThan(0);
  });

  it('calls onCameraPreset when preset button clicked', () => {
    render(<PreviewControls {...defaultProps} />);
    const frontButtons = screen.getAllByLabelText(/Front camera view/);
    fireEvent.click(frontButtons[0]);
    expect(defaultProps.onCameraPreset).toHaveBeenCalledWith('front');
  });

  it('calls onResetView when reset button clicked', () => {
    render(<PreviewControls {...defaultProps} />);
    const resetButtons = screen.getAllByLabelText(/Reset camera view/);
    fireEvent.click(resetButtons[0]);
    expect(defaultProps.onResetView).toHaveBeenCalled();
  });

  it('calls onWireframeToggle when wireframe button clicked', () => {
    render(<PreviewControls {...defaultProps} />);
    const wireframeButtons = screen.getAllByLabelText(/Toggle wireframe/);
    fireEvent.click(wireframeButtons[0]);
    expect(defaultProps.onWireframeToggle).toHaveBeenCalled();
  });

  it('shows active state for wireframe when enabled', () => {
    render(<PreviewControls {...defaultProps} wireframe={true} />);
    const wireframeButtons = screen.getAllByLabelText(/Toggle wireframe/);
    expect(wireframeButtons[0]).toHaveClass('bg-accent');
  });

  it('shows active state for camera preset', () => {
    render(<PreviewControls {...defaultProps} activePreset="front" />);
    const frontButtons = screen.getAllByLabelText(/Front camera view/);
    expect(frontButtons[0]).toHaveClass('bg-accent');
  });

  it('opens color picker when color button clicked', () => {
    render(<PreviewControls {...defaultProps} />);
    const colorButtons = screen.getAllByLabelText(/Change preview color/);
    fireEvent.click(colorButtons[0]);
    expect(screen.getAllByRole('listbox').length).toBeGreaterThan(0);
  });

  it('closes color picker on outside click', () => {
    render(<PreviewControls {...defaultProps} />);
    const colorButtons = screen.getAllByLabelText(/Change preview color/);
    fireEvent.click(colorButtons[0]);
    expect(screen.getAllByRole('listbox').length).toBeGreaterThan(0);

    fireEvent.mouseDown(document.body);
    expect(screen.queryAllByRole('listbox').length).toBe(0);
  });
});
