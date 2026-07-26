import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { BinOverhangExtension } from './BinOverhangExtension';
import { useLayoutStore } from '@/core/store';
import { createDefaultLayout } from '@/core/constants';
import { createTestBin } from '@/test/testUtils';
import { gridUnits, heightUnits } from '@/core/types';
import type { Bin, Drawer, StoredBaseplateParams } from '@/core/types';

vi.mock('@/i18n', () => ({ useTranslation: () => (key: string) => key }));

const DRAWER: Drawer = { width: gridUnits(5), depth: gridUnits(4), height: heightUnits(6) };

function setup(padding: Partial<StoredBaseplateParams> = {}) {
  const layout = createDefaultLayout();
  useLayoutStore.setState({
    layout: {
      ...layout,
      gridUnitMm: 42,
      baseplateParams: {
        magnetHoles: false,
        magnetDiameter: 6,
        magnetDepth: 2,
        paddingLeft: 0,
        paddingRight: 0,
        paddingFront: 0,
        paddingBack: 0,
        ...padding,
      },
    },
  });
}

function bin(overrides: Partial<Bin> = {}): Bin {
  return createTestBin({ x: 0, y: 0, width: 1, depth: 1, ...overrides });
}

function renderExt(b: Bin, extra: { showSocketEdge?: boolean } = {}) {
  // cellSize 32 + gap 2 = 34 px/unit; 21mm = half a unit = 17px.
  return render(
    <BinOverhangExtension
      bin={b}
      drawer={DRAWER}
      cellSize={32}
      gap={2}
      color="#abc"
      socketEdgeColor="#123"
      {...extra}
    />
  );
}

describe('BinOverhangExtension', () => {
  beforeEach(() => {
    resetAllStores();
    setup({ paddingLeft: 21 });
  });

  describe('drawer margin', () => {
    it('renders nothing when the bin has not opted in', () => {
      const { container } = renderExt(bin({ extendToMargin: false }));
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing for an interior bin', () => {
      const { container } = renderExt(
        bin({ x: gridUnits(1), y: gridUnits(1), extendToMargin: true })
      );
      expect(container.firstChild).toBeNull();
    });

    it('extends into the padded side, scaled to the grid pitch', () => {
      const { container } = renderExt(bin({ extendToMargin: true }));
      const ext = container.firstChild as HTMLElement;
      expect(ext.style.left).toBe('-17px'); // 21/42 * 34
      expect(ext.style.right).toBe('0px');
      expect(ext.style.top).toBe('0px');
      expect(ext.style.backgroundColor).toBe('rgb(170, 187, 204)'); // #abc
    });
  });

  describe('explicit per-placement overhang', () => {
    // The case the drawer-margin path structurally cannot serve: an interior
    // bin, on a drawer with no padding at all, extending on both sides.
    it('extends an interior bin with no baseplate padding', () => {
      setup();
      const { container } = renderExt(
        bin({
          x: gridUnits(2),
          y: gridUnits(1),
          overhang: { enabled: true, left: 7, right: 7, front: 0, back: 0 },
        })
      );
      const ext = container.firstChild as HTMLElement;
      expect(parseFloat(ext.style.left)).toBeCloseTo(-(7 / 42) * 34, 6);
      expect(parseFloat(ext.style.right)).toBeCloseTo(-(7 / 42) * 34, 6);
      expect(ext.style.bottom).toBe('0px');
    });

    it('wins over the drawer margin on the same bin', () => {
      const { container } = renderExt(
        bin({ extendToMargin: true, overhang: { left: 0, right: 21, front: 0, back: 0 } })
      );
      const ext = container.firstChild as HTMLElement;
      // Margin would have extended LEFT by 17px; the explicit overhang replaces it.
      expect(ext.style.left).toBe('0px');
      expect(ext.style.right).toBe('-17px');
    });

    it('ignores an explicitly disabled overhang', () => {
      setup();
      const { container } = renderExt(
        bin({ overhang: { enabled: false, left: 7, right: 7, front: 0, back: 0 } })
      );
      expect(container.firstChild).toBeNull();
    });

    it('ignores an all-zero overhang', () => {
      setup();
      const { container } = renderExt(
        bin({ overhang: { enabled: true, left: 0, right: 0, front: 0, back: 0 } })
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('socket edge', () => {
    it('is hidden at rest so the bin reads as its true footprint', () => {
      const { container } = renderExt(bin({ extendToMargin: true }));
      expect(container.querySelectorAll('div')).toHaveLength(1);
    });

    it('outlines the grid footprint when selected or hovered', () => {
      const { container } = renderExt(bin({ extendToMargin: true }), { showSocketEdge: true });
      const divs = container.querySelectorAll('div');
      expect(divs).toHaveLength(2);
      expect((divs[1] as HTMLElement).style.border).toBe('1px dashed rgb(17, 34, 51)');
    });
  });
});
