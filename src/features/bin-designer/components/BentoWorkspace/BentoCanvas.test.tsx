import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoCanvas, type BentoCanvasProps } from './BentoCanvas';
import { createUniformGrid } from '@/features/bin-designer/utils/compartments';
import { drawCompartment, getDrawnCompartmentIds } from '@/features/bin-designer/utils/bentoDraw';
import type { CompartmentConfig } from '@/features/bin-designer/types';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

/** Identity-friendly camera: 1 px per mm, interior origin at canvas center offsets. */
const camera = { zoom: 1, cameraCenter: { x: 40, y: 30 }, canvasWidth: 200, canvasHeight: 120 };

function makeProps(config: CompartmentConfig, overrides: Partial<BentoCanvasProps> = {}) {
  return {
    config,
    interiorW: 80,
    interiorD: 60,
    camera,
    drawnIds: getDrawnCompartmentIds(config),
    selectedId: null,
    hoveredId: null,
    previewColor: '#3b82f6',
    ghost: null,
    movingId: null,
    drop: null,
    showHoverHandles: true,
    dividerTiltPreview: null,
    onResizeHandlePointerDown: vi.fn(),
    ...overrides,
  } satisfies BentoCanvasProps;
}

function withDrawn() {
  const result = drawCompartment(createUniformGrid(4, 3, 1.2), { col: 0, row: 0, w: 2, h: 2 });
  if (!result) throw new Error('unreachable');
  return result;
}

