import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { MeasurePoint } from '@/features/bin-designer/utils/measure3d';
import { MeasureOverlay } from './MeasureOverlay';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const A: MeasurePoint = { x: 0, y: 0, z: 0, kind: 'vertex' };
const B: MeasurePoint = { x: 3, y: 4, z: 0, kind: 'vertex' };

const measure = () => useDesignerStore.getState().ui.measure;

describe('MeasureOverlay', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('stays out of the way while the tool is off', () => {
    const { container } = render(<MeasureOverlay />);
    expect(container).toBeEmptyDOMElement();
  });

  it('prompts for the first pick before anything is placed', () => {
    useDesignerStore.getState().setMeasureActive(true);
    render(<MeasureOverlay />);
    expect(screen.getByText('binDesigner.measure.hintFirst')).toBeInTheDocument();
  });

  it('swaps the hint for a readout once both points are placed', () => {
    // The value itself is `measureBetween`'s job and is tested there; what
    // matters here is that the banner stops prompting and starts reporting.
    useDesignerStore.getState().setMeasureActive(true);
    useDesignerStore.getState().setMeasurePoints([A, B]);
    render(<MeasureOverlay />);

    expect(screen.getByText('binDesigner.measure.distanceValue')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.measure.hintFirst')).not.toBeInTheDocument();
  });

  it('reports a thickness rather than a distance in thickness mode', () => {
    useDesignerStore.getState().setMeasureActive(true);
    useDesignerStore.getState().setMeasureMode('thickness');
    useDesignerStore.getState().setMeasurePoints([A, B]);
    render(<MeasureOverlay />);

    expect(screen.getByText('binDesigner.measure.thicknessValue')).toBeInTheDocument();
    // Per-axis deltas describe a span between two picks, not a wall.
    expect(screen.queryByText('binDesigner.measure.deltas')).not.toBeInTheDocument();
  });

  it('switches mode and drops the points with it', () => {
    // A thickness pair is two faces of one wall; a point pair is two picks the
    // user chose. Carrying one into the other would show a stale number.
    useDesignerStore.getState().setMeasureActive(true);
    useDesignerStore.getState().setMeasurePoints([A, B]);
    render(<MeasureOverlay />);

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.measure.modeThickness' }));

    expect(measure().mode).toBe('thickness');
    expect(measure().points).toHaveLength(0);
  });

  it('clears the measurement without leaving the tool', () => {
    useDesignerStore.getState().setMeasureActive(true);
    useDesignerStore.getState().setMeasurePoints([A, B]);
    render(<MeasureOverlay />);

    fireEvent.click(screen.getByText('binDesigner.measure.clear'));

    expect(measure().points).toHaveLength(0);
    expect(measure().active).toBe(true);
  });

  it('exits the tool from the close control', () => {
    useDesignerStore.getState().setMeasureActive(true);
    render(<MeasureOverlay />);

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.measure.exit' }));

    expect(measure().active).toBe(false);
  });

  it('stands down when a color tool takes over', () => {
    // Both tools claim the same pointer picks, so only one may be live.
    useDesignerStore.getState().setMeasureActive(true);
    useDesignerStore.getState().setColorTool('eyedropper');

    const { container } = render(<MeasureOverlay />);
    expect(container).toBeEmptyDOMElement();
  });
});
