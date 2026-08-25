import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutRepeatLabels } from './CutoutRepeatLabels';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
import type { Cutout, CutoutArrayConfig } from '@/features/bin-designer/types';

const config = (o: Partial<CutoutArrayConfig> = {}): CutoutArrayConfig => ({
  mode: 'grid',
  cols: 3,
  rows: 1,
  pitchX: 20,
  pitchY: 20,
  count: 3,
  radius: 20,
  startAngle: 0,
  rotateToCenter: true,
  ...o,
});

const cutout = (o: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'circle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: 'Bit',
  groupId: null,
  ...o,
});

/** The list textarea, addressed the way a user would reach it. */
const box = () => screen.getByRole('textbox');

describe('CutoutRepeatLabels', () => {
  it('renders nothing for a cutout with no repeat', () => {
    const { container } = render(
      <CutoutRepeatLabels cutout={cutout()} onChange={() => undefined} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('offers the opt-in until a list exists, so stored designs are untouched', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutRepeatLabels
        cutout={cutout({ array: config() })}
        onChange={(config) => onUpdate({ array: config })}
      />
    );
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getByRole('button'));
    // Seeded one line per copy, each carrying the label the cutout already had,
    // so taking the opt-in changes nothing until the user edits a line.
    expect(onUpdate).toHaveBeenCalledWith({
      array: expect.objectContaining({ labels: ['Bit', 'Bit', 'Bit'] }),
    });
  });

  it('writes one label per line, keeping a blank line as a bare hole', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutRepeatLabels
        cutout={cutout({ array: config({ labels: ['a', 'b', 'c'] }) })}
        onChange={(config) => onUpdate({ array: config })}
      />
    );
    fireEvent.change(box(), { target: { value: 'Upcut\n\nFlush' } });
    expect(onUpdate).toHaveBeenCalledWith({
      array: expect.objectContaining({ labels: ['Upcut', '', 'Flush'] }),
    });
  });

  it('reports a shortfall without refusing it', () => {
    render(
      <CutoutRepeatLabels
        cutout={cutout({ array: config({ labels: ['Upcut'] }) })}
        onChange={() => undefined}
      />
    );
    expect(screen.getByText(/labels\.count/)).toBeInTheDocument();
    expect(screen.getByText(/labels\.short/)).toBeInTheDocument();
    expect(screen.queryByText(/labels\.long/)).toBeNull();
  });

  it('reports spare labels when the repeat shrinks below the list', () => {
    render(
      <CutoutRepeatLabels
        cutout={cutout({ array: config({ cols: 2, labels: ['a', 'b', 'c', 'd'] }) })}
        onChange={() => undefined}
      />
    );
    expect(screen.getByText(/labels\.long/)).toBeInTheDocument();
  });

  it('offers a comma split only when the list looks comma-separated', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(
      <CutoutRepeatLabels
        cutout={cutout({ array: config({ labels: ['Upcut', 'Downcut', 'Flush'] }) })}
        onChange={(config) => onUpdate({ array: config })}
      />
    );
    expect(screen.queryByText('binDesigner.cutouts.repeat.labels.splitCommas')).toBeNull();

    rerender(
      <CutoutRepeatLabels
        cutout={cutout({ array: config({ labels: ['Upcut, Downcut, Flush'] }) })}
        onChange={(config) => onUpdate({ array: config })}
      />
    );
    fireEvent.click(screen.getByText('binDesigner.cutouts.repeat.labels.splitCommas'));
    expect(onUpdate).toHaveBeenCalledWith({
      array: expect.objectContaining({ labels: ['Upcut', 'Downcut', 'Flush'] }),
    });
  });

  it('clears the list back to one shared label', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutRepeatLabels
        cutout={cutout({ array: config({ labels: ['a', 'b', 'c'] }) })}
        onChange={(config) => onUpdate({ array: config })}
      />
    );
    fireEvent.click(screen.getByText('binDesigner.cutouts.repeat.labels.disable'));
    expect(onUpdate).toHaveBeenCalledWith({
      array: expect.objectContaining({ labels: undefined }),
    });
  });

  it('names the ring order for a radial repeat', () => {
    render(
      <CutoutRepeatLabels
        cutout={cutout({ array: config({ mode: 'radial', labels: [] }) })}
        onChange={() => undefined}
      />
    );
    expect(screen.getByText(/labels\.order\.ring/)).toBeInTheDocument();
  });
});
