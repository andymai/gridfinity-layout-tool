import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColorZoneEditing } from './useColorZoneEditing';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useRecentColorsStore } from '@/features/bin-designer/store/recentColorsStore';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';

describe('useColorZoneEditing', () => {
  beforeEach(() => {
    useRecentColorsStore.setState({ recentColors: [] });
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        featureColors: {
          ...DEFAULT_FEATURE_COLOR_CONFIG,
          enabled: true,
          body: '#aabbcc',
          base: '#112233',
        },
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: true },
      },
    });
  });

  it('reads the current color and a default for the zone', () => {
    const { result } = renderHook(() => useColorZoneEditing('body'));
    expect(result.current.color).toBe('#aabbcc');
    expect(result.current.defaultColor).toBe(DEFAULT_FEATURE_COLOR_CONFIG.body);
    expect(result.current.zoneLabel.length).toBeGreaterThan(0);
    expect(result.current.bodyColor).toBe('#aabbcc');
  });

  it('onChange writes the zone color through the store and remembers it', () => {
    const { result } = renderHook(() => useColorZoneEditing('body'));
    act(() => result.current.onChange('#ff0000'));
    expect(useDesignerStore.getState().params.featureColors.body).toBe('#ff0000');
    expect(useRecentColorsStore.getState().recentColors).toContain('#ff0000');
  });

  it('excludes the zone’s own color from otherColors but includes sibling zones', () => {
    const { result } = renderHook(() => useColorZoneEditing('body'));
    // base (#112233) is an active zone with a different color → appears.
    expect(result.current.otherColors).toContain('#112233');
    expect(result.current.otherColors).not.toContain('#aabbcc');
  });

  it('resolves a lip cell zone’s color from the cells map', () => {
    useDesignerStore.setState({
      params: {
        ...useDesignerStore.getState().params,
        featureColors: {
          ...useDesignerStore.getState().params.featureColors,
          lip: {
            corners: 4,
            bands: 1,
            cells: {
              ...useDesignerStore.getState().params.featureColors.lip.cells,
              'lip:frontLeft:0': '#abcabc',
            },
          },
        },
      },
    });
    const { result } = renderHook(() => useColorZoneEditing('lip:frontLeft:0'));
    expect(result.current.color).toBe('#abcabc');
    expect(result.current.defaultColor).toBe(DEFAULT_FEATURE_COLOR_CONFIG.body);
  });
});
