import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLabsStore } from '@/core/store';
import { err, ok } from '@/core/result';
import type { Result, LayoutError } from '@/core/result';
import { layoutInvalidOperation } from '@/core/result';
import { binId, designId, gridUnits, heightUnits } from '@/core/types';
import type { Bin, BinUpdates, SlantConfig } from '@/core/types';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { registerLinkedSlantResolver } from '@/shared/utils/placedSlant';
import { BinSlantSection } from './BinSlantSection';

const updateBin = vi.fn((_id: string, _updates: BinUpdates): Result<void, LayoutError> =>
  ok(undefined)
);
vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: () => ({ updateBin }),
}));

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string, vars?: Record<string, string | number>): string =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
}));

const BACK: SlantConfig = { angleDeg: 45, side: 'back' };

function setLabs(enabled: boolean): void {
  useLabsStore.setState((s) => ({
    preferences: {
      ...s.preferences,
      enabledFeatures: { ...s.preferences.enabledFeatures, slant: enabled },
    },
  }));
}

function bin(id: string, y: number, overrides: Partial<Bin> = {}): Bin {
  return createTestBin({
    id: binId(id),
    y: gridUnits(y),
    width: gridUnits(2),
    height: heightUnits(6),
    ...overrides,
  });
}

function renderFor(target: Bin, others: Bin[] = []) {
  const layout = createTestLayout({ bins: [target, ...others] });
  return render(<BinSlantSection bin={target} layout={layout} variant="desktop" />);
}

const toggle = () => screen.getByRole('checkbox', { name: 'binDesigner.slant.title' });

beforeEach(() => {
  updateBin.mockClear();
  updateBin.mockImplementation(() => ok(undefined));
  setLabs(true);
});

afterEach(() => {
  registerLinkedSlantResolver(null);
});

describe('BinSlantSection', () => {
  it('stays out of the way with the labs flag off and nothing slanted', () => {
    setLabs(false);
    renderFor(bin('a', 0));
    expect(screen.queryByTestId('bin-slant-section')).toBeNull();
  });

  it('still shows a placed slant with the flag off, so it can be removed', () => {
    setLabs(false);
    renderFor(bin('a', 0, { slant: BACK }));
    fireEvent.click(toggle());
    expect(updateBin).toHaveBeenCalledWith('a', { slant: null });
  });

  it('turns a placed slant on at 45 degrees toward the back', () => {
    renderFor(bin('a', 0));
    fireEvent.click(toggle());
    expect(updateBin).toHaveBeenCalledWith('a', { slant: BACK });
  });

  it('writes the side and the end support onto the placed slant', () => {
    renderFor(bin('a', 0, { slant: BACK }));
    fireEvent.click(screen.getByRole('radio', { name: 'binDesigner.overhang.side.left' }));
    expect(updateBin).toHaveBeenLastCalledWith('a', { slant: { ...BACK, side: 'left' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'binDesigner.slant.endSupport' }));
    expect(updateBin).toHaveBeenLastCalledWith('a', { slant: { ...BACK, endSupport: true } });
  });

  it("says where a linked design's slant comes from, and offers it back over a placed one", () => {
    registerLinkedSlantResolver(() => ({ config: { angleDeg: 30, side: 'left' } }));
    const linked = { linkedDesignId: designId('d1') };
    const { unmount } = renderFor(bin('a', 0, linked));
    expect(screen.getByText(/inspector\.slant\.fromDesign 30/)).toBeInTheDocument();
    expect(screen.queryByText('inspector.slant.useDesign')).toBeNull();
    unmount();
    renderFor(bin('a', 0, { ...linked, slant: BACK }));
    fireEvent.click(screen.getByText('inspector.slant.useDesign'));
    expect(updateBin).toHaveBeenLastCalledWith('a', { slant: null });
  });

  it('explains what keeps a bin upright and offers no controls', () => {
    registerLinkedSlantResolver(() => ({ blocked: true }));
    renderFor(bin('a', 0, { linkedDesignId: designId('d1') }));
    expect(toggle()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('inspector.slant.heldBy.design')).toBeInTheDocument();
  });

  it('says so when there is no room for the change', () => {
    updateBin.mockImplementation(() => err(layoutInvalidOperation('updateBin', 'collision')));
    renderFor(bin('a', 0));
    fireEvent.click(toggle());
    expect(screen.getByText('inspector.slant.noRoom')).toBeInTheDocument();
  });

  it('matches the row, with the end support on its leading bin', () => {
    renderFor(bin('a', 0, { slant: BACK }), [bin('b', 1), bin('c', 2)]);
    expect(screen.getByText('inspector.slant.issue.mismatch')).toBeInTheDocument();
    fireEvent.click(screen.getByText('inspector.slant.matchRow'));
    expect(updateBin.mock.calls).toEqual([
      ['a', { slant: BACK }],
      ['b', { slant: BACK }],
      ['c', { slant: { ...BACK, endSupport: true } }],
    ]);
  });

  it('still matches the row when the leading bin has no room for its support', () => {
    updateBin.mockImplementation((_id, updates) =>
      updates.slant?.endSupport
        ? err(layoutInvalidOperation('updateBin', 'collision'))
        : ok(undefined)
    );
    renderFor(bin('a', 0, { slant: BACK }), [bin('b', 1)]);
    fireEvent.click(screen.getByText('inspector.slant.matchRow'));
    expect(updateBin).toHaveBeenLastCalledWith('b', { slant: BACK });
    expect(screen.queryByText('inspector.slant.noRoom')).toBeNull();
  });

  it('offers no Match row past a neighbour that is not in the row', () => {
    renderFor(bin('a', 0, { slant: BACK }), [bin('wide', 1, { width: gridUnits(3) })]);
    expect(screen.getByText('inspector.slant.issue.mismatch')).toBeInTheDocument();
    expect(screen.queryByText('inspector.slant.matchRow')).toBeNull();
  });

  it("keeps the design's slant one click away while an overhang holds the bin upright", () => {
    registerLinkedSlantResolver(() => ({ config: { angleDeg: 30, side: 'left' } }));
    renderFor(
      bin('a', 0, {
        linkedDesignId: designId('d1'),
        slant: BACK,
        overhang: { left: 5, right: 0, front: 0, back: 0 },
      })
    );
    expect(screen.getByText('inspector.slant.heldBy.overhang')).toBeInTheDocument();
    fireEvent.click(screen.getByText('inspector.slant.useDesign'));
    expect(updateBin).toHaveBeenLastCalledWith('a', { slant: null });
  });

  it('asks for the end support at the open end of a row', () => {
    renderFor(bin('a', 0, { slant: BACK }));
    expect(screen.getByText('inspector.slant.issue.unsupported')).toBeInTheDocument();
    expect(screen.queryByText('inspector.slant.matchRow')).toBeNull();
  });
});
