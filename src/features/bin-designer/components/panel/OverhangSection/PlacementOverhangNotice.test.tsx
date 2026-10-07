import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlacementOverhangNotice } from './PlacementOverhangNotice';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { useLayoutStore } from '@/core/store/layout';
import { createDefaultLayout } from '@/core/constants';
import { createTestBin } from '@/test/testUtils';
import { binId, designId, gridUnits, mm } from '@/core/types';
import type { Bin } from '@/core/types';

const DESIGN = designId('design-1');
const BIN = binId('bin-1');

function setLayout(bin: Bin) {
  const base = createDefaultLayout();
  useLayoutStore.setState({
    layout: {
      ...base,
      drawer: { ...base.drawer, width: gridUnits(5), depth: gridUnits(4) },
      baseplateParams: {
        magnetHoles: false,
        magnetDiameter: mm(6),
        magnetDepth: mm(2),
        paddingLeft: mm(4.5),
        paddingRight: mm(0),
        paddingFront: mm(0),
        paddingBack: mm(0),
      },
      bins: [bin],
    },
  });
}

describe('PlacementOverhangNotice', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      currentDesignId: DESIGN,
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
    window.history.replaceState(null, '', `/designer?id=${DESIGN}&bin=${BIN}`);
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('lists the drawer-margin sides the layout bin prints with', () => {
    setLayout(createTestBin({ id: BIN, linkedDesignId: DESIGN, extendToMargin: true }));
    render(<PlacementOverhangNotice />);
    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('Overhang from the layout')).toBeDefined();
    expect(screen.getByText(/extends into the drawer margin/)).toBeDefined();
    expect(screen.getByText('Left')).toBeDefined();
    expect(screen.getByText('4.5 mm')).toBeDefined();
    // Only the sides the placement extends; the bin abuts no padded right edge.
    expect(screen.queryByText('Right')).toBeNull();
  });

  it('says the bin was expanded to fit when that is where the overhang comes from', () => {
    setLayout(
      createTestBin({
        id: BIN,
        linkedDesignId: DESIGN,
        overhang: { left: 0, right: 6, front: 0, back: 0, enabled: true },
      })
    );
    render(<PlacementOverhangNotice />);
    expect(screen.getByText(/was expanded to fit/)).toBeDefined();
    expect(screen.getByText('Right')).toBeDefined();
    expect(screen.getByText('6 mm')).toBeDefined();
  });

  it('renders nothing when the layout bin adds no overhang', () => {
    setLayout(createTestBin({ id: BIN, linkedDesignId: DESIGN }));
    const { container } = render(<PlacementOverhangNotice />);
    expect(container.firstChild).toBeNull();
  });
});
