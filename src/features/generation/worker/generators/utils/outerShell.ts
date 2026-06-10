/**
 * Drop internal void shells from an export solid, keeping only the outer
 * boundary.
 *
 * Additive feature fuses (scoop ramps, label tabs, and combinations) can leave
 * a *technically valid* solid that nonetheless contains closed interior void
 * shells — sealed surfaces floating inside the bin walls. They pass
 * `isValidSolid`/`autoHeal` because the topology is legal, but STL export
 * tessellates every shell, so the interior voids surface as doubled triangles
 * → non-manifold edges that break watertightness.
 *
 * A printable Gridfinity bin is always a single outer shell (every cavity opens
 * to the top or bottom), so any extra shell is a boolean artifact and is safe
 * to discard. The outer shell is the one whose axis-aligned bounding box is
 * largest — it strictly encloses every void.
 *
 * The rebuilt solid is only used when it is a *closed manifold* (every edge
 * borders exactly two faces). Some features (through-wall handle cuts) produce
 * a genuinely broken multi-shell solid whose largest shell is open; rebuilding
 * from it would replace non-manifold edges with worse boundary holes. In that
 * case — and whenever the input already has a single shell or the rebuild fails
 * — the input is returned unchanged, so this is never worse than the original.
 */

import {
  clone,
  facesOfEdge,
  getBounds,
  getEdges,
  getShells,
  isErr,
  solidFromShell,
  unwrap,
  withScope,
} from 'brepjs';
import type { DisposalScope, Shape3D, Shell } from 'brepjs';

function boundsVolume(shell: Shell): number {
  const b = getBounds(shell);
  return (b.xMax - b.xMin) * (b.yMax - b.yMin) * (b.zMax - b.zMin);
}

function isClosedManifold(solid: Shape3D): boolean {
  for (const edge of getEdges(solid)) {
    if (facesOfEdge(solid, edge).length !== 2) return false;
  }
  return true;
}

/**
 * Return a single-outer-shell copy of `solid`, or `solid` itself when no
 * change is warranted. When a new solid is returned the caller owns it and
 * should dispose the original; when `solid` is returned unchanged the caller
 * keeps its existing ownership.
 */
export function keepOuterShell(solid: Shape3D): Shape3D {
  const shells = getShells(solid);
  if (shells.length <= 1) return solid;

  let outer = shells[0];
  let bestVolume = -Infinity;
  for (const shell of shells) {
    const volume = boundsVolume(shell);
    if (volume > bestVolume) {
      bestVolume = volume;
      outer = shell;
    }
  }

  return withScope((scope: DisposalScope): Shape3D => {
    // Clone the outer shell first so the rebuilt solid shares no topology with
    // `solid` — the caller can then dispose `solid` without risking a
    // double-free of shared WASM handles.
    const shellCopy = scope.register(unwrap(clone(outer)));
    const rebuilt = solidFromShell(shellCopy);
    if (isErr(rebuilt)) return solid;
    const rebuiltSolid = scope.register(rebuilt.value);
    if (!isClosedManifold(rebuiltSolid)) return solid;
    return unwrap(clone(rebuiltSolid));
  });
}
