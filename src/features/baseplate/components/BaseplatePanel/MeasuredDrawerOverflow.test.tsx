import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MeasuredDrawerOverflow } from './MeasuredDrawerOverflow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { mm } from '@/core/types';
import type { StoredBaseplateParams } from '@/core/types';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string, params?: Record<string, unknown>): string =>
      params ? `${key} ${JSON.stringify(params)}` : key,
}));

const STALE: StoredBaseplateParams = {
  ...DEFAULT_BASEPLATE_PARAMS,
  paddingLeft: mm(10.5),
  paddingRight: mm(10.5),
  paddingFront: mm(0),
  paddingBack: mm(21),
  paddingAnchor: 'bc',
};

function seed(measuredMm: { width: number; depth: number } | undefined): void {
  useLayoutStore.setState((state) => ({
    layout: {
      ...state.layout,
      drawer: { ...state.layout.drawer, ...(measuredMm ? { measuredMm } : {}) },
      baseplateParams: STALE,
    },
  }));
}

function renderNotice(params: StoredBaseplateParams = STALE): void {
  render(
    <MeasuredDrawerOverflow
      baseplateParams={params}
      gridWidthMm={525}
      gridDepthMm={483}
      outerWidthMm={525 + params.paddingLeft + params.paddingRight}
      outerDepthMm={483 + params.paddingFront + params.paddingBack}
    />
  );
}

describe('MeasuredDrawerOverflow', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('stays hidden without a measured drawer', () => {
    seed(undefined);
    renderNotice();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stays hidden when the plate fits the drawer', () => {
    seed({ width: 560, depth: 520 });
    renderNotice();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('names the overflow and the measured drawer', () => {
    seed({ width: 541, depth: 496 });
    renderNotice();
    expect(screen.getByText(/drawerOverflow/).textContent).toBe(
      'baseplate.drawerOverflow {"width":"5","depth":"8","drawerWidth":"541","drawerDepth":"496"}'
    );
  });

  it('resizes the padding to fill the drawer exactly', () => {
    seed({ width: 541, depth: 496 });
    renderNotice();
    fireEvent.click(screen.getByRole('button', { name: 'baseplate.fitPaddingToDrawer' }));
    expect(useLayoutStore.getState().layout.baseplateParams).toMatchObject({
      paddingLeft: 8,
      paddingRight: 8,
      paddingFront: 0,
      paddingBack: 13,
      paddingAnchor: 'bc',
    });
  });

  it('offers no fix when padding is already gone and the grid itself overflows', () => {
    seed({ width: 520, depth: 480 });
    renderNotice({
      ...STALE,
      paddingLeft: mm(0),
      paddingRight: mm(0),
      paddingBack: mm(0),
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
