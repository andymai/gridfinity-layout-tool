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
    expect(screen.getByTestId('bento-resize-handles').querySelectorAll('rect')).toHaveLength(8);
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

    const handles = screen.getByTestId('bento-resize-handles').querySelectorAll('rect');
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
          dividerTiltPreview: { key: '0-1', offsetStart: 0, offsetEnd: 0 },
        })}
      />
    );

    // Preview zeroes the offsets — the wall is straight, so no indicator.
    expect(screen.queryByTestId('bento-tilt-0-1')).not.toBeInTheDocument();
  });
});
