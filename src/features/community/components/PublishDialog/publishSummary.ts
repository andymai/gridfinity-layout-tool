import type { BinParams } from '@/shared/types/bin';
import type { ItemEnvelope } from '@/shared/types/item';
import type { AssemblyStructure } from '@/shared/types/assembly';
import { assemblyHeightUnits } from '@/shared/types/assemblyPlacement';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

export interface PublishAssemblyContent {
  readonly envelope: ItemEnvelope;
  readonly structure: AssemblyStructure;
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

/** Grid footprint in units, e.g. `2×4×4`. */
export function formatGridSize(params: BinParams): string {
  return `${format(params.width)}×${format(params.depth)}×${format(params.height)}`;
}

/**
 * Nominal outer size in millimetres. Nominal rather than the printed outer
 * dimension: this answers "how much drawer does it take", which is the pitch
 * it occupies, not the size minus the fit tolerance.
 *
 * `gridUnitMmY` is optional and means a non-square grid; falling back to
 * `gridUnitMm` would silently report a 42×22 design as square.
 */
export function formatMillimetres(params: BinParams): string {
  const unitY = params.gridUnitMmY ?? params.gridUnitMm;
  const width = format(params.width * params.gridUnitMm);
  const depth = format(params.depth * unitY);
  const height = format(params.height * params.heightUnitMm);
  return `${width} × ${depth} × ${height} mm`;
}

function assemblyUnits(assembly: PublishAssemblyContent): {
  width: number;
  depth: number;
  height: number;
} {
  const { envelope, structure } = assembly;
  return {
    width: envelope.width,
    depth: envelope.depth,
    height: assemblyHeightUnits(
      structure,
      envelope.heightUnitMm,
      GRIDFINITY_SPEC.SOCKET_HEIGHT + structure.base.floorThickness
    ),
  };
}

/** Assembly grid footprint in units, height from the tallest placed part. */
export function formatAssemblyGridSize(assembly: PublishAssemblyContent): string {
  const { width, depth, height } = assemblyUnits(assembly);
  return `${format(width)}×${format(depth)}×${format(height)}`;
}

/** Assembly nominal outer size in millimetres — same pitch semantics as bins. */
export function formatAssemblyMillimetres(assembly: PublishAssemblyContent): string {
  const { envelope } = assembly;
  const { width, depth, height } = assemblyUnits(assembly);
  return `${format(width * envelope.gridUnitMm)} × ${format(depth * envelope.gridUnitMm)} × ${format(
    height * envelope.heightUnitMm
  )} mm`;
}
