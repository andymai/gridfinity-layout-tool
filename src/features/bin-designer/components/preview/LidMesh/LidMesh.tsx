/**
 * Renders the click-lock lid mesh in the 3D preview.
 *
 * Coordinate alignment when "closed" (lidOffsetMm = 0):
 *   - The lid is built in lid-local coords with Z = 0 at the floor's
 *     TOP surface and Z = anchorZ (~-2.1mm) at the mating-cavity opening,
 *     which lines up with the bin's stacking lip top.
 *   - The mating cavity opening sits at the lip top world Z; the floor's
 *     outer face sits ~2.1mm above, with the rails wrapping the lip from
 *     outside. This matches how the printed lid sits on the bin.
 *   - `lidOffsetMm` lifts the lid above this mated position to expose
 *     the cavity for inspection.
 *
 * Opacity:
 *   - Closed (offset ≤ 2mm): 70% — the lid reads as a solid part while
 *     hinting at the bin's interior.
 *   - Exploded (offset > 5mm): 95% — effectively solid; bin visible alongside.
 *   - Linear interpolation between 2mm and 5mm.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import { getZoneColor } from '@/features/bin-designer/types/featureColors';
import { buildLidColorGroups } from '@/features/bin-designer/utils/lidColorGroups';
import { lidGroupPosition, lidHingePose } from './lidAnchorZ';

/** Opacity bands for closed vs exploded views. */
const OPACITY_CLOSED = 0.7;
const OPACITY_OPEN = 0.95;
const OPACITY_INTERP_START_MM = 2;
const OPACITY_INTERP_END_MM = 5;

/**
 * Multiplier applied to the lid's computed opacity when xray is active so the
 * lid drops to ~30% at the open end and ~21% at the closed end — composes with
 * the explode-driven opacity instead of overwriting it.
 */
const XRAY_OPACITY_FACTOR = 0.32;

/** Linear interpolation: 30% closed → 70% open over [2mm, 5mm]. */
function opacityForOffset(offsetMm: number): number {
  if (offsetMm <= OPACITY_INTERP_START_MM) return OPACITY_CLOSED;
  if (offsetMm >= OPACITY_INTERP_END_MM) return OPACITY_OPEN;
  const t =
    (offsetMm - OPACITY_INTERP_START_MM) / (OPACITY_INTERP_END_MM - OPACITY_INTERP_START_MM);
  return OPACITY_CLOSED + t * (OPACITY_OPEN - OPACITY_CLOSED);
}

interface LidMeshProps {
  /** Fallback lid color (the bin's body material), used only when multi-color
   *  mode is off; in multi-color mode the lid follows `featureColors.lid`. */
  color: string;
  /** Distance the lid is lifted above its mated position, in mm. 0 = closed. */
  lidOffsetMm: number;
  wireframe?: boolean;
  /** When true, ghost the lid further so the bin interior is visible through it. */
  xray?: boolean;
}