describe('BentoCanvas', () => {
  it('renders only drawn compartments as objects; background stays lattice', () => {
    const { config, id } = withDrawn();
    render(<BentoCanvas {...makeProps(config)} />);

    expect(screen.getByTestId(`bento-compartment-${id}`)).toBeInTheDocument();
    // 12 cells minus the 4 merged = 8 background cells, none rendered as objects.
    expect(
      screen.getByTestId('bento-canvas').querySelectorAll('[data-testid^="bento-compartment-"]')
    ).toHaveLength(1);
  });

  it('shows the compartment label text', () => {
    const { config, id } = withDrawn();
    const labeled: CompartmentConfig = {
      ...config,
      compartmentTexts: Object.assign(new Array<string>(id + 1).fill(''), { [id]: 'screws' }),
    };
    render(<BentoCanvas {...makeProps(labeled)} />);

    expect(screen.getByText('screws')).toBeInTheDocument();
  });

  it('marks the selection and shows its resize handles when idle', () => {
    const { config, id } = withDrawn();
    render(<BentoCanvas {...makeProps(config, { selectedId: id })} />);

    expect(screen.getByTestId(`bento-compartment-${id}`)).toHaveAttribute('data-selected');
    // 8 grabbable targets; each pairs a visible square with a larger hit rect.
    expect(
      screen.getByTestId('bento-resize-handles').querySelectorAll('rect[role="button"]')
    ).toHaveLength(8);
  });

  it('hides resize handles while a gesture is in flight', () => {
    const { config, id } = withDrawn();
    render(
      <BentoCanvas
        {...makeProps(config, {
          selectedId: id,
          ghost: {
            rect: { col: 0, row: 0, w: 1, h: 1 },
            valid: true,
            kind: 'draw',
            overStash: false,
          },
        })}
      />
    );

    expect(screen.queryByTestId('bento-resize-handles')).not.toBeInTheDocument();
  });

  it('forwards resize-handle pointerdowns with the handle id', () => {
    const { config, id } = withDrawn();
    const onResizeHandlePointerDown = vi.fn();
    render(<BentoCanvas {...makeProps(config, { selectedId: id, onResizeHandlePointerDown })} />);

    const handles = screen
      .getByTestId('bento-resize-handles')
      .querySelectorAll('rect[role="button"]');
    fireEvent.pointerDown(handles[0]);

    expect(onResizeHandlePointerDown).toHaveBeenCalledWith(id, 'nw', expect.anything());
  });

  it('renders the ghost with the three-state contract attributes', () => {
    const { config } = withDrawn();
    const { rerender } = render(
      <BentoCanvas
        {...makeProps(config, {
          ghost: {
            rect: { col: 2, row: 0, w: 2, h: 1 },
            valid: true,
            kind: 'draw',
            overStash: false,
          },
        })}
      />
    );
    let ghost = screen.getByTestId('bento-canvas').querySelector('[data-interaction-preview]');
    expect(ghost).toHaveAttribute('data-interaction-preview', 'draw');
    expect(ghost).toHaveAttribute('data-snap-state', 'valid');

    rerender(
      <BentoCanvas
        {...makeProps(config, {
          ghost: {
            rect: { col: 0, row: 0, w: 2, h: 1 },
            valid: false,
            kind: 'move',
            overStash: false,
          },
        })}
      />
    );
    ghost = screen.getByTestId('bento-canvas').querySelector('[data-interaction-preview]');
    expect(ghost).toHaveAttribute('data-interaction-preview', 'move');
    expect(ghost).toHaveAttribute('data-snap-state', 'invalid');
  });

  it('hides the ghost while a move hovers the stash shelf', () => {
    const { config } = withDrawn();
    render(
      <BentoCanvas
        {...makeProps(config, {
          ghost: {
            rect: { col: 0, row: 0, w: 2, h: 2 },
            valid: true,
            kind: 'move',
            overStash: true,
          },
        })}
      />
    );

    expect(
      screen.getByTestId('bento-canvas').querySelector('[data-interaction-preview]')
    ).toBeNull();
  });

  it('draws tilted-wall indicator lines from divider overrides', () => {
    const config: CompartmentConfig = {
      ...createUniformGrid(2, 1, 1.2),
      dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: -5 }],
    };
    render(<BentoCanvas {...makeProps(config)} />);

    expect(screen.getByTestId('bento-tilt-0-1')).toBeInTheDocument();
  });

  it('prefers the live tilt preview over the committed override', () => {
    const config: CompartmentConfig = {
      ...createUniformGrid(2, 1, 1.2),
      dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: -5 }],
    };
    render(
      <BentoCanvas
        {...makeProps(config, {
          dividerTiltPreview: { key: '0-1', offsetStart: 0, offsetEnd: 0, rakeDeg: 0 },
        })}
      />
    );

    // Preview zeroes the offsets — the wall is straight, so no indicator.
    expect(screen.queryByTestId('bento-tilt-0-1')).not.toBeInTheDocument();
  });

  describe('hover resize handles', () => {
    it('offers ghost handles on the hovered compartment when nothing is selected', () => {
      const { config, id } = withDrawn();
      render(<BentoCanvas {...makeProps(config, { hoveredId: id })} />);

      const group = screen.getByTestId('bento-resize-handles');
      expect(group).toHaveAttribute('data-variant', 'ghost');
      expect(group.querySelectorAll('rect[role="button"]')).toHaveLength(8);
    });

    it('resizing the hovered compartment targets that compartment', () => {
      const { config, id } = withDrawn();
      const onResizeHandlePointerDown = vi.fn();
      render(<BentoCanvas {...makeProps(config, { hoveredId: id, onResizeHandlePointerDown })} />);

      fireEvent.pointerDown(
        screen.getByTestId('bento-resize-handles').querySelectorAll('rect[role="button"]')[0]
      );

      expect(onResizeHandlePointerDown).toHaveBeenCalledWith(
        id,
        expect.any(String),
        expect.anything()
      );
    });

    it('keeps the handles on the selection when a different compartment is hovered', () => {
      const first = withDrawn();
      const second = drawCompartment(first.config, { col: 2, row: 2, w: 2, h: 1 });
      if (!second) throw new Error('unreachable');
      render(
        <BentoCanvas
          {...makeProps(second.config, { selectedId: first.id, hoveredId: second.id })}
        />
      );

      const group = screen.getByTestId('bento-resize-handles');
      expect(group).toHaveAttribute('data-variant', 'primary');
    });

    it('stays off for touch, which has no hover to leave', () => {
      const { config, id } = withDrawn();
      render(<BentoCanvas {...makeProps(config, { hoveredId: id, showHoverHandles: false })} />);

      expect(screen.queryByTestId('bento-resize-handles')).not.toBeInTheDocument();
    });
  });

  it('reads out the size of the gesture ghost, and only while one is live', () => {
    const { config } = withDrawn();
    const { rerender } = render(<BentoCanvas {...makeProps(config)} />);
    expect(screen.queryByTestId('bento-ghost-size')).not.toBeInTheDocument();

    rerender(
      <BentoCanvas
        {...makeProps(config, {
          ghost: {
            rect: { col: 0, row: 0, w: 2, h: 2 },
            valid: true,
            kind: 'resize',
            overStash: false,
          },
        })}
      />
    );

    // The echo mock only substitutes placeholders that appear in the KEY, and
    // `binDesigner.bento.sizeMm` has none — so the millimetres themselves are
    // not assertable here, only that the readout is present during a gesture.
    expect(screen.getByTestId('bento-ghost-size')).toBeInTheDocument();
  });

  it('drops the size readout when a move hovers the stash shelf', () => {
    const { config } = withDrawn();
    render(
      <BentoCanvas
        {...makeProps(config, {
          ghost: {
            rect: { col: 0, row: 0, w: 2, h: 2 },
            valid: true,
            kind: 'move',
            overStash: true,
          },
        })}
      />
    );

    expect(screen.queryByTestId('bento-ghost-size')).not.toBeInTheDocument();
  });

  it('replays the drop settle when the same compartment lands twice', () => {
    const { config, id } = withDrawn();
    const { rerender } = render(<BentoCanvas {...makeProps(config, { drop: { id, token: 1 } })} />);
    const first = screen.getByTestId(`bento-compartment-${id}`);
    expect(first).toHaveClass('animate-bento-drop');

    rerender(<BentoCanvas {...makeProps(config, { drop: { id, token: 2 } })} />);

    // A new element, not the same one re-rendered: CSS will not run keyframes
    // a second time on a node that never unmounted.
    expect(screen.getByTestId(`bento-compartment-${id}`)).not.toBe(first);
  });
});
