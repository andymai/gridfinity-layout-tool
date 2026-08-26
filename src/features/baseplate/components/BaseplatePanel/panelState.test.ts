// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { resetAllStores } from '@/test/testUtils';
import { updateBaseplateParams, updateBaseplateParam } from './panelState';

vi.mock('@/shared/analytics/posthog/conversionEvents', () => ({
  trackToolActivated: vi.fn(),
}));

import { trackToolActivated } from '@/shared/analytics/posthog/conversionEvents';

beforeEach(() => {
  resetAllStores();
  vi.mocked(trackToolActivated).mockReset();
});

describe('updateBaseplateParams', () => {
  it('merges the patch over current params in the layout store', () => {
    updateBaseplateParams({ magnetHoles: true });

    expect(useLayoutStore.getState().layout.baseplateParams).toEqual({
      ...DEFAULT_BASEPLATE_PARAMS,
      magnetHoles: true,
    });
  });

  it('preserves earlier patches when applying later ones', () => {
    updateBaseplateParams({ magnetHoles: true });
    updateBaseplateParams({ lightweight: false });

    expect(useLayoutStore.getState().layout.baseplateParams).toMatchObject({
      magnetHoles: true,
      lightweight: false,
    });
  });

  it('reports baseplate activation on every param change', () => {
    updateBaseplateParams({ magnetHoles: true });

    expect(trackToolActivated).toHaveBeenCalledWith('baseplate', 'params_changed');
  });
});

describe('updateBaseplateParam', () => {
  it('sets a single key', () => {
    updateBaseplateParam('solidFloor', true);

    expect(useLayoutStore.getState().layout.baseplateParams?.solidFloor).toBe(true);
  });
});
