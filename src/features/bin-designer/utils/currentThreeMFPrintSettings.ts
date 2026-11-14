import { useSettingsStore } from '@/core/store';
import { buildThreeMFPrintSettings } from '@/shared/generation/stlTo3mf';
import type { ThreeMFPrintSettings } from '@/shared/generation/export';
import type { BinParams } from '../types';
import { estimatePrint } from './printEstimates';

/**
 * 3MF print settings from the store as it is now. Read at export time, not
 * from a render, so a settings change made mid-export is not lost to a stale
 * closure.
 */
export function currentThreeMFPrintSettings(params: BinParams): ThreeMFPrintSettings {
  const printSettings = useSettingsStore.getState().settings.printSettings;
  return buildThreeMFPrintSettings(printSettings, estimatePrint(params, printSettings));
}
