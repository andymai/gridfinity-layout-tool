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
import { buildFullParams } from '../../utils/buildFullParams';
import { computeSeamJunctions } from '../../utils/connectorKeys';
import {
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
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

export function ConnectorKeyMeshes() {
  const { invalidate } = useThree();

  const { tiling, splitViewMode } = useBaseplatePageStore(
    useShallow((s) => ({ tiling: s.tiling, splitViewMode: s.splitViewMode }))
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

  const geometry = useMemo(() => buildKeyGeometry(totalHeight), [totalHeight]);
  // Read on every render so a runtime theme/accent switch is reflected.
  const accentHex = getAccentHex();

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useEffect(() => {
    invalidate();
  }, [geometry, junctions, invalidate]);

  // Keys only make sense seated in assembled pieces; skip in exploded view.
  if (splitViewMode === 'exploded' || junctions.length === 0) return null;

  return (
    <>
      {junctions.map((j, i) => (
        <mesh
          key={i}
          geometry={geometry}
          position={[j.xMm, j.yMm, 0.1]}
          rotation={[0, 0, j.axis === 'y' ? Math.PI / 2 : 0]}
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
