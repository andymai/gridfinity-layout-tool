import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutScoopControls } from './CutoutScoopControls';
import type { Cutout } from '@/features/bin-designer/types';

vi.mock('@/shared/components/CompactNumberInput', () => ({
  CompactNumberInput: ({
    label,
    value,
    onChange,
    disabled,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid={`compact-input-${label}`}
      data-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
}));

vi.mock('@/shared/components/SliderInput', () => ({
  SliderInput: ({
    label,
    value,
    onChange,
    disabled,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid={`slider-input-${label}`}
      data-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 20,
    depth: 20,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

describe('CutoutScoopControls', () => {
  it('renders uniform slider by default for rectangle', () => {
    const onUpdate = vi.fn();
    render(<CutoutScoopControls cutout={makeCutout()} onUpdate={onUpdate} />);
    expect(screen.getByTestId('slider-input-binDesigner.cutouts.scoopRadius')).toBeInTheDocument();
    expect(
      screen.queryByTestId('compact-input-binDesigner.cutouts.scoopW')
    ).not.toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.scoopSplit')).toBeInTheDocument();
  });

  it('writes both axes when uniform slider changes', () => {
    const onUpdate = vi.fn();
    render(<CutoutScoopControls cutout={makeCutout()} onUpdate={onUpdate} />);
    const slider = screen.getByTestId('slider-input-binDesigner.cutouts.scoopRadius');
    fireEvent.change(slider, { target: { value: '4' } });
    expect(onUpdate).toHaveBeenCalledWith({ scoopRadiusW: 4, scoopRadiusD: 4 });
  });

  it('expands to W/D sliders + edge toggles when Split is clicked', () => {
    const onUpdate = vi.fn();
    render(<CutoutScoopControls cutout={makeCutout()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText('binDesigner.cutouts.scoopSplit'));
    expect(screen.getByTestId('compact-input-binDesigner.cutouts.scoopW')).toBeInTheDocument();
    expect(screen.getByTestId('compact-input-binDesigner.cutouts.scoopD')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.scoopEdgeLeft')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.scoopEdgeRight')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.scoopEdgeFront')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.scoopEdgeBack')).toBeInTheDocument();
  });

  it('auto-expands when cutout has asymmetric W/D', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutScoopControls
        cutout={makeCutout({ scoopRadiusW: 5, scoopRadiusD: 1 })}
        onUpdate={onUpdate}
      />
    );
    expect(screen.getByTestId('compact-input-binDesigner.cutouts.scoopW')).toBeInTheDocument();
  });

  it('toggling an edge writes the patch with that edge flipped', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutScoopControls
        cutout={makeCutout({ scoopRadiusW: 5, scoopRadiusD: 5 })}
        onUpdate={onUpdate}
      />
    );
    // Symmetric W/D doesn't auto-expand; click Split to reveal edge toggles.
    fireEvent.click(screen.getByText('binDesigner.cutouts.scoopSplit'));
    fireEvent.click(screen.getByText('binDesigner.cutouts.scoopEdgeLeft'));
    expect(onUpdate).toHaveBeenCalledWith({
      scoopEdges: { left: false, right: true, front: true, back: true },
    });
  });

  it('hides Split toggle for circles (uniform only)', () => {
    const onUpdate = vi.fn();
    render(<CutoutScoopControls cutout={makeCutout({ shape: 'circle' })} onUpdate={onUpdate} />);
    expect(screen.queryByText('binDesigner.cutouts.scoopSplit')).not.toBeInTheDocument();
    expect(screen.getByTestId('slider-input-binDesigner.cutouts.scoopRadius')).toBeInTheDocument();
  });

  it('hides edge toggles for grouped cutouts', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutScoopControls
        cutout={makeCutout({ scoopRadiusW: 5, scoopRadiusD: 1, groupId: 'g1' })}
        onUpdate={onUpdate}
      />
    );
    expect(screen.queryByText('binDesigner.cutouts.scoopEdgeLeft')).not.toBeInTheDocument();
  });

  it('collapsing writes max(W,D) into both axes and resets edges', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutScoopControls
        cutout={makeCutout({
          scoopRadiusW: 5,
          scoopRadiusD: 2,
          scoopEdges: { left: false, right: true, front: true, back: true },
        })}
        onUpdate={onUpdate}
      />
    );
    fireEvent.click(screen.getByText('binDesigner.cutouts.scoopUniform'));
    expect(onUpdate).toHaveBeenCalledWith({
      scoopRadiusW: 5,
      scoopRadiusD: 5,
      scoopEdges: { left: true, right: true, front: true, back: true },
    });
  });
});
