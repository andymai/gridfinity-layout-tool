import type { BinParams } from '@/shared/types/bin';

/** Leave a small flat land so opposite edge fillets never meet tangentially. */
export function maxRimFilletRadius(wallThickness: number): number {
  return Math.max(0.1, Math.floor((wallThickness / 2 - 0.01) * 100) / 100);
}

export function maxBinRimFilletRadius(params: BinParams): number {
  const hasDividers = new Set(params.compartments.cells).size > 1;
  return maxRimFilletRadius(
    hasDividers
      ? Math.min(params.wallThickness, params.compartments.thickness)
      : params.wallThickness
  );
}

export function rimFilletAvailable(params: BinParams): boolean {
  return !params.base.stackingLip && !params.base.solid && !params.cellMask;
}

export function effectiveRimFilletRadius(params: BinParams): number {
  if (!params.base.rimFillet || !rimFilletAvailable(params)) return 0;
  const radius = params.base.rimFilletRadius ?? 0.4;
  return Math.min(
    maxBinRimFilletRadius(params),
    Math.max(0.1, Number.isFinite(radius) ? radius : 0.4)
  );
}
