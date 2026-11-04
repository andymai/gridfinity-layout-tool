import { useDesignerStore } from '@/features/bin-designer/store';
import { getFeatureStatus, resolveConstraints } from '@/shared/constraints';
import type { BinParams, ScanSource } from '@/features/bin-designer/types';

/** The params a scan runs on: the bin as Custom Cutouts, switched if it isn't already. */
function asCustomCutouts(params: BinParams): BinParams {
  if (params.style === 'solid') return params;
  return resolveConstraints(params, { feature: 'style.solid', enabled: true }).params;
}

/** Whether a scan can add cutouts to this bin once it is Custom Cutouts. */
export function canStartScan(params: BinParams): boolean {
  return getFeatureStatus(asCustomCutouts(params), 'cutouts').available;
}

/**
 * Open the cut editor on the bin with the "Scan a tool" dialog up, switching
 * the interior to Custom Cutouts first the way its card does (one undo step).
 * `growBin` makes each scan added in this dialog grow the bin to fit.
 */
export function startScan(source: ScanSource, { growBin = false } = {}): void {
  const { params, setParams, setInteriorCard, openScanDialog } = useDesignerStore.getState();
  const next = asCustomCutouts(params);
  if (next !== params) setParams(next);
  setInteriorCard('solid');
  openScanDialog(source, growBin);
}
