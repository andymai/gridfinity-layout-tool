import { useDesignerStore } from '@/features/bin-designer/store';
import { getFeatureStatus, resolveConstraints } from '@/shared/constraints';
import type { BinParams, ScanSource } from '@/features/bin-designer/types';

/** The params a scan runs on: the bin as Custom Cutouts, switched if it isn't already. */
function asCustomCutouts(params: BinParams): BinParams {
  if (params.style === 'solid' && params.base.solid) return params;
  return resolveConstraints(params, { feature: 'style.solid', enabled: true }).params;
}

/** Whether a scan can add cutouts to this bin once it is Custom Cutouts. */
export function canStartScan(params: BinParams): boolean {
  return getFeatureStatus(asCustomCutouts(params), 'cutouts').available;
}

let lastAnswer: { readonly params: BinParams; readonly canStart: boolean } | null = null;

/**
 * `canStartScan` as a store selector: the constraint check reruns only when the
 * params object changes, and a component re-renders only when the answer does.
 */
export function selectCanStartScan(state: { readonly params: BinParams }): boolean {
  if (lastAnswer?.params !== state.params) {
    lastAnswer = { params: state.params, canStart: canStartScan(state.params) };
  }
  return lastAnswer.canStart;
}

/**
 * Open scanning on the bin, switching the interior to Custom Cutouts first the
 * way its card does (one undo step). On desktop that is the cut editor with the
 * "Scan a tool" dialog up, where `growBin` makes each scan grow the bin to fit.
 * Below desktop, where the editor doesn't render, it is the phone scan flow.
 */
export function startScan(source: ScanSource, { growBin = false, phone = false } = {}): void {
  const { params, setParams, setInteriorCard, openScanDialog, openPhoneScan } =
    useDesignerStore.getState();
  const next = asCustomCutouts(params);
  if (next !== params) setParams(next);
  setInteriorCard('solid');
  if (phone) openPhoneScan(source);
  else openScanDialog(source, growBin);
}
