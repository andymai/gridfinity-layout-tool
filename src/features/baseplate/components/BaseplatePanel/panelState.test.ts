// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { _resetUndoCaptureState } from '@/core/cqrs';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { mm } from '@/core/types';
import type { StoredBaseplateParams } from '@/core/types';
import { resetAllStores } from '@/test/testUtils';
import {
  finishBaseplateParamsDrag,
  previewBaseplateParam,
  replaceBaseplateParams,
  updateBaseplateParams,
  updateBaseplateParam,
} from './panelState';

vi.mock('@/shared/analytics/posthog/conversionEvents', () => ({
  trackToolActivated: vi.fn(),
}));

import { trackToolActivated } from '@/shared/analytics/posthog/conversionEvents';

function params(): StoredBaseplateParams {
  return useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
}

function undoSteps(): number {
  return useHistoryStore.getState().past.length;
}

function undo(): void {
  useHistoryStore.getState().undo();
}

beforeEach(() => {
  resetAllStores();
  useHistoryStore.getState().clear();
  _resetUndoCaptureState();
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

  it('records each edit as one undo step that takes back only that edit', () => {
    updateBaseplateParams({ paddingLeft: mm(7) });
    updateBaseplateParams({ magnetHoles: !DEFAULT_BASEPLATE_PARAMS.magnetHoles });

    expect(undoSteps()).toBe(2);
    expect(useHistoryStore.getState().past[1]?.commandType).toBe('layout.setBaseplateParams');

    undo();
    expect(params().magnetHoles).toBe(DEFAULT_BASEPLATE_PARAMS.magnetHoles);
    expect(params().paddingLeft).toBe(7);

    undo();
    expect(params().paddingLeft).toBe(DEFAULT_BASEPLATE_PARAMS.paddingLeft);
  });

  it('takes an edit the command refuses, so a value saved outside its bounds never locks the panel', () => {
    // Above the command's corner radius bound, which the store action accepts.
    useLayoutStore
      .getState()
      .setBaseplateParams({ ...DEFAULT_BASEPLATE_PARAMS, cornerRadius: mm(250) });

    updateBaseplateParams({ magnetHoles: !DEFAULT_BASEPLATE_PARAMS.magnetHoles });

    expect(params().magnetHoles).toBe(!DEFAULT_BASEPLATE_PARAMS.magnetHoles);
    expect(undoSteps()).toBe(1);
    undo();
    expect(params().magnetHoles).toBe(DEFAULT_BASEPLATE_PARAMS.magnetHoles);
    expect(params().cornerRadius).toBe(250);
  });
});

describe('updateBaseplateParam', () => {
  it('sets a single key', () => {
    updateBaseplateParam('solidFloor', true);

    expect(useLayoutStore.getState().layout.baseplateParams?.solidFloor).toBe(true);
  });
});

describe('replaceBaseplateParams', () => {
  it('writes whole params as one undo step, without reporting an edit', () => {
    replaceBaseplateParams({ ...DEFAULT_BASEPLATE_PARAMS, syncWithLayout: false });

    expect(params().syncWithLayout).toBe(false);
    expect(undoSteps()).toBe(1);
    expect(trackToolActivated).not.toHaveBeenCalled();
  });
});

describe('slider drags', () => {
  it('records a whole drag as one undo step back to the value before it', () => {
    const before = params().magnetDepth;
    previewBaseplateParam('magnetDepth', mm(2.5));
    previewBaseplateParam('magnetDepth', mm(3));
    previewBaseplateParam('magnetDepth', mm(3.5));

    expect(params().magnetDepth).toBe(3.5);
    expect(undoSteps()).toBe(0);

    finishBaseplateParamsDrag();
    expect(undoSteps()).toBe(1);
    expect(params().magnetDepth).toBe(3.5);

    undo();
    expect(params().magnetDepth).toBe(before);
  });

  it('records nothing when the drag never moved the plate', () => {
    finishBaseplateParamsDrag();

    expect(undoSteps()).toBe(0);
  });

  it('closes an open drag as its own step before a discrete edit', () => {
    const before = params().magnetDepth;
    previewBaseplateParam('magnetDepth', mm(3));
    updateBaseplateParams({ magnetHoles: !DEFAULT_BASEPLATE_PARAMS.magnetHoles });

    expect(undoSteps()).toBe(2);
    undo();
    expect(params().magnetDepth).toBe(3);
    undo();
    expect(params().magnetDepth).toBe(before);
  });

  it('drops a drag that another write overtook, rather than restore the state before it', () => {
    updateBaseplateParams({ magnetHoles: !DEFAULT_BASEPLATE_PARAMS.magnetHoles });
    previewBaseplateParam('magnetDepth', mm(3));
    undo();

    finishBaseplateParamsDrag();

    expect(undoSteps()).toBe(0);
    expect(params().magnetHoles).toBe(DEFAULT_BASEPLATE_PARAMS.magnetHoles);
  });

  it('reports baseplate activation from a drag frame', () => {
    previewBaseplateParam('magnetDepth', mm(3));

    expect(trackToolActivated).toHaveBeenCalledWith('baseplate', 'params_changed');
  });
});
