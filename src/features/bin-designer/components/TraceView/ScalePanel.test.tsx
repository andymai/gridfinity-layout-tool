import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DEFAULT_CARD_SIZE } from '@/shared/scanReview';
import { PAPER_SIZES, type Point, type SceneTrace } from '@/shared/scanTrace';
import { ScalePanel } from './ScalePanel';
import type { TraceMode } from './traceMode';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const UNSIZED: SceneTrace = { shapes: [], units: 'px', card: null, grid: null, reference: null };
const SHEET: Point[] = [
  { x: 20, y: 20 },
  { x: 320, y: 30 },
  { x: 310, y: 240 },
  { x: 15, y: 230 },
];

const handlers = {
  onStart: vi.fn(),
  onCancel: vi.fn(),
  onPaperSize: vi.fn(),
  onApply: vi.fn(),
  onClear: vi.fn(),
  onCardSize: vi.fn(),
};

function renderPanel(
  overrides: Partial<{
    scene: SceneTrace;
    mode: TraceMode;
    marks: readonly Point[];
    manual: boolean;
    hasAuto: boolean;
    paperSize: 'a4' | 'letter';
  }> = {}
) {
  return render(
    <ScalePanel
      scene={UNSIZED}
      mode="tap"
      marks={[]}
      manual={false}
      hasAuto={false}
      paperSize="a4"
      cardSize={DEFAULT_CARD_SIZE}
      disabled={false}
      {...handlers}
      {...overrides}
    />
  );
}

describe('ScalePanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says no reference was found and offers both ways to set one', () => {
    renderPanel();
    expect(screen.getByText('binDesigner.cutouts.traceView.scale.none')).toBeInTheDocument();
    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.scale.drawRuler'));
    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.scale.markPaper'));
    expect(handlers.onStart.mock.calls).toEqual([['ruler'], ['paper']]);
  });

  it('asks for the length once both ends are down, and sets the ruler from it', () => {
    renderPanel({
      mode: 'ruler',
      marks: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
    });
    const apply = screen.getByText('binDesigner.cutouts.traceView.apply');
    expect(apply).toBeDisabled();

    const field = screen.getByLabelText('binDesigner.cutouts.traceView.ruler.length');
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: '150,5' } });
    fireEvent.click(apply);

    expect(handlers.onApply).toHaveBeenCalledWith({
      kind: 'ruler',
      ruler: { a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, lengthMm: 150.5 },
    });
  });

  it('takes the length on Enter', () => {
    renderPanel({
      mode: 'ruler',
      marks: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
    });
    const field = screen.getByLabelText('binDesigner.cutouts.traceView.ruler.length');
    fireEvent.change(field, { target: { value: '80' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(handlers.onApply).toHaveBeenCalledTimes(1);
  });

  it('holds the paper back until four corners make a sheet', () => {
    const { rerender } = renderPanel({ mode: 'paper', marks: SHEET.slice(0, 3) });
    expect(screen.getByText('binDesigner.cutouts.traceView.apply')).toBeDisabled();
    expect(screen.getByText('binDesigner.cutouts.traceView.paper.count')).toBeInTheDocument();

    const dented = [SHEET[0], SHEET[1], { x: 60, y: 60 }, SHEET[3]];
    rerender(
      <ScalePanel
        scene={UNSIZED}
        mode="paper"
        marks={dented}
        manual={false}
        hasAuto={false}
        paperSize="a4"
        cardSize={DEFAULT_CARD_SIZE}
        disabled={false}
        {...handlers}
      />
    );
    expect(screen.getByText('binDesigner.cutouts.traceView.paper.invalid')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.traceView.apply')).toBeDisabled();
  });

  it('sets the sheet at the chosen paper size', () => {
    renderPanel({ mode: 'paper', marks: SHEET, paperSize: 'letter' });
    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.apply'));
    const [reference] = handlers.onApply.mock.calls[0] as [{ kind: string; paper: object }];
    expect(reference.kind).toBe('paper');
    expect(reference.paper).toMatchObject(PAPER_SIZES.letter);
  });

  it('goes back to the photo’s own reference when there is one', () => {
    renderPanel({
      scene: {
        ...UNSIZED,
        units: 'mm',
        reference: { kind: 'ruler', ruler: { a: { x: 0, y: 0 }, b: { x: 9, y: 9 }, lengthMm: 40 } },
      },
      manual: true,
      hasAuto: true,
    });
    expect(screen.getByText('binDesigner.cutouts.traceView.scale.ruler')).toBeInTheDocument();
    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.scale.usePhoto'));
    expect(handlers.onClear).toHaveBeenCalledTimes(1);
  });

  it('offers to correct the card size only when a card sized the photo', () => {
    const corners = [
      { x: 0, y: 0 },
      { x: 86, y: 0 },
      { x: 86, y: 54 },
      { x: 0, y: 54 },
    ] as const;
    const card = { corners, fitness: 1 };
    renderPanel({ scene: { ...UNSIZED, units: 'mm', card, reference: { kind: 'card', card } } });
    expect(screen.getByText('scan.cardMeasured')).toBeInTheDocument();
    expect(screen.getByText('scan.cardSize.label')).toBeInTheDocument();
  });
});
