import { describe, it, expect, afterEach } from 'vitest';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { currentThreeMFPrintSettings } from './currentThreeMFPrintSettings';

describe('currentThreeMFPrintSettings', () => {
  const initial = useSettingsStore.getState().settings;
  afterEach(() => {
    useSettingsStore.setState({ settings: initial });
  });

  it('reads the print settings the store holds at call time', () => {
    useSettingsStore.setState({
      settings: {
        ...initial,
        printSettings: { ...initial.printSettings, layerHeightMm: 0.28, infillPercent: 35 },
      },
    });

    const result = currentThreeMFPrintSettings(DEFAULT_BIN_PARAMS);

    expect(result.layerHeight).toBe(0.28);
    expect(result.infillPercent).toBe(35);
    expect(result.estimatedMinutes).toBeGreaterThan(0);
  });
});
