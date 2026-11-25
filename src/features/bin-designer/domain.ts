import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';
import type { PrintSettings } from '@/shared/printSettings';
import { DEFAULT_BIN_PARAMS } from './constants/defaults';
import { estimatePrint } from './utils/printEstimates';
import type { PrintEstimate } from './utils/printEstimates';

export type { PrintEstimate } from './utils/printEstimates';

/**
 * The React-free entry of this feature for the agent tools, which run in a
 * Vercel function. The print estimate of a standard bin, the designer's
 * defaults at a given size, as the bin designer computes it.
 */
export function estimateStandardBin(
  size: { readonly width: number; readonly depth: number; readonly height: number },
  printSettings: Partial<PrintSettings> = {}
): PrintEstimate {
  return estimatePrint(
    { ...DEFAULT_BIN_PARAMS, width: size.width, depth: size.depth, height: size.height },
    { ...DEFAULT_PRINT_SETTINGS, ...printSettings }
  );
}
