import { beforeEach, describe, expect, it } from 'vitest';
import { gridUnits, heightUnits, mm } from '@/core/types';
import { createTestLayout } from '@/test/testUtils';
import { INITIAL_DRAWER_FIT_OFFER_STATE, useDrawerFitOfferStore } from './drawerFitOffer';

describe('useDrawerFitOfferStore', () => {
  beforeEach(() => {
    useDrawerFitOfferStore.setState(INITIAL_DRAWER_FIT_OFFER_STATE);
  });

  it('anchors the offer to the grid and the pitch of each axis', () => {
    const layout = createTestLayout({
      drawer: { width: gridUnits(9), depth: gridUnits(11), height: heightUnits(6) },
      gridUnitMm: mm(42),
      gridUnitMmY: mm(40),
    });

    useDrawerFitOfferStore.getState().offerFor('layout-1', layout);

    expect(useDrawerFitOfferStore.getState().offer).toEqual({
      layoutId: 'layout-1',
      width: 9,
      depth: 11,
      pitchX: 42,
      pitchY: 40,
    });
  });

  it('clears the offer', () => {
    useDrawerFitOfferStore.getState().offerFor('layout-1', createTestLayout());

    useDrawerFitOfferStore.getState().clear();

    expect(useDrawerFitOfferStore.getState().offer).toBeNull();
  });
});
