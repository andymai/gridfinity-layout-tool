import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssembledHeightBreakdown } from './AssembledHeightBreakdown';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import type { BinParams } from '@/features/bin-designer/types';
import type { StoredBaseplateParams } from '@/core/types';
import { mm } from '@/core/types';

function setDesign(overrides: Partial<BinParams> = {}): void {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, ...overrides },
    ui: { ...DEFAULT_UI_STATE },
  });
}

function setPlate(plate: StoredBaseplateParams | undefined): void {
  useLayoutStore.setState((s) => ({
    layout: { ...s.layout, baseplateParams: plate },
  }));
}

function setDrawerHeight(heightMm: number | undefined): void {
  useLayoutStore.setState((s) => ({
    layout: {
      ...s.layout,
      drawer: {
        ...s.layout.drawer,
        measuredMm:
          heightMm === undefined ? undefined : { width: 400, depth: 500, height: heightMm },
      },
    },
  }));
}

function setExpanded(expanded: boolean): void {
  useSettingsStore.setState((s) => ({
    settings: { ...s.settings, showAssembledHeightBreakdown: expanded },
  }));
}

describe('AssembledHeightBreakdown', () => {
  beforeEach(() => {
    setDesign({ height: 6, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } });
    setPlate(DEFAULT_BASEPLATE_PARAMS);
    setDrawerHeight(undefined);
    setExpanded(false);
  });

  it('shows the assembled total collapsed by default', () => {
    render(<AssembledHeightBreakdown />);
    // 6u × 7mm = 42mm body + 4.4mm lip; a plain plate adds nothing.
    expect(screen.getByText('46.4mm')).toBeInTheDocument();
    expect(screen.queryByText('Stacking lip')).not.toBeInTheDocument();
  });

  it('expands into per-component rows when toggled', async () => {
    const user = userEvent.setup();
    render(<AssembledHeightBreakdown />);

    await user.click(screen.getByRole('button', { name: /assembled height/i }));

    expect(screen.getByText('Baseplate')).toBeInTheDocument();
    expect(screen.getByText('Bin')).toBeInTheDocument();
    expect(screen.getByText('Stacking lip')).toBeInTheDocument();
    expect(useSettingsStore.getState().settings.showAssembledHeightBreakdown).toBe(true);
  });

  it('explains why a plain baseplate contributes nothing', () => {
    setExpanded(true);
    render(<AssembledHeightBreakdown />);
    expect(screen.getByText('5mm plate, bin sinks 5mm into it')).toBeInTheDocument();
  });

  it('reports the magnet plate raising the bin', () => {
    setExpanded(true);
    setPlate({ ...DEFAULT_BASEPLATE_PARAMS, magnetHoles: true, magnetDepth: mm(2) });
    render(<AssembledHeightBreakdown />);
    // MAGNET_FLOOR (0.5) + 2mm sits under the sockets, so the bin rises 2.5mm.
    expect(screen.getByText('48.9mm')).toBeInTheDocument();
    expect(screen.getByText('7.5mm plate, bin sinks 5mm into it')).toBeInTheDocument();
  });

  it('falls back to a standard plate when the layout has none', () => {
    setPlate(undefined);
    render(<AssembledHeightBreakdown />);
    expect(screen.getByText('46.4mm')).toBeInTheDocument();
  });

  it('adds the lid and its stack grid', () => {
    setDesign({
      height: 6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true },
    });
    setExpanded(true);
    render(<AssembledHeightBreakdown />);
    expect(screen.getByText('Lid above lip')).toBeInTheDocument();
    expect(screen.getByText('Stack grid')).toBeInTheDocument();
  });

  describe('drawer clearance', () => {
    it('stays hidden without a measured drawer height', () => {
      render(<AssembledHeightBreakdown />);
      expect(screen.queryByText(/drawer/i)).not.toBeInTheDocument();
    });

    it('reports the spare room when it fits', () => {
      setDrawerHeight(60);
      render(<AssembledHeightBreakdown />);
      expect(screen.getByText('Fits drawer, 13.6mm to spare')).toBeInTheDocument();
    });

    it('reports the overflow when it does not', () => {
      setDrawerHeight(40);
      render(<AssembledHeightBreakdown />);
      expect(screen.getByText('6.4mm taller than drawer')).toBeInTheDocument();
    });

    it('treats an exact fit as fitting', () => {
      setDrawerHeight(46.4);
      render(<AssembledHeightBreakdown />);
      expect(screen.getByText('Fits drawer, 0mm to spare')).toBeInTheDocument();
    });
  });
});
