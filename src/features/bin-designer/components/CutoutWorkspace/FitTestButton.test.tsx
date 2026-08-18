import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FitTestButton } from './FitTestButton';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const downloadCard = vi.fn().mockResolvedValue(true);
let canExport = true;

vi.mock('../../hooks/useFitTestExport', () => ({
  FIT_TEST_BASE_NAME: 'fit-test',
  useFitTestExport: () => ({ isExporting: false, canExport, downloadCard }),
}));

const BUTTON = 'binDesigner.cutouts.fitTest.button';

const cutout = (over: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'circle',
  x: 10,
  y: 10,
  width: 12,
  depth: 12,
  cutDepth: 8,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...over,
});

function setDesign(over: Partial<BinParams> = {}, cutouts: Cutout[] = [cutout()]): void {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 4,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts,
      cutoutConfig: { topOffset: 0 },
      ...over,
    },
  });
}

describe('FitTestButton', () => {
  beforeEach(() => {
    resetAllStores();
    downloadCard.mockClear();
    canExport = true;
  });

  it('stays away until the design has something to fit-test', () => {
    setDesign({}, []);
    render(<FitTestButton />);
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull();
  });

  it('stays away on a hollow bin, which has no fill to slice', () => {
    setDesign({ base: { ...DEFAULT_BIN_PARAMS.base, solid: false } });
    render(<FitTestButton />);
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull();
  });

  it('offers the fit test once a cutout exists', () => {
    setDesign();
    render(<FitTestButton />);
    expect(screen.getByRole('button', { name: BUTTON })).toBeEnabled();
  });

  it('disables the button when no bridge is ready', () => {
    setDesign();
    canExport = false;
    render(<FitTestButton />);
    expect(screen.getByRole('button', { name: BUTTON })).toBeDisabled();
  });

  it('opens the dialog and downloads at the default thickness', async () => {
    setDesign({}, [cutout({ cutDepth: 4 })]);
    render(<FitTestButton />);
    fireEvent.click(screen.getByRole('button', { name: BUTTON }));

    const download = await screen.findByRole('button', { name: /download/i });
    fireEvent.click(download);

    await waitFor(() => expect(downloadCard).toHaveBeenCalled());
    // clamp(deepest=4, 3, 5) is the value the dialog opens on.
    expect(downloadCard.mock.calls[0][0]).toMatchObject({ format: 'stl', thicknessMm: 4 });
  });

  it('passes the configured print bed so an oversize card is split', async () => {
    setDesign({ width: 8 });
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, defaultPrintBedSize: 180, defaultPrintBedDepth: 180 },
    }));
    render(<FitTestButton />);
    fireEvent.click(screen.getByRole('button', { name: BUTTON }));
    fireEvent.click(await screen.findByRole('button', { name: /download/i }));

    await waitFor(() => expect(downloadCard).toHaveBeenCalled());
    expect(downloadCard.mock.calls[0][0].bed).toEqual({ width: 180, depth: 180 });
  });

  it('warns before export when the card will not fit the bed', async () => {
    setDesign({ width: 8 });
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, defaultPrintBedSize: 180, defaultPrintBedDepth: 180 },
    }));
    render(<FitTestButton />);
    fireEvent.click(screen.getByRole('button', { name: BUTTON }));
    // The split is planned client-side from the same plan the worker cuts from,
    // so the dialog can say so before anything is generated.
    expect(await screen.findByText(/fitTest.warnSplit/)).toBeInTheDocument();
  });

  it('refuses STEP for a design with imported mesh cutouts', async () => {
    setDesign(
      {
        meshAssets: {
          m1: {
            id: 'm1',
            name: 'tool',
            data: new Uint8Array([1]),
            triangleCount: 1,
            bbox: { min: [0, 0, 0], max: [1, 1, 1] },
          } as never,
        },
      },
      [cutout({ shape: 'mesh', meshId: 'm1' })]
    );
    render(<FitTestButton />);
    fireEvent.click(screen.getByRole('button', { name: BUTTON }));

    // The format picker is a radio group, and it marks an unavailable format
    // with aria-disabled rather than the disabled attribute so the option stays
    // focusable and can explain itself.
    const step = await screen.findByRole('radio', { name: /step/i });
    expect(step).toHaveAttribute('aria-disabled', 'true');
  });
});
