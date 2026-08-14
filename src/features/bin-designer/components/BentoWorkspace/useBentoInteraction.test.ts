import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import { useBentoInteraction, type BentoInteractionApi } from './useBentoInteraction';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import { createUniformGrid } from '@/features/bin-designer/utils/compartments';
import { drawCompartment } from '@/features/bin-designer/utils/bentoDraw';

/**
 * World mapping for tests: 10mm cells on a 4×3 grid; the canvas exactly
 * frames the 40×30mm interior at zoom 1 with the container at client (0,0).
 * worldX = clientX and worldY = 30 − clientY, so cell (col,row) is centered
 * at client (col*10+5, 25−row*10) — row 0 (bin front) is the SCREEN BOTTOM.
 */
const CELL = 10;
const CAMERA = {
  zoom: 1,
  cameraCenter: { x: 20, y: 15 },
  canvasWidth: 40,
  canvasHeight: 30,
};

function makeActions() {
  return {
    draw: vi.fn((): number | null => 7),
    move: vi.fn((): number | null => 8),
    resize: vi.fn((): number | null => 9),
    duplicate: vi.fn((): number | null => 10),
    stash: vi.fn((): boolean => true),
    placeFromStash: vi.fn((): number | null => 11),
  };
}

const onInvalidDrop = vi.fn();

function mount(config: CompartmentConfig, overrides: Record<string, unknown> = {}) {
  const actions = makeActions();
  const onSelect = vi.fn();
  const onRequestLabelEdit = vi.fn();
  const setPreviewCompartments = vi.fn();
  const setPreviewSelection = vi.fn();
  const shelfEl = document.createElement('div');
  shelfEl.getBoundingClientRect = () =>
    ({ left: 0, right: 100, top: 500, bottom: 560, width: 100, height: 60 }) as DOMRect;
  const stashShelfRef = { current: shelfEl };
  const canvasEl = document.createElement('div');
  canvasEl.getBoundingClientRect = () =>
    ({ left: 0, right: 40, top: 0, bottom: 30, width: 40, height: 30 }) as DOMRect;
  const canvasRef = { current: canvasEl };

  let api: BentoInteractionApi | null = null;
  function Harness() {
    api = useBentoInteraction({
      config,
      cellW: CELL,
      cellH: CELL,
      canvasRef,
      ...CAMERA,
      stashShelfRef,
      selectedId: null,
      onSelect,
      onRequestLabelEdit,
      onInvalidDrop,
      actions,
      setPreviewCompartments,
      setPreviewSelection,
      ...overrides,
    });
    return createElement('div', {
      'data-testid': 'canvas',
      onPointerDown: (e: React.PointerEvent) => api?.onCanvasPointerDown(e),
      onDoubleClick: (e: React.MouseEvent) => api?.onCanvasDoubleClick(e),
    });
  }
  const utils = render(createElement(Harness));

  const current = (): BentoInteractionApi => {
    if (!api) throw new Error('hook not mounted');
    return api;
  };
  return {
    actions,
    onSelect,
    onRequestLabelEdit,
    get api() {
      return current();
    },
    down(clientX: number, clientY: number, init: Record<string, unknown> = {}) {
      fireEvent.pointerDown(utils.getByTestId('canvas'), { clientX, clientY, button: 0, ...init });
    },
    dblclick(clientX: number, clientY: number) {
      fireEvent.doubleClick(utils.getByTestId('canvas'), { clientX, clientY });
    },
    move(clientX: number, clientY: number) {
      act(() => {
        window.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY }));
      });
    },
    up(clientX: number, clientY: number) {
      act(() => {
        window.dispatchEvent(new PointerEvent('pointerup', { clientX, clientY }));
      });
    },
  };
}

/** 4×3 grid with one drawn 2×2 compartment at (0,0). */
function gridWithDrawn() {
  const result = drawCompartment(createUniformGrid(4, 3, 1.2), { col: 0, row: 0, w: 2, h: 2 });
  if (!result) throw new Error('unreachable');
  return result;
}

