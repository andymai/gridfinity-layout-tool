/**
 * Renders a socket-mode bin's swappable label plates in the 3D preview.
 *
 * Each plate is drawn twice from one mesh:
 *   - **Seated** in its socket, sliding out along the shelf's own protrusion
 *     direction as the explode slider opens — the same control that lifts the
 *     lid, so one slider separates every companion part.
 *   - **In a reference row** beside the bin at `REFERENCE_GAP`, matching where
 *     `GhostDividerPieces` parks its reference divider so a bin with both puts
 *     its loose parts in one place. The row is static: it is an exhibit of what
 *     gets printed, not part of the assembly.
 *
 * The worker meshes plates in plate-local coordinates (centred on the origin,
 * bottom on Z=0) and reports each seated pose, so both draws reuse one geometry.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import { FeatureTag } from '@/shared/types/generation';
import type { LabelPlateMeshData } from '@/shared/types/generation';
import { getZoneColor, normalizeHex } from '@/features/bin-designer/types/featureColors';
import { referenceRowPoses, seatedPose } from './platePoses';
import type { Pose } from './platePoses';

/** Stable empty reference so an absent set doesn't churn memo identities. */
const EMPTY_PLATES: readonly LabelPlateMeshData[] = [];

interface LabelPlateMeshesProps {
  readonly color: string;
  /** Shared explode offset; 0 = fully assembled. */
  readonly lidOffsetMm: number;
  readonly wireframe?: boolean;
}

/**
 * One plate's geometry, drawn at each pose it occupies — seated, and again in
 * the reference row. Both draws share a single `BufferGeometry`; instantiating
 * this component per pose would build the same tessellated buffers twice for
 * no visual difference.
 */
function PlateInstance({
  plate,
  poses,
  material,
  textMaterial,
}: {
  plate: LabelPlateMeshData;
  poses: readonly Pose[];
  material: THREE.Material;
  textMaterial: THREE.Material | null;
}) {
  const twoTone = textMaterial !== null && plate.faceGroups !== undefined;
  const groups = useMemo(
    () =>
      twoTone
        ? plate.faceGroups.map((g) => ({
            start: g.start,
            count: g.count,
            materialIndex: g.tag === FeatureTag.TEXT ? 1 : 0,
          }))
        : undefined,
    [twoTone, plate.faceGroups]
  );
  const { geometry } = useMeshGeometry({
    vertices: plate.vertices,
    normals: plate.normals,
    indices: plate.indices,
    edgeVertices: null,
    faceGroups: groups,
  });

  if (!geometry) return null;
  return (
    <>
      {poses.map((pose, i) => (
        <mesh
          // A distinct key per material shape, so R3F never diffs a single
          // material onto a mesh that was holding the two-tone array.
          key={`${i}-${twoTone ? 'two' : 'one'}`}
          geometry={geometry}
          material={twoTone ? [material, textMaterial] : material}
          position={pose.position}
          rotation={[(pose.pitchDeg * Math.PI) / 180, 0, (pose.yawDeg * Math.PI) / 180, 'ZYX']}
          renderOrder={2}
        />
      ))}
    </>
  );
}

export function LabelPlateMeshes({ color, lidOffsetMm, wireframe = false }: LabelPlateMeshesProps) {
  const { labelPlates, visible, depth, gridUnitMm, gridUnitMmY, featureColors } = useDesignerStore(
    useShallow((s) => ({
      labelPlates: s.generation.mesh?.labelPlates ?? null,
      visible: s.ui.showLabelPlates,
      depth: s.params.depth,
      gridUnitMm: s.params.gridUnitMm,
      gridUnitMmY: s.params.gridUnitMmY,
      featureColors: s.params.featureColors,
    }))
  );

  // The same pair the plate 3MF prints (`labelPlateColors`): the label-tab
  // colour for the plate, the Text colour for its glyphs and icon.
  const plateHex = featureColors.enabled ? getZoneColor(featureColors, 'labelTab') : color;
  const textHex = featureColors.enabled ? getZoneColor(featureColors, 'text') : color;
  const twoTone = normalizeHex(plateHex) !== normalizeHex(textHex);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: plateHex,
        roughness: 0.6,
        metalness: 0.05,
        wireframe,
      }),
    [plateHex, wireframe]
  );
  const textMaterial = useMemo(
    () =>
      twoTone
        ? new THREE.MeshStandardMaterial({
            color: textHex,
            roughness: 0.6,
            metalness: 0.05,
            wireframe,
          })
        : null,
    [twoTone, textHex, wireframe]
  );

  // Without this, every colour or wireframe change strands the previous
  // material on the GPU for the rest of the editing session.
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => textMaterial?.dispose(), [textMaterial]);

  const plates = useMemo(() => labelPlates?.plates ?? EMPTY_PLATES, [labelPlates]);

  // Reference row: laid out along X beside the bin, parked beyond its back
  // face so it reads as a set sitting next to the part it belongs to.
  const rowPositions = useMemo(
    () => referenceRowPoses(plates, depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE),
    [plates, depth, gridUnitMm, gridUnitMmY]
  );

  if (!visible || plates.length === 0) return null;

  return (
    <group>
      {plates.map((plate, i) => (
        <PlateInstance
          key={i}
          plate={plate}
          poses={[seatedPose(plate, lidOffsetMm), rowPositions[i]]}
          material={material}
          textMaterial={textMaterial}
        />
      ))}
    </group>
  );
}