export function LidMesh({ color, lidOffsetMm, wireframe = false, xray = false }: LidMeshProps) {
  const { invalidate } = useThree();

  const { lidMesh, params, featureColors } = useDesignerStore(
    useShallow((s) => ({
      lidMesh: s.generation.mesh?.lidMesh ?? null,
      featureColors: s.params.featureColors,
      params: s.params,
    }))
  );

  // Seated placement AND the explode direction, in one call: a capping lid mates
  // its `anchorZ` onto the lip top and lifts straight off, a sliding one hangs
  // under the wall top and withdraws through its entry wall, and the helper owns
  // both so this component never has to know which.
  //
  // Memoised OUTSIDE the selector rather than returned from it. The helper
  // returns a fresh tuple every call, and `useShallow` compares a nested array
  // by reference — so selecting it re-rendered on every store read, forever
  // ("Maximum update depth exceeded"). `params` is a stable reference between
  // edits, which is what makes this both correct and cheaper.
  const lidPosition = useMemo(() => lidGroupPosition(params, lidOffsetMm), [params, lidOffsetMm]);

  // A hinged lid does not lift — it swings, and showing it rising straight up
  // would depict the one motion the printed part cannot make while hiding the
  // one thing worth looking at: whether the nose clears the rim through the
  // arc. `lidOffsetMm` carries DEGREES for a hinged lid; the slider that owns
  // it changes units to match, so the two never disagree about what the number
  // means.
  const hingePose = useMemo(() => lidHingePose(params, lidOffsetMm), [params, lidOffsetMm]);

  // The lid's own top lip can differ from the rest of the lid. Classified by
  // exactly the rule the 3MF assembler uses, so the preview keeps predicting
  // the print (the invariant GH established).
  const lidColorData = useMemo(
    () =>
      featureColors.enabled
        ? buildLidColorGroups(
            lidMesh?.faceGroups,
            lidMesh?.vertices,
            lidMesh?.indices,
            featureColors
          )
        : null,
    [featureColors, lidMesh]
  );

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices: lidMesh?.vertices ?? null,
    normals: lidMesh?.normals ?? null,
    indices: lidMesh?.indices ?? null,
    edgeVertices: lidMesh?.edgeVertices ?? null,
    faceGroups: lidColorData?.groups,
  });

  // In multi-color mode the lid is a single zone (`featureColors.lid`); the
  // exporter already paints the whole lid object that color, so the preview
  // must match instead of falling back to the body material (GH).
  const lidColor = featureColors.enabled ? getZoneColor(featureColors, 'lid') : color;

  const baseOpacity = opacityForOffset(lidOffsetMm);
  const matProps = useMemo(
    () => ({
      color: lidColor,
      roughness: 0.45,
      metalness: 0,
      wireframe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: xray ? baseOpacity * XRAY_OPACITY_FACTOR : baseOpacity,
      depthWrite: !xray,
      flatShading: !hasPrecomputedNormals,
      // Bias the lid's depth values so it consistently loses depth tests
      // against the bin where their surfaces overlap (lid outer wall vs
      // bin lip outer face, separated by only 0.2mm horizontally over the
      // 4.4mm-tall lip Z-range). Without enough bias, those near-coplanar
      // surfaces z-fight at typical preview camera distances. Factor of 4
      // gives clean rendering even at the fully closed offset
      // (LID_OFFSET_MIN = 0) without affecting other view angles.
      polygonOffset: true,
      polygonOffsetFactor: 4,
      polygonOffsetUnits: 4,
    }),
    [lidColor, wireframe, hasPrecomputedNormals, baseOpacity, xray]
  );

  const lidMaterials = useMemo(() => {
    if (!lidColorData) return null;
    return lidColorData.colors.map(
      (c) => new THREE.MeshStandardMaterial({ ...matProps, color: c })
    );
  }, [lidColorData, matProps]);

  // Materials are owned here, so they must be released on swap/unmount or every
  // colour edit leaks a GPU material.
  useEffect(() => {
    return () => {
      if (lidMaterials) for (const m of lidMaterials) m.dispose();
    };
  }, [lidMaterials]);

  // Invalidate the R3F frame when any visual input changes.
  useEffect(() => {
    invalidate();
  }, [geometry, lidOffsetMm, invalidate]);

  if (!geometry) return null;

  // Distinct keys force unmount/remount across the multi<->single switch, for
  // the same reason BinMesh does it: reusing one <mesh> lets R3F's prop-diff
  // clobber the attached material array.
  const lidMeshNode = lidMaterials ? (
    <mesh key="lid-multi-color" geometry={geometry} material={lidMaterials} />
  ) : (
    <mesh key="lid-single-color" geometry={geometry}>
      <meshStandardMaterial {...matProps} />
    </mesh>
  );

  const contents = (
    <>
      {lidMeshNode}
      {!wireframe && edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial
            color="#000000"
            depthTest={true}
            transparent
            opacity={Math.min(0.5, opacityForOffset(lidOffsetMm) + 0.2)}
          />
        </lineSegments>
      )}
    </>
  );

  // Three nested groups, not one, and the nesting IS the pivot. A group turns
  // about its own origin, and the hinge axis is out at the wall — so the lid is
  // carried to the axis, turned there, and carried back. Collapsing this to a
  // single rotated group looks identical at 0° and swings the lid through the
  // bin at anything else.
  if (hingePose) {
    return (
      <group position={[hingePose.pivot[0], hingePose.pivot[1], hingePose.pivot[2]]}>
        <group rotation={[hingePose.rotation[0], hingePose.rotation[1], hingePose.rotation[2]]}>
          <group position={[hingePose.inner[0], hingePose.inner[1], hingePose.inner[2]]}>
            {contents}
          </group>
        </group>
      </group>
    );
  }

  return <group position={[lidPosition[0], lidPosition[1], lidPosition[2]]}>{contents}</group>;
}
