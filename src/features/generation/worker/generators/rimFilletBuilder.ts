import { edgeFinder, fillet, getBounds, getCurveType, getKernelCapabilities, unwrap } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinDimensions } from './pipeline/types';
import type { BinParams } from '@/shared/types/bin';
import { effectiveRimFilletRadius } from '@/shared/utils/rimFillet';

/**
 * Round the uninterrupted shell before lowering dividers for spanning labels.
 * Those clearance cuts leave tiny edges at the rim that cannot carry the
 * requested radius. Labels are added later, keeping their retaining rails sharp.
 * Consumes the input only when it returns a replacement.
 */
export function roundTopRim(solid: Shape3D, params: BinParams, dim: BinDimensions): Shape3D {
  const radius = effectiveRimFilletRadius(params);
  if (dim.isTile || radius <= 0) return solid;
  if (getKernelCapabilities().tessellationModel === 'build-time') {
    throw new Error('Top rim fillets require the exact geometry preview.');
  }
  const z = dim.wallTopZ - dim.baseOffsetZ;
  const epsilon = 0.0001;
  const edges = edgeFinder()
    .when((edge) => {
      const b = getBounds(edge);
      if (Math.abs(b.zMin - z) > epsilon || Math.abs(b.zMax - z) > epsilon) return false;
      if (dim.compartmentsBakedIntoShell) return true;
      // Straight divider edges merely end at the cavity envelope. A rim edge
      // lies wholly in the wall band; curved edges connect its corner segments.
      if (getCurveType(edge) !== 'LINE') return true;
      return (
        b.xMax <= dim.innerOffsetX - dim.innerW / 2 + epsilon ||
        b.xMin >= dim.innerOffsetX + dim.innerW / 2 - epsilon ||
        b.yMax <= dim.innerOffsetY - dim.innerD / 2 + epsilon ||
        b.yMin >= dim.innerOffsetY + dim.innerD / 2 - epsilon
      );
    })
    .findAll(solid);
  try {
    if (edges.length === 0) throw new Error('No top rim edges found for filleting.');
    const rounded = unwrap(fillet(solid as ValidSolid, edges, radius));
    solid.delete();
    return rounded;
  } finally {
    for (const edge of edges) edge.delete();
  }
}
