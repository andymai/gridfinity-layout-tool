import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MakeBentoDialog } from './MakeBentoDialog';
import { ok, err } from '@/core/result';
import { binId } from '@/core/types';
import type { MergePlan } from '../../../domain/mergeBins';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('./CompartmentPreview', () => ({
  CompartmentPreview: () => <div data-testid="compartment-preview" />,
}));

const mocks = vi.hoisted(() => ({
  commitBento: vi.fn(async () => true),
  previewBento: vi.fn(),
  moveBinToStaging: vi.fn(),
  setSelectedBins: vi.fn(),
  bins: [
    { id: 'a', height: 3 },
    { id: 'b', height: 6 },
  ],
}));

vi.mock('../../../hooks/useBento', () => ({
  useBento: () => ({
    mergeableBins: mocks.bins,
    canMerge: true,
    previewBento: mocks.previewBento,
    defaultName: 'Test Layout bento',
    commitBento: mocks.commitBento,
  }),
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({ moveBinToStaging: mocks.moveBinToStaging }),
}));

vi.mock('@/core/store', () => ({
  useSelectionStore: (selector: (s: unknown) => unknown) =>
    selector({ setSelectedBins: mocks.setSelectedBins }),
}));

function plan(overrides: Partial<MergePlan['warnings']> = {}): MergePlan {
  return {
    params: {
      width: 2,
      depth: 1,
      height: 6,
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
    },
    isRectangular: true,
    compartmentCount: 2,
    gapCompartmentIds: [],
    warnings: {
      raisedHeightBinIds: [],
      linkedDesignBinIds: [],
      gapCompartmentCount: 0,
      splitEnabled: false,
      trappedBinIds: [],
      ...overrides,
    },
  } as unknown as MergePlan;
}

describe('MakeBentoDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.previewBento.mockReturnValue(ok(plan()));
  });

  it('shows the plan and lets it be created', async () => {
    const onClose = vi.fn();
    render(<MakeBentoDialog open onClose={onClose} />);

    expect(screen.getByTestId('compartment-preview')).toBeInTheDocument();

    fireEvent.click(screen.getByText('designLinking.bento.confirm'));
    await vi.waitFor(() => expect(mocks.commitBento).toHaveBeenCalled());

    expect(mocks.commitBento).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Layout bento', replaceBins: false })
    );
  });

  it('keeps the dialog open when the save failed', async () => {
    mocks.commitBento.mockResolvedValueOnce(false);
    const onClose = vi.fn();
    render(<MakeBentoDialog open onClose={onClose} />);

    fireEvent.click(screen.getByText('designLinking.bento.confirm'));
    await vi.waitFor(() => expect(mocks.commitBento).toHaveBeenCalled());

    // Dismissing here would leave a toast as the only trace, options gone.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('passes an edited name through to the commit', async () => {
    render(<MakeBentoDialog open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('designLinking.bento.nameLabel'), {
      target: { value: 'Screwdrivers' },
    });
    fireEvent.click(screen.getByText('designLinking.bento.confirm'));
    await vi.waitFor(() => expect(mocks.commitBento).toHaveBeenCalled());

    expect(mocks.commitBento).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Screwdrivers' })
    );
  });

  it('asks the planner for a flat base when chosen', () => {
    render(<MakeBentoDialog open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('designLinking.bento.flatBase'));

    expect(mocks.previewBento).toHaveBeenLastCalledWith(
      expect.objectContaining({ baseStyle: 'flat' })
    );
  });

  it('carries the replace-bins choice into the commit', async () => {
    render(<MakeBentoDialog open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText(/designLinking.bento.replaceBins/));
    fireEvent.click(screen.getByText('designLinking.bento.confirm'));
    await vi.waitFor(() => expect(mocks.commitBento).toHaveBeenCalled());

    expect(mocks.commitBento).toHaveBeenCalledWith(expect.objectContaining({ replaceBins: true }));
  });

  describe('trapped bins', () => {
    beforeEach(() => {
      mocks.previewBento.mockReturnValue(ok(plan({ trappedBinIds: [binId('c')] })));
    });

    it('blocks creation, because two parts cannot share one space', () => {
      render(<MakeBentoDialog open onClose={vi.fn()} />);

      expect(screen.getByText('designLinking.bento.confirm').closest('button')).toBeDisabled();
    });

    it('offers to pull the trapped bins into the selection', () => {
      render(<MakeBentoDialog open onClose={vi.fn()} />);

      fireEvent.click(screen.getByText('designLinking.bento.trappedInclude'));

      expect(mocks.setSelectedBins).toHaveBeenCalledWith(['a', 'b', binId('c')]);
    });

    it('offers to move the trapped bins to the stash', () => {
      render(<MakeBentoDialog open onClose={vi.fn()} />);

      fireEvent.click(screen.getByText('designLinking.bento.trappedStash'));

      expect(mocks.moveBinToStaging).toHaveBeenCalledWith(binId('c'));
    });
  });

  it('explains a blocked plan instead of showing options', () => {
    mocks.previewBento.mockReturnValue(err({ kind: 'too-few-bins', count: 1 }));
    render(<MakeBentoDialog open onClose={vi.fn()} />);

    expect(screen.getByText('designLinking.bento.blocked.tooFewBins')).toBeInTheDocument();
    expect(screen.queryByTestId('compartment-preview')).not.toBeInTheDocument();
    expect(screen.queryByText('designLinking.bento.confirm')).not.toBeInTheDocument();
  });
});
