import { describe, it, expect, beforeEach } from 'vitest';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { buildFullParams } from '../utils/buildFullParams';
import { storedGenerationInput } from './storedGenerationInput';

describe('storedGenerationInput', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('resolves the stored plate exactly as the params-change effect does', () => {
    const stored = { ...DEFAULT_BASEPLATE_PARAMS, ecoPlate: true };
    useLayoutStore.setState((state) => ({
      layout: {
        ...state.layout,
        gridUnitMm: 42,
        printBedSize: 220,
        printBedDepth: 180,
        lowProfileBase: true,
        baseplateParams: stored,
        drawer: { ...state.layout.drawer, width: 5, depth: 3, fractionalEdgeX: 'start' },
      },
    }));
    const nozzle = useSettingsStore.getState().settings.printSettings.nozzleSizeMm;
    const layout = useLayoutStore.getState().layout;

    const input = storedGenerationInput();

    expect(input.bedWidthMm).toBe(220);
    expect(input.bedDepthMm).toBe(180);
    expect(input.params).toEqual(
      buildFullParams(
        stored,
        5,
        3,
        42,
        'start',
        'end',
        nozzle,
        layout.drawer.outline,
        layout.magnetAnchor,
        42,
        0,
        0,
        true,
        { widthMm: 220, depthMm: 180 }
      )
    );
    expect(input.params.ecoPlate).toBe(true);
  });

  it('uses the bed width for its depth when no depth is set', () => {
    useLayoutStore.setState((state) => ({
      layout: { ...state.layout, printBedSize: 256, printBedDepth: undefined },
    }));
    expect(storedGenerationInput().bedDepthMm).toBe(256);
  });
});