describe('useBentoInteraction', () => {
  beforeEach(() => {
    cleanup();
    onInvalidDrop.mockClear();
  });

  describe('draw', () => {
    it('drags out a rect on background and commits it on release', () => {
      const h = mount(createUniformGrid(4, 3, 1.2));
      h.down(5, 25);
      h.move(25, 15);
      expect(h.api.ghost).toMatchObject({
        kind: 'draw',
        valid: true,
        rect: { col: 0, row: 0, w: 3, h: 2 },
      });
      h.up(25, 15);
      expect(h.actions.draw).toHaveBeenCalledWith({ col: 0, row: 0, w: 3, h: 2 });
      expect(h.onSelect).toHaveBeenLastCalledWith(7);
      expect(h.api.gesture).toBeNull();
    });

    it('shows an invalid ghost over a drawn compartment and refuses the commit', () => {
      const { config } = gridWithDrawn();
      const h = mount(config);
      h.down(25, 25);
      h.move(15, 15);
      expect(h.api.ghost).toMatchObject({ kind: 'draw', valid: false });
      h.up(15, 15);
      expect(h.actions.draw).not.toHaveBeenCalled();
    });

    it('deselects when starting a draw on background', () => {
      const h = mount(createUniformGrid(4, 3, 1.2));
      h.down(35, 25);
      expect(h.onSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('move', () => {
    it('selects on pointerdown and commits the cell delta on release', () => {
      const { config, id } = gridWithDrawn();
      const h = mount(config);
      h.down(5, 25);
      expect(h.onSelect).toHaveBeenCalledWith(id);
      h.move(25, 15);
      expect(h.api.ghost).toMatchObject({
        kind: 'move',
        valid: true,
        rect: { col: 2, row: 1, w: 2, h: 2 },
      });
      h.up(25, 15);
      expect(h.actions.move).toHaveBeenCalledWith(id, 2, 1);
      expect(h.onSelect).toHaveBeenLastCalledWith(8);
    });

    it('a click without movement commits nothing', () => {
      const { config } = gridWithDrawn();
      const h = mount(config);
      h.down(5, 25);
      h.up(5, 25);
      expect(h.actions.move).not.toHaveBeenCalled();
      expect(h.api.ghost).toBeNull();
    });

    it('Alt-drag duplicates instead of moving', () => {
      const { config, id } = gridWithDrawn();
      const h = mount(config);
      h.down(5, 25, { altKey: true });
      h.move(25, 25);
      h.up(25, 25);
      expect(h.actions.duplicate).toHaveBeenCalledWith(id, { col: 2, row: 0, w: 2, h: 2 });
      expect(h.actions.move).not.toHaveBeenCalled();
    });

    it('reports a blocked move drop instead of failing silently', () => {
      const first = gridWithDrawn();
      const second = drawCompartment(first.config, { col: 2, row: 0, w: 2, h: 2 });
      if (!second) throw new Error('unreachable');
      const h = mount(second.config);
      // Grab the original 2×2 at (0,0) and drop it onto its neighbor.
      h.down(5, 25);
      h.move(25, 25);
      h.up(25, 25);

      expect(h.actions.move).not.toHaveBeenCalled();
      expect(onInvalidDrop).toHaveBeenCalledWith('move');
    });

    it('releasing over the stash shelf stashes and clears the selection', () => {
      const { config, id } = gridWithDrawn();
      const h = mount(config);
      h.down(5, 25);
      h.move(50, 520);
      expect(h.api.gesture).toMatchObject({ type: 'move', overStash: true });
      h.up(50, 520);
      expect(h.actions.stash).toHaveBeenCalledWith(id);
      expect(h.onSelect).toHaveBeenLastCalledWith(null);
    });
  });

  describe('resize', () => {
    it('drags a handle to a new footprint and commits it', () => {
      const { config, id } = gridWithDrawn();
      const h = mount(config);
      act(() => {
        h.api.onResizeHandlePointerDown(id, 'e', {
          button: 0,
          preventDefault: () => undefined,
          stopPropagation: () => undefined,
        } as unknown as React.PointerEvent);
      });
      h.move(35, 5);
      expect(h.api.ghost).toMatchObject({
        kind: 'resize',
        rect: { col: 0, row: 0, w: 4, h: 2 },
      });
      h.up(35, 5);
      expect(h.actions.resize).toHaveBeenCalledWith(id, { col: 0, row: 0, w: 4, h: 2 });
    });

    it('an unchanged footprint commits nothing', () => {
      const { config, id } = gridWithDrawn();
      const h = mount(config);
      act(() => {
        h.api.onResizeHandlePointerDown(id, 'e', {
          button: 0,
          preventDefault: () => undefined,
          stopPropagation: () => undefined,
        } as unknown as React.PointerEvent);
      });
      h.up(15, 5);
      expect(h.actions.resize).not.toHaveBeenCalled();
    });
  });

  describe('stash drag', () => {
    /**
     * A shelf tile pointerdown. The 40x20 tile is the entry drawn to scale, so
     * `grabFracX/Y` choose which of its cells the pointer grabbed; the tile is
     * then positioned so that grab point lands at client (`atX`, `atY`), which
     * is what the drag threshold measures from.
     */
    function pressTile(
      h: ReturnType<typeof mount>,
      index: number,
      { grabFracX = 0, grabFracY = 1, atX = 0, atY = 0 } = {}
    ): void {
      const left = atX - grabFracX * 40;
      const top = atY - grabFracY * 20;
      const tile = document.createElement('div');
      tile.getBoundingClientRect = () =>
        ({ left, top, right: left + 40, bottom: top + 20, width: 40, height: 20 }) as DOMRect;
      act(() => {
        h.api.onStashEntryPointerDown(index, {
          button: 0,
          preventDefault: () => undefined,
          currentTarget: tile,
          clientX: atX,
          clientY: atY,
        } as unknown as React.PointerEvent);
      });
    }

    it('places a stash entry on the grid where it is dropped', () => {
      const config: CompartmentConfig = {
        ...createUniformGrid(4, 3, 1.2),
        stash: [{ w: 2, h: 1 }],
      };
      const h = mount(config);
      pressTile(h, 0);
      h.move(25, 15);
      expect(h.api.ghost).toMatchObject({
        kind: 'stashDrag',
        valid: true,
        rect: { col: 2, row: 1, w: 2, h: 1 },
      });
      h.up(25, 15);
      expect(h.actions.placeFromStash).toHaveBeenCalledWith(0, { col: 2, row: 1, w: 2, h: 1 });
      expect(h.onSelect).toHaveBeenLastCalledWith(11);
    });

    it('keeps the grabbed cell under the cursor instead of re-centering', () => {
      const config: CompartmentConfig = {
        ...createUniformGrid(4, 3, 1.2),
        stash: [{ w: 2, h: 1 }],
      };
      const h = mount(config);
      // Grabbed on the RIGHT half of a 2-wide tile: that cell, not the left
      // one, must land on the hovered cell — so the rect starts a column back.
      pressTile(h, 0, { grabFracX: 0.9 });
      h.move(25, 15);
      expect(h.api.ghost).toMatchObject({ rect: { col: 1, row: 1, w: 2, h: 1 } });
    });

    it('stays inert until the pointer passes the drag threshold', () => {
      const config: CompartmentConfig = {
        ...createUniformGrid(4, 3, 1.2),
        stash: [{ w: 1, h: 1 }],
      };
      const h = mount(config);
      pressTile(h, 0, { atX: 2, atY: 2 });
      // Two pixels of jitter is a click on the tile, not a drag off the shelf.
      h.move(3, 3);
      expect(h.api.ghost).toBeNull();
      h.up(3, 3);
      expect(h.actions.placeFromStash).not.toHaveBeenCalled();
    });

    it('dropping outside the canvas cancels the placement', () => {
      const config: CompartmentConfig = {
        ...createUniformGrid(4, 3, 1.2),
        stash: [{ w: 1, h: 1 }],
      };
      const h = mount(config);
      pressTile(h, 0);
      h.move(200, 200);
      expect(h.api.ghost).toBeNull();
      h.up(200, 200);
      expect(h.actions.placeFromStash).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('clears the in-flight gesture and reports whether one existed', () => {
      const h = mount(createUniformGrid(4, 3, 1.2));
      h.down(5, 25);
      let had = false;
      act(() => {
        had = h.api.cancel();
      });
      expect(had).toBe(true);
      expect(h.api.gesture).toBeNull();
      h.up(25, 25);
      expect(h.actions.draw).not.toHaveBeenCalled();
      act(() => {
        had = h.api.cancel();
      });
      expect(had).toBe(false);
    });
  });

  describe('double-click', () => {
    it('requests a label edit on a drawn compartment only', () => {
      const { config, id } = gridWithDrawn();
      const h = mount(config);
      h.dblclick(5, 25);
      expect(h.onRequestLabelEdit).toHaveBeenCalledWith(id);
      h.onRequestLabelEdit.mockClear();
      h.dblclick(35, 25);
      expect(h.onRequestLabelEdit).not.toHaveBeenCalled();
    });
  });
});
