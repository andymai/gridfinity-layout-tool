/**
 * Renders the seated dovetail keys in the split-baseplate preview.
 *
 * A key is a straight extrusion of the same 6-point dovetail key profile the worker
 * builds (`buildDovetailKey`), so this procedural mesh is geometrically identical
 * to the exported part — no BREP round-trip needed for a draft preview. One key
 * is placed at every seam junction (see `computeSeamJunctions`), rotated 90° on
 * horizontal seams. Hidden in exploded mode, since keys only make sense when the
 * pieces are assembled.
 */

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import type { ConnectorKeyMesh } from '../../store/baseplatePageStore';
import { buildFullParams } from '../../utils/buildFullParams';
import { computeSeamJunctions } from '../../utils/connectorKeys';
import {
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  SNAP_CLIP,
  snapClipLevels,
} from '@/shared/constants/connectors';

/** Retaining floor above magnet holes — mirrors MAGNET_FLOOR in the generator. */
const MAGNET_FLOOR = 0.5;

/** Distinct accent so the locking mechanism reads against the plate filament. */
const FALLBACK_ACCENT = '#f59e0b';

function getAccentHex(): string {
  if (typeof document === 'undefined') return FALLBACK_ACCENT;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
  return raw || FALLBACK_ACCENT;
}

/** Build the dovetail key profile centered on the origin, long axis along X. */
function buildKeyGeometry(totalHeight: number): THREE.ExtrudeGeometry {
  const P = TONGUE_PROTRUSION;
  const bW = TONGUE_BASE_HALF;
  const tW = TONGUE_TIP_HALF;
  const shape = new THREE.Shape();
  shape.moveTo(-P, tW);
  shape.lineTo(0, bW);
  shape.lineTo(P, tW);
  shape.lineTo(P, -tW);
  shape.lineTo(0, -bW);
  shape.lineTo(-P, -tW);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: totalHeight,
    bevelEnabled: false,
    steps: 1,
  });
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Build a THREE geometry from the worker's seated snap-clip mesh (the exact
 * socket-relieved part). The worker builds it seated — cross-seam on X,
 * along-seam on Y, up on Z, bridge top at Z=0 — so rotate the length onto X and
 * lift it flush to the plate top, matching the draft `buildSnapClipGeometry`
 * frame; the per-junction placement then seats both identically.
 */
function connectorMeshToGeometry(m: ConnectorKeyMesh, totalHeight: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(m.vertices, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
  geo.rotateZ(Math.PI / 2);
  geo.translate(0, 0, totalHeight);
  return geo;
}

type Corner = { r: number; chamfer?: boolean };

/** Emit a closed THREE.Shape over `pts`, rounding/chamfering tagged corners. */
function roundedShape(
  pts: ReadonlyArray<[number, number]>,
  corners: readonly Corner[]
): THREE.Shape {
  const n = pts.length;
  const pull = (i: number, j: number, r: number): [number, number] => {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[j];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    return [ax + (dx / len) * r, ay + (dy / len) * r];
  };
  const entry = (i: number): [number, number] =>
    corners[i].r > 0 ? pull(i, (i + n - 1) % n, corners[i].r) : pts[i];
  const exit = (i: number): [number, number] =>
    corners[i].r > 0 ? pull(i, (i + 1) % n, corners[i].r) : pts[i];

  const shape = new THREE.Shape();
  const [sx, sy] = exit(0);
  shape.moveTo(sx, sy);
  for (let k = 1; k <= n; k++) {
    const i = k % n;
    const [ex, ey] = entry(i);
    shape.lineTo(ex, ey);
    if (corners[i].r > 0) {
      const [ox, oy] = exit(i);
      if (corners[i].chamfer) shape.lineTo(ox, oy);
      else shape.quadraticCurveTo(pts[i][0], pts[i][1], ox, oy);
    }
  }
  shape.closePath();
  return shape;
}

/**
 * Build the snap-clip ("staple") silhouette: two legs + flush bridge + central
 * flex slot + outward barbs, matching the worker's `buildSnapClip` — including
 * its FDM-balanced edge treatments (slot-root + slot-mouth fillets, top chamfer;
 * barb/bearing faces crisp). Drawn in the cross-section (X = cross-seam, Y = up)
 * and extruded along the seam by the clip length, then baked into world
 * orientation — length along X, lifted so the bridge top sits flush with the
 * plate top and the legs hang into the seam — so the same per-junction
 * Z-rotation as the dovetail key seats it. Levels come from the shared
 * `snapClipLevels`. (The socket-clearance relief the worker applies is omitted
 * here — a cosmetic-only gap in the preview.)
 */
function buildSnapClipGeometry(totalHeight: number): THREE.ExtrudeGeometry {
  const lv = snapClipLevels(totalHeight, 0);
  const g = SNAP_CLIP.GAP_HALF;
  const br = SNAP_CLIP.BRIDGE_THK;
  const { legOuter, barbTip, apexZ, catchZ, leadZ, legBottom } = lv;
  const rRoot = 0.4;
  const rSlot = 0.3;
  // Approximate the worker's socket relief (relieveClipForSockets) which the
  // preview can't reproduce exactly without CSG: a larger 45° top-edge chamfer
  // pulls the bridge's outer corners in along roughly the socket taper, so the
  // seated clip reads as clearing the adjacent bin sockets rather than blocking
  // them. Cosmetic only — the exact rounded relief lives in the exported part.
  const rTopRelief = 0.9;
  const pts: Array<[number, number]> = [
    [-legOuter, 0],
    [legOuter, 0],
    [legOuter, catchZ],
    [barbTip, apexZ],
    [legOuter, leadZ],
    [legOuter, -legBottom],
    [g, -legBottom],
    [g, -br],
    [-g, -br],
    [-g, -legBottom],
    [-legOuter, -legBottom],
    [-legOuter, leadZ],
    [-barbTip, apexZ],
    [-legOuter, catchZ],
  ];
  const corners: Corner[] = [
    { r: rTopRelief, chamfer: true }, // top-left — approximates socket relief
    { r: rTopRelief, chamfer: true }, // top-right — approximates socket relief
    { r: 0 },
    { r: 0 }, // barb apex — crisp
    { r: 0 },
    { r: 0 }, // leg tip — crisp bearing face
    { r: rSlot }, // slot mouth
    { r: rRoot }, // slot root
    { r: rRoot }, // slot root
    { r: rSlot }, // slot mouth
    { r: 0 }, // leg tip — crisp bearing face
    { r: 0 },
    { r: 0 }, // barb apex — crisp
    { r: 0 },
  ];
  const shape = roundedShape(pts, corners);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: SNAP_CLIP.LEG_L,
    bevelEnabled: false,
    steps: 1,
  });
  // Cross-section is in XY (X=cross-seam, Y=up), length along Z. Stand it up so
  // up→Z and length→X: rotateX(+90°) (Y→Z, length Z→−Y), then rotateZ(+90°)
  // (−Y length → +X, cross-seam X → +Y). Centers the length on the seam point.
  geometry.rotateX(Math.PI / 2);
  geometry.rotateZ(Math.PI / 2);
  // After the rotations the length axis lands on X ∈ [0, LEG_L]; recenter it on
  // the seam junction.
  geometry.translate(-SNAP_CLIP.LEG_L / 2, 0, 0);
  // The clip seats from the TOP: bridge top at the plate top, legs hanging down
  // into the seam. After the rotations its top is at Z=0 and it hangs to
  // −legBottom, so lift it by totalHeight to sit flush with the plate top
  // (the assembled plate spans Z ∈ [0, totalHeight]); the shared per-junction
  // placement then adds the same small +Z proud-offset the dovetail key uses.
  geometry.translate(0, 0, totalHeight);
  geometry.computeVertexNormals();
  return geometry;
}

