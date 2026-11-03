import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SceneShape } from '@/shared/scanTrace';
import { ToolsPanel } from './ToolsPanel';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const box = (x0: number, y0: number, x1: number, y1: number): SceneShape => {
  const points = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return { imagePoints: points, outputPoints: points };
};

const handlers = {
  onDrawRegion: vi.fn(),
  onClearRegion: vi.fn(),
  onSensitivity: vi.fn(),
  onCommitSensitivity: vi.fn(),
  onKeepHoles: vi.fn(),
  onRemove: vi.fn(),
  onUndo: vi.fn(),
};

function renderPanel(overrides: Partial<Parameters<typeof ToolsPanel>[0]> = {}) {
  return render(
    <ToolsPanel
      shapes={[box(0, 0, 10, 20), box(20, 0, 30, 5)]}
      units="mm"
      drawingRegion={false}
      hasRegion={false}
      sensitivity={0}
      holesFound={false}
      keepHoles={false}
      canRefine
      canUndo={false}
      disabled={false}
      {...handlers}
      {...overrides}
    />
  );
}

describe('ToolsPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists the tools with their sizes, and removes the one asked', () => {
    renderPanel();
    expect(screen.getAllByText('scan.review.toolLabel')).toHaveLength(2);
    expect(screen.getAllByText('binDesigner.cutouts.scanImport.resultSize')).toHaveLength(2);
    fireEvent.click(screen.getAllByLabelText('scan.review.removeTool')[1]);
    expect(handlers.onRemove).toHaveBeenCalledWith(1);
  });

  it('says how to find a tool when none was found', () => {
    renderPanel({ shapes: [] });
    expect(screen.getByText('binDesigner.cutouts.traceView.tools.none')).toBeInTheDocument();
  });

  it('reads the automatic sensitivity as Auto', () => {
    renderPanel();
    expect(screen.getByText('binDesigner.cutouts.traceView.sensitivityAuto')).toBeInTheDocument();
    renderPanel({ sensitivity: 40 });
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('draws a region, and clears one only once it is set', () => {
    const { rerender } = renderPanel();
    expect(screen.queryByText('binDesigner.cutouts.traceView.region.clear')).toBeNull();
    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.region.draw'));
    expect(handlers.onDrawRegion).toHaveBeenCalledTimes(1);

    rerender(
      <ToolsPanel
        shapes={[]}
        units="px"
        drawingRegion={false}
        hasRegion
        sensitivity={0}
        holesFound={false}
        keepHoles={false}
        canRefine
        canUndo={false}
        disabled={false}
        {...handlers}
      />
    );
    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.region.clear'));
    expect(handlers.onClearRegion).toHaveBeenCalledTimes(1);
  });

  it('offers Keep holes only when a hole was found', () => {
    renderPanel();
    expect(screen.queryByText('scan.review.keepHoles')).toBeNull();
    renderPanel({ holesFound: true });
    fireEvent.click(screen.getByRole('switch', { name: 'scan.review.keepHoles' }));
    expect(handlers.onKeepHoles).toHaveBeenCalledWith(true);
  });

  it('undoes only when there is something to undo', () => {
    renderPanel();
    expect(screen.queryByText('scan.review.undo')).toBeNull();
    renderPanel({ canUndo: true });
    fireEvent.click(screen.getByText('scan.review.undo'));
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
  });

  it('holds every control while a trace runs', () => {
    renderPanel({ disabled: true, canUndo: true, hasRegion: true });
    expect(screen.getByText('binDesigner.cutouts.traceView.region.draw')).toBeDisabled();
    expect(screen.getByText('binDesigner.cutouts.traceView.region.clear')).toBeDisabled();
    expect(screen.getByText('scan.review.undo')).toBeDisabled();
    for (const remove of screen.getAllByLabelText('scan.review.removeTool')) {
      expect(remove).toBeDisabled();
    }
  });
});
