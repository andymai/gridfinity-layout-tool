import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DimensionsSection } from './DimensionsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('DimensionsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders dimension controls', () => {
    render(<DimensionsSection />);
    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Depth')).toBeInTheDocument();
    expect(screen.getByLabelText('Height')).toBeInTheDocument();
  });

  it('renders the exterior-wall collar control with its mm readout', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, extraWallHeightMm: 8 },
    });
    render(<DimensionsSection />);
    expect(screen.getByLabelText('Extra wall height')).toBeInTheDocument();
    expect(screen.getByText('8 mm')).toBeInTheDocument();
  });

  it('shows the inside size under the outside size', () => {
    render(<DimensionsSection />);
    expect(screen.getByText('84 × 84 × 21 mm')).toBeInTheDocument();
    expect(screen.getByText('Inside')).toBeInTheDocument();
    expect(screen.getByText('81.1 × 81.1 × 14 mm')).toBeInTheDocument();
  });

  it('explains what the inside size leaves out in text a touch screen can read', () => {
    render(<DimensionsSection />);
    expect(screen.getByText(/before dividers, scoops and label tabs/)).toBeVisible();
  });

  it('gives a flat base more inside height than a socketed one', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      },
    });
    render(<DimensionsSection />);
    expect(screen.getByText('81.1 × 81.1 × 19.8 mm')).toBeInTheDocument();
  });

  it('hides the inside size for a solid block, which has no cavity', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      },
    });
    render(<DimensionsSection />);
    expect(screen.queryByText('Inside')).not.toBeInTheDocument();
  });

  it('hides the half-unit edge controls for whole-unit bins', () => {
    render(<DimensionsSection />);
    expect(screen.queryByText('Half-unit edge position')).not.toBeInTheDocument();
  });

  it('shows the half-unit edge control only for the fractional axis', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2.5, depth: 2 },
    });
    render(<DimensionsSection />);
    expect(screen.getByText('Half-unit edge position')).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
    // Depth is whole — no front/back (bottom/top) toggle.
    expect(screen.queryByText('Bottom')).not.toBeInTheDocument();
  });

  it('hides the edge control in half-sockets mode', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2.5,
        depth: 2,
        base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
      },
    });
    render(<DimensionsSection />);
    expect(screen.queryByText('Half-unit edge position')).not.toBeInTheDocument();
  });
});
