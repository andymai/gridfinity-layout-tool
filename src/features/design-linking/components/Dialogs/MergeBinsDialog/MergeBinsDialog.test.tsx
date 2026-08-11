import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MergeBinsDialog } from './MergeBinsDialog';
import { resetAllStores, createTestBin } from '@/test/testUtils';
import { ok, err } from '@/core/result';
import type { MergeBlockedReason, MergePlan } from '../../../domain/mergeBins';

const previewMerge = vi.fn();
const commitMerge = vi.fn();

vi.mock('../../../hooks/useMergeBins', () => ({
  useMergeBins: () => ({
    mergeableBins: [createTestBin({}), createTestBin({})],
    canMerge: true,
    previewMerge,
    commitMerge,
  }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

function plan(overrides: Partial<MergePlan> = {}): MergePlan {
  return {
    // Only the fields the dialog reads; the domain tests cover the rest.
    params: {
      width: 3,
      depth: 2,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
    } as MergePlan['params'],
    isRectangular: true,
    compartmentCount: 4,
    gapCompartmentIds: [],
    warnings: {
      raisedHeightBinIds: [],
      linkedDesignBinIds: [],
      gapCompartmentCount: 0,
      splitEnabled: false,
    },
    ...overrides,
  };
}

describe('MergeBinsDialog', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    document.body.innerHTML = '';
    previewMerge.mockReturnValue(ok(plan()));
    commitMerge.mockResolvedValue(undefined);
  });

  it('describes what the merge will produce', () => {
    render(<MergeBinsDialog open scope="selection" onClose={vi.fn()} />);

    expect(screen.getByText(/designLinking\.merge\.description/)).toBeInTheDocument();
  });

  it('lists no warnings for a clean rectangular merge', () => {
    render(<MergeBinsDialog open scope="selection" onClose={vi.fn()} />);

    expect(screen.queryByText(/designLinking\.merge\.warning/)).not.toBeInTheDocument();
  });

  it('warns that gaps become compartments when the selection is not a rectangle', () => {
    previewMerge.mockReturnValue(
      ok(
        plan({
          isRectangular: false,
          warnings: {
            raisedHeightBinIds: [],
            linkedDesignBinIds: [],
            gapCompartmentCount: 2,
            splitEnabled: false,
          },
        })
      )
    );
    render(<MergeBinsDialog open scope="selection" onClose={vi.fn()} />);

    expect(screen.getByText(/designLinking\.merge\.warning\.gaps/)).toBeInTheDocument();
  });

  it('warns about raised heights, dropped linked designs and bed splitting together', () => {
    previewMerge.mockReturnValue(
      ok(
        plan({
          warnings: {
            raisedHeightBinIds: [
              'a',
              'b',
            ] as unknown as MergePlan['warnings']['raisedHeightBinIds'],
            linkedDesignBinIds: ['c'] as unknown as MergePlan['warnings']['linkedDesignBinIds'],
            gapCompartmentCount: 0,
            splitEnabled: true,
          },
        })
      )
    );
    render(<MergeBinsDialog open scope="selection" onClose={vi.fn()} />);

    expect(screen.getByText(/warning\.raisedHeight/)).toBeInTheDocument();
    expect(screen.getByText(/warning\.linkedDesigns/)).toBeInTheDocument();
    expect(screen.getByText(/warning\.split/)).toBeInTheDocument();
  });

  it('re-plans with a flat base when the toggle is checked', () => {
    render(<MergeBinsDialog open scope="selection" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(previewMerge).toHaveBeenLastCalledWith({ baseStyle: 'flat' });
  });

  it('commits the plan and closes on confirm', async () => {
    const onClose = vi.fn();
    render(<MergeBinsDialog open scope="selection" onClose={onClose} />);

    fireEvent.click(screen.getByText('designLinking.merge.confirm'));

    await waitFor(() => expect(commitMerge).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
  });

  describe('when the merge is blocked', () => {
    function blockWith(reason: MergeBlockedReason): void {
      previewMerge.mockReturnValue(err(reason));
    }

    it('explains a grid overflow with the numbers involved', () => {
      blockWith({ kind: 'grid-overflow', cols: 14, rows: 3, max: 12 });
      render(<MergeBinsDialog open scope="selection" onClose={vi.fn()} />);

      expect(screen.getByText(/blocked\.gridOverflow.*14/)).toBeInTheDocument();
    });

    it('offers no confirm action, so a blocked merge cannot be committed', () => {
      blockWith({ kind: 'too-large', width: 20, depth: 2, max: 16 });
      render(<MergeBinsDialog open scope="selection" onClose={vi.fn()} />);

      expect(screen.queryByText('designLinking.merge.confirm')).not.toBeInTheDocument();
    });

    it('surfaces a validation failure message verbatim', () => {
      blockWith({ kind: 'invalid-params', code: 'COMPARTMENT_TOO_SMALL', message: 'Too small' });
      render(<MergeBinsDialog open scope="selection" onClose={vi.fn()} />);

      expect(screen.getByText('Too small')).toBeInTheDocument();
    });
  });
});
