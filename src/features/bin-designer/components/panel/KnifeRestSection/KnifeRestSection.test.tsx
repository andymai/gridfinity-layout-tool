import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { Cutout, KnifeSpec } from '@/features/bin-designer/types';
import { KnifeRestSection } from './KnifeRestSection';

// Echoes the key like the shared mock, but keeps the interpolated values: the
// summary's job is to name the part the design would gain, and a key with no
// placeholder in its own text drops them.
vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string, vars?: Record<string, string | number>): string =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
}));

const CHEF: KnifeSpec = {
  bladeLengthMm: 205,
  heelHeightMm: 47,
  spineThicknessMm: 2.3,
  handleWidthMm: 23,
  handleHeightMm: 23,
  openEnd: 'end',
};

/** An 8" chef slot exiting the right wall — what a rest exists to serve. */
const KNIFE_SLOT: Cutout = {
  id: 'k1',
  shape: 'knifeSlot',
  x: 20,
  y: 16,
  width: 215,
  depth: 3.8,
  cutDepth: 51,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  knife: CHEF,
};

function setParams(over: Partial<typeof DEFAULT_BIN_PARAMS> = {}): void {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 1,
      height: 8,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [KNIFE_SLOT],
      ...over,
    },
  });
}

const knifeRest = () => useDesignerStore.getState().params.knifeRest;
const toggle = () => screen.getByRole('switch', { name: 'binDesigner.knifeRest.title' });

beforeEach(() => setParams());

describe('KnifeRestSection', () => {
  it('explains a design with nothing to rest instead of offering a dead toggle', () => {
    setParams({ cutouts: [] });
    render(<KnifeRestSection />);
    expect(screen.getByText('binDesigner.knifeRest.needsSlots')).toBeInTheDocument();
    expect(toggle()).toBeDisabled();
  });

  it('refuses an enclosed slot, which never leaves the block', () => {
    setParams({ cutouts: [{ ...KNIFE_SLOT, knife: { ...CHEF, openEnd: undefined } }] });
    render(<KnifeRestSection />);
    expect(screen.getByText('binDesigner.knifeRest.needsSlots')).toBeInTheDocument();
  });

  it('turns the rest on with a bare enabled config', () => {
    render(<KnifeRestSection />);
    fireEvent.click(toggle());
    expect(knifeRest()).toEqual({ enabled: true });
  });

  it('keeps the settings when the rest is turned back off', () => {
    setParams({ knifeRest: { enabled: true, style: 'integrated', grooveDepthMm: 9 } });
    render(<KnifeRestSection />);
    fireEvent.click(toggle());
    expect(knifeRest()).toEqual({ enabled: false, style: 'integrated', grooveDepthMm: 9 });
  });

  it('offers the companion fields only for the companion style', () => {
    setParams({ knifeRest: { enabled: true } });
    render(<KnifeRestSection />);
    expect(screen.getByLabelText('binDesigner.knifeRest.gapAria')).toBeInTheDocument();
    expect(screen.getByLabelText('binDesigner.knifeRest.depthAria')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'binDesigner.knifeRest.style.integrated' }));

    expect(knifeRest()?.style).toBe('integrated');
    expect(screen.queryByLabelText('binDesigner.knifeRest.gapAria')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('binDesigner.knifeRest.depthAria')).not.toBeInTheDocument();
  });

  it('writes the companion gap through', () => {
    setParams({ knifeRest: { enabled: true } });
    render(<KnifeRestSection />);
    const gap = screen.getByLabelText('binDesigner.knifeRest.gapAria');
    fireEvent.change(gap, { target: { value: '30' } });
    fireEvent.blur(gap);
    expect(knifeRest()?.gapMm).toBe(30);
  });

  it('writes the groove depth from behind Customize', () => {
    setParams({ knifeRest: { enabled: true } });
    render(<KnifeRestSection />);
    fireEvent.click(screen.getByRole('button', { name: 'common.customize' }));
    const groove = screen.getByLabelText('binDesigner.knifeRest.grooveDepthAria');
    fireEvent.change(groove, { target: { value: '9' } });
    fireEvent.blur(groove);
    expect(knifeRest()?.grooveDepthMm).toBe(9);
  });

  it('summarises the part the design would gain', () => {
    setParams({ knifeRest: { enabled: true } });
    render(<KnifeRestSection />);
    // Chef handle 23mm below a 56mm block top, plus the 6mm groove, snaps up to
    // the next whole height unit: 6u × 7mm.
    expect(
      screen.getByText('binDesigner.knifeRest.summary binDesigner.knifeRest.style.companion 42')
    ).toBeInTheDocument();
  });
});
