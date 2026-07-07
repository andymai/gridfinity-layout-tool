import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { BinMarginExtension } from './BinMarginExtension';
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

function renderExt(b: Bin) {
  // cellSize 32 + gap 2 = 34 px/unit; 21mm = half a unit = 17px.
  return render(<BinMarginExtension bin={b} drawer={DRAWER} cellSize={32} gap={2} color="#abc" />);
}

describe('BinMarginExtension', () => {
  beforeEach(() => {
    resetAllStores();
    setup({ paddingLeft: 21 });
  });

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