export function ConnectorKeyMeshes() {
  const { invalidate } = useThree();

  const { tiling, splitViewMode, connectorKeyMesh } = useBaseplatePageStore(
    useShallow((s) => ({
      tiling: s.tiling,
      splitViewMode: s.splitViewMode,
      connectorKeyMesh: s.connectorKeyMesh,
    }))
  );

  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    baseplateParams,
  } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      gridUnitMm: state.layout.gridUnitMm,
      fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
      fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );

  const fullParams = useMemo(
    () =>
      buildFullParams(
        baseplateParams,
        drawerWidth,
        drawerDepth,
        gridUnitMm,
        fractionalEdgeX,
        fractionalEdgeY
      ),
    [baseplateParams, drawerWidth, drawerDepth, gridUnitMm, fractionalEdgeX, fractionalEdgeY]
  );

  const junctions = useMemo(
    () => (tiling ? computeSeamJunctions(tiling, fullParams) : []),
    [tiling, fullParams]
  );

  const totalHeight =
    GRIDFINITY_SPEC.SOCKET_HEIGHT +
    (fullParams.magnetHoles ? MAGNET_FLOOR + fullParams.magnetDepth : 0);

  const isSnapClip = fullParams.connectorStyle === 'snapClip';
  // On a slab too thin to flex, the worker skips snap pockets — so the preview
  // must not draw a clip that wouldn't exist. (Unreachable at standard socket
  // heights; a guard against future thinner-base options.)
  const snapViable = !isSnapClip || snapClipLevels(totalHeight, 0).viable;
  // Prefer the worker-meshed clip (the exact socket-relieved part). Until BREP
  // supplies it, fall back to the procedural draft clip so the seat isn't empty.
  const geometry = useMemo(() => {
    if (isSnapClip && connectorKeyMesh)
      return connectorMeshToGeometry(connectorKeyMesh, totalHeight);
    return isSnapClip ? buildSnapClipGeometry(totalHeight) : buildKeyGeometry(totalHeight);
  }, [isSnapClip, connectorKeyMesh, totalHeight]);
  // Read on every render so a runtime theme/accent switch is reflected.
  const accentHex = getAccentHex();

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useEffect(() => {
    invalidate();
  }, [geometry, junctions, invalidate]);

  // Keys only make sense seated in assembled pieces; skip in exploded view.
  // A non-viable snap clip has no pockets in the worker, so draw nothing.
  if (splitViewMode === 'exploded' || junctions.length === 0 || !snapViable) return null;

  return (
    <>
      {junctions.map((j, i) => (
        <mesh
          key={i}
          geometry={geometry}
          position={[j.xMm, j.yMm, 0.1]}
          // Snap clip length runs ALONG the seam (perpendicular to the dovetail
          // key's bridge), so its per-junction rotation is offset 90° from the key.
          rotation={[
            0,
            0,
            isSnapClip ? (j.axis === 'y' ? 0 : Math.PI / 2) : j.axis === 'y' ? Math.PI / 2 : 0,
          ]}
          renderOrder={2}
        >
          <meshStandardMaterial
            color={accentHex}
            emissive={accentHex}
            emissiveIntensity={0.15}
            roughness={0.6}
            metalness={0}
            // The draft preview plate has no groove cut, so the flush key would
            // z-fight its coplanar top face. Pull the key toward the camera so it
            // reads as a distinct accent marker at each seam.
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ))}
    </>
  );
}
